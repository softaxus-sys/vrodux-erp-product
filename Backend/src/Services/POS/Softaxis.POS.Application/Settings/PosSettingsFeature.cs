using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.Abstractions;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.Settings;

public sealed record PosSettingsDto(bool OfflineModeEnabled);

public sealed record OpenShiftBlockerDto(Guid SessionId, string RegisterId, Guid CashierId, DateTime OpenedAt);

public sealed record TillBlockerDto(
    string DeviceId, string? RegisterId, string? UserName, int PendingRecords, int UnsyncedShifts, DateTime ReportedAt);

/// <summary>
/// Whether the tenant can switch modes right now, and what is in the way.
/// Switching never happens with work in flight: going offline requires every live shift closed;
/// going online requires every till's offline records uploaded and no offline shift left open.
/// </summary>
public sealed record SwitchReadinessDto(
    bool                              OfflineModeEnabled,
    bool                              CanSwitch,
    IReadOnlyList<OpenShiftBlockerDto> OpenOnlineShifts,
    IReadOnlyList<OpenShiftBlockerDto> OpenOfflineShifts,
    IReadOnlyList<TillBlockerDto>      TillsWithUnsyncedWork);

public sealed record GetPosSettingsQuery : IQuery<PosSettingsDto>;

public sealed record GetSwitchReadinessQuery : IQuery<SwitchReadinessDto>;

/// <param name="Force">
/// Turning offline mode OFF despite tills that still report unsynced records — for a till that is
/// lost or broken and will never sync. Never bypasses open shifts (those can always be closed).
/// </param>
public sealed record UpdatePosSettingsCommand(bool OfflineModeEnabled, bool Force = false) : ICommand<PosSettingsDto>;

/// <summary>Sent by an offline-mode till whenever its local queue changes and it has a connection.</summary>
public sealed record ReportTillStatusCommand(
    string DeviceId, string? RegisterId, int PendingRecords, int UnsyncedShifts) : ICommand<TillBlockerDto>;

public sealed class ReportTillStatusCommandValidator : AbstractValidator<ReportTillStatusCommand>
{
    public ReportTillStatusCommandValidator()
    {
        RuleFor(x => x.DeviceId).NotEmpty().MaximumLength(64);
        RuleFor(x => x.RegisterId).MaximumLength(50);
        RuleFor(x => x.PendingRecords).GreaterThanOrEqualTo(0);
        RuleFor(x => x.UnsyncedShifts).GreaterThanOrEqualTo(0);
    }
}

internal static class SwitchReadiness
{
    public static async Task<SwitchReadinessDto> ComputeAsync(IPosSettingsRepository repo, CancellationToken ct)
    {
        var enabled = (await repo.GetAsync(ct))?.OfflineModeEnabled ?? false;

        static OpenShiftBlockerDto Map(POSSession s) => new(s.Id, s.RegisterId, s.CashierId, s.OpenedAt);

        // Only the blockers for the direction the tenant would switch TO are relevant.
        var online  = enabled ? [] : (await repo.GetOpenSessionsAsync(offline: false, ct)).Select(Map).ToList();
        var offline = enabled ? (await repo.GetOpenSessionsAsync(offline: true, ct)).Select(Map).ToList() : [];
        var tills   = enabled
            ? (await repo.GetTillsWithUnsyncedWorkAsync(ct))
                .Select(t => new TillBlockerDto(t.DeviceId, t.RegisterId, t.UserName, t.PendingRecords, t.UnsyncedShifts, t.ReportedAt))
                .ToList()
            : [];

        return new SwitchReadinessDto(enabled, online.Count == 0 && offline.Count == 0 && tills.Count == 0, online, offline, tills);
    }
}

public sealed class GetPosSettingsQueryHandler(IPosSettingsRepository repo)
    : IQueryHandler<GetPosSettingsQuery, PosSettingsDto>
{
    public async Task<Result<PosSettingsDto>> Handle(GetPosSettingsQuery query, CancellationToken ct)
    {
        // No row yet means the tenant never opted in — report the default rather than creating
        // one on a read (a GET must not write, and there is nothing to store until they change it).
        var settings = await repo.GetAsync(ct);
        return Result.Success(new PosSettingsDto(settings?.OfflineModeEnabled ?? false));
    }
}

public sealed class GetSwitchReadinessQueryHandler(IPosSettingsRepository repo)
    : IQueryHandler<GetSwitchReadinessQuery, SwitchReadinessDto>
{
    public async Task<Result<SwitchReadinessDto>> Handle(GetSwitchReadinessQuery query, CancellationToken ct)
        => Result.Success(await SwitchReadiness.ComputeAsync(repo, ct));
}

public sealed class UpdatePosSettingsCommandHandler(
    IPosSettingsRepository repo,
    ICurrentUser           currentUser,
    IUnitOfWork            uow)
    : ICommandHandler<UpdatePosSettingsCommand, PosSettingsDto>
{
    /// <summary>
    /// No dedicated POS-settings permission is seeded, so this gates on shift approval — the
    /// supervisor-level POS key. Offline mode changes how a till reconciles, which is that
    /// person's decision, not a cashier's.
    /// </summary>
    public const string RequiredPermission = "pos.sessions.approve";

    public async Task<Result<PosSettingsDto>> Handle(UpdatePosSettingsCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission(RequiredPermission))
            return Result.Failure<PosSettingsDto>(Error.Custom("PosSettings.Forbidden",
                "Only a POS supervisor or administrator can change POS settings."));

        var settings = await repo.GetAsync(ct);
        var current  = settings?.OfflineModeEnabled ?? false;
        if (current == cmd.OfflineModeEnabled)
            return Result.Success(new PosSettingsDto(current));

        // ── Everything must be synced before the switch ───────────────────────
        var r = await SwitchReadiness.ComputeAsync(repo, ct);
        if (cmd.OfflineModeEnabled && r.OpenOnlineShifts.Count > 0)
            return Result.Failure<PosSettingsDto>(Error.Custom("PosSettings.InUse",
                $"{r.OpenOnlineShifts.Count} shift(s) are open in online mode. Close them before switching to offline mode."));

        if (!cmd.OfflineModeEnabled)
        {
            if (r.OpenOfflineShifts.Count > 0)
                return Result.Failure<PosSettingsDto>(Error.Custom("PosSettings.InUse",
                    $"{r.OpenOfflineShifts.Count} offline shift(s) are still open. Close them on the till and sync before switching to online mode."));

            if (r.TillsWithUnsyncedWork.Count > 0 && !cmd.Force)
                return Result.Failure<PosSettingsDto>(Error.Custom("PosSettings.InUse",
                    $"{r.TillsWithUnsyncedWork.Count} till(s) still have records that haven't been synced. Sync them before switching to online mode."));

            if (cmd.Force)
                foreach (var till in await repo.GetTillsWithUnsyncedWorkAsync(ct))
                    till.Clear();
        }

        if (settings is null)
        {
            settings = PosSettings.CreateDefault();
            settings.CreatedAt = DateTime.UtcNow;
            settings.CreatedBy = currentUser.Username ?? "system";
            repo.Add(settings);
        }

        settings.SetOfflineMode(cmd.OfflineModeEnabled);
        settings.UpdatedAt = DateTime.UtcNow;
        settings.UpdatedBy = currentUser.Username;
        await uow.SaveChangesAsync(ct);

        return Result.Success(new PosSettingsDto(settings.OfflineModeEnabled));
    }
}

public sealed class ReportTillStatusCommandHandler(
    IPosSettingsRepository repo,
    ICurrentUser           currentUser,
    IUnitOfWork            uow)
    : ICommandHandler<ReportTillStatusCommand, TillBlockerDto>
{
    public async Task<Result<TillBlockerDto>> Handle(ReportTillStatusCommand cmd, CancellationToken ct)
    {
        if (!currentUser.IsAuthenticated || !currentUser.Id.HasValue)
            return Result.Failure<TillBlockerDto>(Error.Custom("TillStatus.Unauthorized", "Sign in again."));

        var till = await repo.GetTillAsync(cmd.DeviceId, ct);
        if (till is null)
        {
            till = PosTillStatus.Create(cmd.DeviceId);
            till.CreatedAt = DateTime.UtcNow;
            till.CreatedBy = currentUser.Username ?? "till";
            repo.AddTill(till);
        }

        till.Report(cmd.RegisterId, currentUser.Id.Value, currentUser.Username, cmd.PendingRecords, cmd.UnsyncedShifts);
        till.UpdatedAt = DateTime.UtcNow;
        await uow.SaveChangesAsync(ct);

        return Result.Success(new TillBlockerDto(
            till.DeviceId, till.RegisterId, till.UserName, till.PendingRecords, till.UnsyncedShifts, till.ReportedAt));
    }
}
