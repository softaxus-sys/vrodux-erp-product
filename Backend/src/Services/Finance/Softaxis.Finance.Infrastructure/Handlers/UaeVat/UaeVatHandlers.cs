using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.UaeVat;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Handlers.Tax;
using Softaxis.Finance.Infrastructure.Persistence;
using Softaxis.Finance.Infrastructure.UaeVat;

namespace Softaxis.Finance.Infrastructure.Handlers.UaeVat;

// Every query below goes through FinanceDbContext, whose tenant filter scopes UaeVatProfile,
// VatReturn and VatReturnAttempt to the caller's workspace; IsDeleted is applied by hand because
// the tenant filter replaces any entity-level soft-delete filter.

internal static class VatReturnMapping
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static string Ser<T>(T value) => JsonSerializer.Serialize(value, Json);

    public static VatReturnDto ToDto(VatReturn r) => new(
        r.Id, r.TaxPeriodId, r.PeriodLabel, r.FromDate, r.ToDate, r.Status,
        r.Trn, r.OutputVat, r.InputVat, r.NetVat,
        JsonSerializer.Deserialize<List<VatBox>>(r.BoxesJson.StartsWith('[') ? r.BoxesJson : "[]", Json) ?? [],
        JsonSerializer.Deserialize<List<VatReturnIssue>>(r.IssuesJson, Json) ?? [],
        r.ReconciliationJson.StartsWith('{') && r.ReconciliationJson.Length > 2
            ? JsonSerializer.Deserialize<VatReconciliation>(r.ReconciliationJson, Json) : null,
        r.HasBlockingErrors, r.IsReconciled,
        r.PreparedByName, r.PreparedAt, r.ApprovedByName, r.ApprovedAt,
        r.Environment, r.SubmissionReference, r.SubmittedAt, r.AcknowledgedAt,
        r.RejectionReason, r.FiledByName, r.ContentHash, r.FafContent is not null,
        r.Attempts.OrderByDescending(a => a.AttemptNumber).Select(a => new VatReturnAttemptDto(
            a.Id, a.AttemptNumber, a.Environment, a.Outcome, a.HttpStatus, a.ExternalReference,
            a.Message, a.StartedByName, a.StartedAt, a.CompletedAt)).ToList());

    public static VatTaxpayer Taxpayer(UaeVatProfile? p) => p is null
        ? new("", "", null, null, "DXB", null, null, null, null)
        : new(p.Trn, p.NameEn, p.NameAr, p.Address, p.DefaultEmirate, p.TaxAgencyName, p.Tan, p.TaxAgentName, p.Taan);

    public static UaeVatProfileDto ToDto(UaeVatProfile? p) => p is null
        ? new(false, "", "", null, null, "DXB", null, null, null, null)
        : new(true, p.Trn, p.NameEn, p.NameAr, p.Address, p.DefaultEmirate, p.TaxAgencyName, p.Tan, p.TaxAgentName, p.Taan);

    public static Task<VatReturn?> LoadAsync(FinanceDbContext db, Guid id, CancellationToken ct) =>
        db.VatReturns.Include(r => r.Attempts).FirstOrDefaultAsync(r => r.Id == id && !r.IsDeleted, ct);

    public static Error NotFound(Guid id) => Error.NotFoundById("VatReturn", id);
    public static Error Conflict(string message) => Error.Custom("VatReturn.Conflict", message);
}

internal sealed class GetUaeVatProfileHandler(FinanceDbContext db) : IQueryHandler<GetUaeVatProfileQuery, UaeVatProfileDto>
{
    public async Task<Result<UaeVatProfileDto>> Handle(GetUaeVatProfileQuery q, CancellationToken ct) =>
        Result.Success(VatReturnMapping.ToDto(await db.UaeVatProfiles.AsNoTracking().FirstOrDefaultAsync(ct)));
}

internal sealed class UpsertUaeVatProfileHandler(FinanceDbContext db) : ICommandHandler<UpsertUaeVatProfileCommand, UaeVatProfileDto>
{
    public async Task<Result<UaeVatProfileDto>> Handle(UpsertUaeVatProfileCommand c, CancellationToken ct)
    {
        var p = await db.UaeVatProfiles.FirstOrDefaultAsync(ct);
        if (p is null) { p = new UaeVatProfile(c.Trn, c.NameEn); db.UaeVatProfiles.Add(p); }
        p.Update(c.Trn, c.NameEn, c.NameAr, c.Address, c.DefaultEmirate, c.TaxAgencyName, c.Tan, c.TaxAgentName, c.Taan);
        await db.SaveChangesAsync(ct);
        return Result.Success(VatReturnMapping.ToDto(p));
    }
}

internal sealed class GetUaeVatIntegrationHandler(IUaeVatSubmissionGateway gateway) : IQueryHandler<GetUaeVatIntegrationQuery, UaeVatIntegrationDto>
{
    public Task<Result<UaeVatIntegrationDto>> Handle(GetUaeVatIntegrationQuery q, CancellationToken ct) =>
        Task.FromResult(Result.Success(new UaeVatIntegrationDto(gateway.Environment, gateway.IsAvailable, gateway.UnavailableReason)));
}

internal sealed class GetVatReturnsHandler(FinanceDbContext db) : IQueryHandler<GetVatReturnsQuery, IReadOnlyList<VatReturnDto>>
{
    public async Task<Result<IReadOnlyList<VatReturnDto>>> Handle(GetVatReturnsQuery q, CancellationToken ct)
    {
        var rows = await db.VatReturns.AsNoTracking().Include(r => r.Attempts)
            .Where(r => !r.IsDeleted && (q.TaxPeriodId == null || r.TaxPeriodId == q.TaxPeriodId))
            .OrderByDescending(r => r.FromDate).ThenByDescending(r => r.CreatedAt)
            .ToListAsync(ct);
        return Result.Success<IReadOnlyList<VatReturnDto>>(rows.Select(VatReturnMapping.ToDto).ToList());
    }
}

internal sealed class GetVatReturnByIdHandler(FinanceDbContext db) : IQueryHandler<GetVatReturnByIdQuery, VatReturnDto>
{
    public async Task<Result<VatReturnDto>> Handle(GetVatReturnByIdQuery q, CancellationToken ct)
    {
        var r = await VatReturnMapping.LoadAsync(db, q.Id, ct);
        return r is null ? Result.Failure<VatReturnDto>(VatReturnMapping.NotFound(q.Id)) : Result.Success(VatReturnMapping.ToDto(r));
    }
}

internal sealed class PrepareVatReturnHandler(FinanceDbContext db) : ICommandHandler<PrepareVatReturnCommand, VatReturnDto>
{
    public async Task<Result<VatReturnDto>> Handle(PrepareVatReturnCommand c, CancellationToken ct)
    {
        var period = await db.TaxPeriods.AsNoTracking().FirstOrDefaultAsync(p => p.Id == c.TaxPeriodId, ct);
        if (period is null)
            return Result.Failure<VatReturnDto>(Error.NotFoundById("TaxPeriod", c.TaxPeriodId));

        // Latest return for the period: re-prepare it while still editable; never touch one that left Vrodux.
        var ret = await db.VatReturns.Include(r => r.Attempts)
            .Where(r => r.TaxPeriodId == period.Id && !r.IsDeleted)
            .OrderByDescending(r => r.CreatedAt).FirstOrDefaultAsync(ct);

        if (ret is not null && VatReturnStatus.Final.Contains(ret.Status))
            return Result.Failure<VatReturnDto>(VatReturnMapping.Conflict(
                $"The {period.Period} return has already been {ret.Status.Replace('_', ' ')}. Corrections belong in a later return or a voluntary disclosure."));

        if (ret is not null && !ret.CanReprepare)
            return Result.Failure<VatReturnDto>(VatReturnMapping.Conflict(
                $"The {period.Period} return is {ret.Status.Replace('_', ' ')}; its figures are frozen."));

        if (ret is null)
        {
            ret = new VatReturn(period.Id, period.Period, period.FromDate, period.ToDate);
            db.VatReturns.Add(ret);
        }

        var profile = await db.UaeVatProfiles.AsNoTracking().FirstOrDefaultAsync(ct);
        var taxpayer = VatReturnMapping.Taxpayer(profile);
        var lines = await VatLedger.BuildSourceLinesAsync(db, period.FromDate, period.ToDate, ct);
        var gl = await VatLedger.GlNetVatAsync(db, period.FromDate, period.ToDate, ct);

        var comp = UaeVatReturnBuilder.Compute(taxpayer, period.FromDate, period.ToDate, lines, gl,
            DateOnly.FromDateTime(DateTime.UtcNow));

        ret.ApplyPreparation(taxpayer.Trn, comp.TotalOutputVat, comp.TotalInputVat, comp.NetVat,
            VatReturnMapping.Ser(comp.Boxes), VatReturnMapping.Ser(comp.Issues), VatReturnMapping.Ser(comp.Reconciliation),
            comp.HasErrors, comp.Reconciliation.Reconciled, c.ActorName ?? "System");

        await db.SaveChangesAsync(ct);
        return Result.Success(VatReturnMapping.ToDto(ret));
    }
}

internal sealed class ApproveVatReturnHandler(FinanceDbContext db) : ICommandHandler<ApproveVatReturnCommand, VatReturnDto>
{
    public async Task<Result<VatReturnDto>> Handle(ApproveVatReturnCommand c, CancellationToken ct)
    {
        var r = await VatReturnMapping.LoadAsync(db, c.Id, ct);
        if (r is null) return Result.Failure<VatReturnDto>(VatReturnMapping.NotFound(c.Id));
        if (r.Approve(c.ActorId, c.ActorName) is { } err) return Result.Failure<VatReturnDto>(VatReturnMapping.Conflict(err));
        await db.SaveChangesAsync(ct);
        return Result.Success(VatReturnMapping.ToDto(r));
    }
}

internal sealed class MarkVatReturnReadyHandler(FinanceDbContext db, IOptionsSnapshot<UaeVatOptions> options)
    : ICommandHandler<MarkVatReturnReadyCommand, VatReturnDto>
{
    public async Task<Result<VatReturnDto>> Handle(MarkVatReturnReadyCommand c, CancellationToken ct)
    {
        var r = await VatReturnMapping.LoadAsync(db, c.Id, ct);
        if (r is null) return Result.Failure<VatReturnDto>(VatReturnMapping.NotFound(c.Id));
        if (r.Status != VatReturnStatus.Approved)
            return Result.Failure<VatReturnDto>(VatReturnMapping.Conflict("Only an approved return can be marked ready to submit."));

        // Regenerated from the ledger and re-checked: the files must say exactly what was approved.
        var profile = await db.UaeVatProfiles.AsNoTracking().FirstOrDefaultAsync(ct);
        var taxpayer = VatReturnMapping.Taxpayer(profile);
        var lines = await VatLedger.BuildSourceLinesAsync(db, r.FromDate, r.ToDate, ct);
        var gl = await VatLedger.GlNetVatAsync(db, r.FromDate, r.ToDate, ct);
        var comp = UaeVatReturnBuilder.Compute(taxpayer, r.FromDate, r.ToDate, lines, gl, DateOnly.FromDateTime(DateTime.UtcNow));

        if (comp.NetVat != r.NetVat || comp.TotalOutputVat != r.OutputVat || comp.TotalInputVat != r.InputVat || comp.HasErrors)
            return Result.Failure<VatReturnDto>(VatReturnMapping.Conflict(
                "The ledger changed after approval. Prepare the return again and re-approve it."));

        var o = options.Value;
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var faf = UaeVatReturnBuilder.BuildAuditFile(taxpayer, r.FromDate, r.ToDate, lines, $"{o.SoftwareName} {o.SoftwareVersion}", today);
        var xml = UaeVatReturnBuilder.BuildReturnXml(taxpayer, r.PeriodLabel, r.FromDate, r.ToDate, comp, o.SoftwareName, o.SoftwareVersion, o.VendorTrn);

        if (r.MarkReady(faf, xml, UaeVatReturnBuilder.Hash(faf, xml)) is { } err)
            return Result.Failure<VatReturnDto>(VatReturnMapping.Conflict(err));
        await db.SaveChangesAsync(ct);
        return Result.Success(VatReturnMapping.ToDto(r));
    }
}

internal sealed class SubmitVatReturnHandler(
    FinanceDbContext db, IUaeVatSubmissionGateway gateway, ILogger<SubmitVatReturnHandler> log)
    : ICommandHandler<SubmitVatReturnCommand, VatReturnDto>
{
    public async Task<Result<VatReturnDto>> Handle(SubmitVatReturnCommand c, CancellationToken ct)
    {
        var r = await VatReturnMapping.LoadAsync(db, c.Id, ct);
        if (r is null) return Result.Failure<VatReturnDto>(VatReturnMapping.NotFound(c.Id));

        var (attempt, err) = r.BeginAttempt(gateway.Environment, c.ActorName);
        if (attempt is null) return Result.Failure<VatReturnDto>(VatReturnMapping.Conflict(err!));

        // Added explicitly: the attempt has a client-generated Guid, so EF would otherwise treat a
        // child discovered through the tracked collection as an existing row and issue an UPDATE.
        db.VatReturnAttempts.Add(attempt);

        // The in-flight attempt is committed before anything leaves the process, so a crash or a
        // concurrent click can never produce a second transmission (unique filtered index).
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException ex) when (ex is not DbUpdateConcurrencyException)
        {
            return Result.Failure<VatReturnDto>(VatReturnMapping.Conflict("A submission is already in progress for this return."));
        }

        UaeVatSubmissionResult result;
        try
        {
            result = await gateway.SubmitAsync(new UaeVatSubmissionRequest(
                r.Id, r.Trn, r.PeriodLabel, gateway.Environment, r.IdempotencyKey!, r.ContentHash!,
                r.ReturnXml!, r.FafContent!), ct);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or TimeoutException)
        {
            result = new(VatAttemptOutcome.Failed, null, null, $"Transport failure: {ex.GetType().Name}. Safe to retry.");
        }

        r.CompleteAttempt(attempt, result.Outcome, result.HttpStatus, result.ExternalReference, result.Message);
        // CancellationToken.None: the outcome must be recorded even if the caller has gone away.
        await db.SaveChangesAsync(CancellationToken.None);

        // Audit line without taxpayer data (no TRN, no amounts).
        log.LogInformation("VAT return {ReturnId} attempt {Attempt} to {Environment}: {Outcome} (HTTP {Status})",
            r.Id, attempt.AttemptNumber, attempt.Environment, result.Outcome, result.HttpStatus);

        return Result.Success(VatReturnMapping.ToDto(r));
    }
}

internal sealed class RecordVatPortalFilingHandler(FinanceDbContext db) : ICommandHandler<RecordVatPortalFilingCommand, VatReturnDto>
{
    public async Task<Result<VatReturnDto>> Handle(RecordVatPortalFilingCommand c, CancellationToken ct)
    {
        var r = await VatReturnMapping.LoadAsync(db, c.Id, ct);
        if (r is null) return Result.Failure<VatReturnDto>(VatReturnMapping.NotFound(c.Id));
        if (r.RecordPortalFiling(c.Reference, c.ActorName) is { } err)
            return Result.Failure<VatReturnDto>(VatReturnMapping.Conflict(err));

        // Keep the existing tax-period lifecycle in step (open → filed) so payment can be recorded.
        var period = await db.TaxPeriods.FirstOrDefaultAsync(p => p.Id == r.TaxPeriodId, ct);
        if (period is not null && period.Status == "open")
            period.File(DateTime.UtcNow.ToString("yyyy-MM-dd"));

        await db.SaveChangesAsync(ct);
        return Result.Success(VatReturnMapping.ToDto(r));
    }
}

internal sealed class GetVatReturnFileHandler(FinanceDbContext db) : IQueryHandler<GetVatReturnFileQuery, VatReturnFileDto>
{
    public async Task<Result<VatReturnFileDto>> Handle(GetVatReturnFileQuery q, CancellationToken ct)
    {
        var r = await VatReturnMapping.LoadAsync(db, q.Id, ct);
        if (r is null) return Result.Failure<VatReturnFileDto>(VatReturnMapping.NotFound(q.Id));
        var stem = $"VAT201_{r.Trn}_{r.PeriodLabel}".Replace(' ', '_');

        return q.Kind switch
        {
            "faf" when r.FafContent is not null => Result.Success(new VatReturnFileDto($"FAF_{r.Trn}_{r.PeriodLabel}.csv", "text/csv", r.FafContent)),
            "xml" when r.ReturnXml is not null  => Result.Success(new VatReturnFileDto($"{stem}.xml", "application/xml", r.ReturnXml)),
            "attempts" => Result.Success(new VatReturnFileDto($"{stem}_submission_log.json", "application/json",
                VatReturnMapping.Ser(VatReturnMapping.ToDto(r).Attempts))),
            "faf" or "xml" => Result.Failure<VatReturnFileDto>(VatReturnMapping.Conflict("Files are generated when the return is marked ready to submit.")),
            _ => Result.Failure<VatReturnFileDto>(Error.Custom("Validation.Failed", "Unknown file kind.")),
        };
    }
}
