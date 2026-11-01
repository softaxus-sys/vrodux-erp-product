using System.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Softaxis.AiAssistant.Application.Abstractions;
using Softaxis.AiAssistant.Application.PlatformAi.Commands;
using Softaxis.AiAssistant.Application.PlatformAi.Dtos;
using Softaxis.AiAssistant.Application.PlatformAi.Queries;
using Softaxis.AiAssistant.Domain.Entities;
using Softaxis.AiAssistant.Domain.Enums;
using Softaxis.AiAssistant.Infrastructure.Orchestration;
using Softaxis.AiAssistant.Infrastructure.Persistence;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;

namespace Softaxis.AiAssistant.Infrastructure.Handlers.PlatformAi;

internal static class PlatformAiMapper
{
    public static async Task<PlatformAiSettings> LoadOrCreateAsync(AiAssistantDbContext db, CancellationToken ct)
    {
        var row = await db.PlatformAi.FirstOrDefaultAsync(ct);
        if (row is not null) return row;
        row = PlatformAiSettings.CreateDefault();
        db.PlatformAi.Add(row);
        return row;
    }

    public static PlatformAiDto ToDto(PlatformAiSettings p)
    {
        string? issue = null;
        if (!p.Enabled) issue = "Switched off.";
        else if (!p.HasApiKey) issue = "No API key saved.";
        else if (AiKeyResolver.ResolveModel(p.Provider, p.Model) is null) issue = "No model chosen. Pick one from the provider's current list.";

        return new PlatformAiDto(
            p.Enabled, p.Provider.ToString(), p.Model, p.HasApiKey,
            p.MonthlyMessageCapPerTenant, p.NudgeEveryMessages, p.ShowOwnKeyBanner,
            p.VoiceEnabled, p.SttModel, p.TtsModel, p.TtsVoice, p.VoiceMonthlyCapPerTenant, p.HasVoiceApiKey,
            issue is null, issue, p.UpdatedAt);
    }
}

internal sealed class GetPlatformAiHandler(AiAssistantDbContext db) : IQueryHandler<GetPlatformAiQuery, PlatformAiDto>
{
    public async Task<Result<PlatformAiDto>> Handle(GetPlatformAiQuery q, CancellationToken ct)
    {
        var row = await db.PlatformAi.AsNoTracking().FirstOrDefaultAsync(ct) ?? PlatformAiSettings.CreateDefault();
        return PlatformAiMapper.ToDto(row);
    }
}

internal sealed class UpdatePlatformAiHandler(AiAssistantDbContext db, ISecretProtector protector)
    : ICommandHandler<UpdatePlatformAiCommand, PlatformAiDto>
{
    public async Task<Result<PlatformAiDto>> Handle(UpdatePlatformAiCommand cmd, CancellationToken ct)
    {
        if (!Enum.TryParse<AiProvider>(cmd.Provider, ignoreCase: true, out var provider))
            return Result.Failure<PlatformAiDto>(Error.Custom("PlatformAi.InvalidProvider", $"Unknown provider '{cmd.Provider}'."));

        var row = await PlatformAiMapper.LoadOrCreateAsync(db, ct);
        row.ConfigureText(cmd.Enabled, provider, cmd.Model, cmd.MonthlyMessageCapPerTenant, cmd.NudgeEveryMessages, cmd.ShowOwnKeyBanner);
        row.ConfigureVoice(cmd.VoiceEnabled, cmd.SttModel, cmd.TtsModel, cmd.TtsVoice, cmd.VoiceMonthlyCapPerTenant);

        if (cmd.ClearApiKey) row.ClearApiKey();
        else if (!string.IsNullOrWhiteSpace(cmd.ApiKey)) row.SetProtectedApiKey(protector.Protect(cmd.ApiKey.Trim()));

        if (cmd.ClearVoiceApiKey) row.ClearVoiceApiKey();
        else if (!string.IsNullOrWhiteSpace(cmd.VoiceApiKey)) row.SetProtectedVoiceApiKey(protector.Protect(cmd.VoiceApiKey.Trim()));

        await db.SaveChangesAsync(ct);
        return PlatformAiMapper.ToDto(row);
    }
}

internal sealed class TestPlatformAiHandler(AiAssistantDbContext db, ISecretProtector protector, IAiProviderFactory providers)
    : ICommandHandler<TestPlatformAiCommand, PlatformAiTestResultDto>
{
    public async Task<Result<PlatformAiTestResultDto>> Handle(TestPlatformAiCommand cmd, CancellationToken ct)
    {
        var p = await db.PlatformAi.AsNoTracking().FirstOrDefaultAsync(ct);
        var key = p is null ? null : protector.Unprotect(p.ProtectedApiKey);
        var model = p is null ? null : AiKeyResolver.ResolveModel(p.Provider, p.Model);
        if (p is null || string.IsNullOrEmpty(key) || model is null)
            return new PlatformAiTestResultDto(false, "Save a provider, a model and an API key first.", 0, null);

        var sw = Stopwatch.StartNew();
        try
        {
            var req = new AiCompletionRequest(model, key, "You are a connectivity check. Reply with the single word OK.",
                [new AiChatMessage(AiRole.User, "ping")], []);
            var res = await providers.Create(p.Provider).CompleteAsync(req, ct);
            sw.Stop();
            var text = (res.AssistantText ?? "").Trim();
            return text.Length == 0
                ? new PlatformAiTestResultDto(false, "The model answered but returned no text. Try another model.", (int)sw.ElapsedMilliseconds, null)
                : new PlatformAiTestResultDto(true, "Connected.", (int)sw.ElapsedMilliseconds, text.Length > 120 ? text[..120] : text);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            sw.Stop();
            return new PlatformAiTestResultDto(false, ex.Message, (int)sw.ElapsedMilliseconds, null);
        }
    }
}

internal sealed class GetPlatformAiUsageHandler(AiAssistantDbContext db)
    : IQueryHandler<GetPlatformAiUsageQuery, IReadOnlyList<PlatformAiUsageRowDto>>
{
    private sealed class TenantNameRow { public Guid Id { get; set; } public string Name { get; set; } = ""; }

    public async Task<Result<IReadOnlyList<PlatformAiUsageRowDto>>> Handle(GetPlatformAiUsageQuery q, CancellationToken ct)
    {
        var month = string.IsNullOrWhiteSpace(q.Month) ? DateTime.UtcNow.ToString("yyyy-MM") : q.Month.Trim();

        // The super admin has no tenant, so the tenant filter lets every workspace's counters through.
        var rows = await db.PlatformUsage.AsNoTracking()
            .Where(u => u.Month == month)
            .Select(u => new { TenantId = EF.Property<Guid?>(u, "TenantId"), u.Messages, u.VoiceTurns })
            .ToListAsync(ct);

        Dictionary<Guid, string> names;
        try
        {
            names = (await db.Database.SqlQueryRaw<TenantNameRow>("SELECT Id, Name FROM [identity].[tenants]").ToListAsync(ct))
                .ToDictionary(t => t.Id, t => t.Name);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            names = [];   // names are a nicety; the counters are the point
        }

        IReadOnlyList<PlatformAiUsageRowDto> result = rows
            .Where(r => r.TenantId.HasValue)
            .Select(r => new PlatformAiUsageRowDto(r.TenantId!.Value, names.GetValueOrDefault(r.TenantId.Value, "(unknown workspace)"), month, r.Messages, r.VoiceTurns))
            .OrderByDescending(r => r.Messages + r.VoiceTurns)
            .ToList();
        return Result.Success(result);
    }
}
