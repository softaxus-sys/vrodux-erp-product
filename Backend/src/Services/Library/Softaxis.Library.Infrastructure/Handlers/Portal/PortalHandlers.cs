using MediatR;
using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Library.Application.Catalogue;
using Softaxis.Library.Application.Circulation;
using Softaxis.Library.Application.Portal;
using Softaxis.Library.Domain.Entities;
using Softaxis.Library.Infrastructure.Persistence;
using Softaxis.Library.Infrastructure.Services;

namespace Softaxis.Library.Infrastructure.Handlers.Portal;

// ═════════════════════════════════════════════════════════════════════════════
// Staff side
// ═════════════════════════════════════════════════════════════════════════════

internal static class PortalSettingsStore
{
    public static async Task<PortalSettings> GetOrCreateAsync(LibraryDbContext db, CancellationToken ct)
    {
        var settings = await db.PortalSettings.FirstOrDefaultAsync(ct);
        if (settings is not null) return settings;

        settings = new PortalSettings(enabled: false);
        db.PortalSettings.Add(settings);
        await db.SaveChangesAsync(ct);
        return settings;
    }

    public static async Task<PortalSettingsDto> ToDtoAsync(LibraryDbContext db, PortalSettings s, CancellationToken ct) => new(
        s.Enabled, s.AllowRenewals, s.AllowReservations, s.PublicCatalogue,
        await db.Members.CountAsync(m => !m.IsDeleted && m.PortalPinHash != null, ct));
}

internal sealed class GetPortalSettingsHandler(LibraryDbContext db) : IQueryHandler<GetPortalSettingsQuery, PortalSettingsDto>
{
    public async Task<Result<PortalSettingsDto>> Handle(GetPortalSettingsQuery q, CancellationToken ct) =>
        Result.Success(await PortalSettingsStore.ToDtoAsync(db, await PortalSettingsStore.GetOrCreateAsync(db, ct), ct));
}

internal sealed class UpdatePortalSettingsHandler(LibraryDbContext db)
    : ICommandHandler<UpdatePortalSettingsCommand, PortalSettingsDto>
{
    public async Task<Result<PortalSettingsDto>> Handle(UpdatePortalSettingsCommand cmd, CancellationToken ct)
    {
        var settings = await PortalSettingsStore.GetOrCreateAsync(db, ct);
        settings.Update(cmd.Enabled, cmd.AllowRenewals, cmd.AllowReservations, cmd.PublicCatalogue);
        await db.SaveChangesAsync(ct);
        return Result.Success(await PortalSettingsStore.ToDtoAsync(db, settings, ct));
    }
}

internal sealed class SetMemberPortalPinHandler(LibraryDbContext db, IPortalSecurity security)
    : ICommandHandler<SetMemberPortalPinCommand, MemberPortalPinDto>
{
    public async Task<Result<MemberPortalPinDto>> Handle(SetMemberPortalPinCommand cmd, CancellationToken ct)
    {
        var member = await db.Members.FirstOrDefaultAsync(m => m.Id == cmd.MemberId && !m.IsDeleted, ct);
        if (member is null) return Result.Failure<MemberPortalPinDto>(Error.NotFoundById("Member", cmd.MemberId));

        // Only the hash is kept, so this response is the one time the PIN can be read.
        var pin = security.NewPin();
        member.SetPortalPin(security.HashPin(pin));
        await db.SaveChangesAsync(ct);
        return Result.Success(new MemberPortalPinDto(member.MemberNumber, pin));
    }
}

internal sealed class ClearMemberPortalPinHandler(LibraryDbContext db) : ICommandHandler<ClearMemberPortalPinCommand>
{
    public async Task<Result> Handle(ClearMemberPortalPinCommand cmd, CancellationToken ct)
    {
        var member = await db.Members.FirstOrDefaultAsync(m => m.Id == cmd.MemberId && !m.IsDeleted, ct);
        if (member is null) return Result.Failure(Error.NotFoundById("Member", cmd.MemberId));
        member.ClearPortalPin();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// Member side — anonymous requests
// ═════════════════════════════════════════════════════════════════════════════

/// <summary>A workspace whose portal is switched on.</summary>
internal sealed record PortalDoor(TenantLookup Tenant, PortalSettings Settings)
{
    /// <summary>
    /// Makes every Library query that follows belong to this workspace. An anonymous request has
    /// no tenant, and with no tenant the query filter lets every workspace's rows through — so a
    /// handler must call this before it touches a Library table.
    ///
    /// Not async, and not folded into <see cref="PortalGate.OpenAsync"/>, on purpose: a value set
    /// inside an awaited method is gone again when that method returns to its caller.
    /// </summary>
    public void Enter() => TenantAmbient.Set(Tenant.Id, isSuperAdmin: false, isResolved: true, Tenant.Currency);
}

internal static class PortalGate
{
    // The same answer whether the address is wrong or the portal is off: which workspaces exist
    // is not something to confirm to a stranger.
    private static readonly Error NotOffered =
        Error.Custom("Portal.NotFound", "This library does not offer online access.");

    public static readonly Error SignInAgain =
        Error.Custom("Portal.Unauthorized", "Please sign in again.");

    public static async Task<Result<PortalDoor>> OpenAsync(LibraryDbContext db, string? slug, CancellationToken ct)
    {
        var key = (slug ?? string.Empty).Trim().ToLowerInvariant();
        if (key.Length is 0 or > 100) return Result.Failure<PortalDoor>(NotOffered);

        var tenant = await db.TenantLookups.AsNoTracking().FirstOrDefaultAsync(t => t.Slug == key && !t.IsDeleted, ct);
        if (tenant is null || tenant.Status is "Suspended" or "Expired") return Result.Failure<PortalDoor>(NotOffered);

        // For the settings read just below. The caller still has to Enter() for its own queries.
        TenantAmbient.Set(tenant.Id, isSuperAdmin: false, isResolved: true, tenant.Currency);
        var settings = await db.PortalSettings.AsNoTracking().FirstOrDefaultAsync(ct);
        return settings is { Enabled: true }
            ? Result.Success(new PortalDoor(tenant, settings))
            : Result.Failure<PortalDoor>(NotOffered);
    }

    /// <summary>
    /// The member a session belongs to. Call after <see cref="PortalDoor.Enter"/>. The member is
    /// read again on every request, so a deleted member, a removed PIN or a changed PIN ends the
    /// session at once rather than when the token runs out.
    /// </summary>
    public static async Task<Result<Member>> MemberAsync(
        LibraryDbContext db, IPortalSecurity security, PortalDoor door, string? token, bool tracked, CancellationToken ct)
    {
        var session = security.ReadToken(token);
        if (session is null || session.TenantId != door.Tenant.Id) return Result.Failure<Member>(SignInAgain);

        var members = tracked ? db.Members : db.Members.AsNoTracking();
        var member  = await members.FirstOrDefaultAsync(m => m.Id == session.MemberId && !m.IsDeleted, ct);
        if (member?.PortalPinHash is null || security.PinStamp(member.PortalPinHash) != session.PinStamp)
            return Result.Failure<Member>(SignInAgain);

        return Result.Success(member);
    }
}

internal static class PortalMappings
{
    public static PortalLoanDto ToPortal(LoanDto l) => new(
        l.Id, l.Title, l.Authors, l.Barcode, l.BranchName, l.IssuedOn, l.DueDate, l.RenewalCount, l.IsOverdue, l.DaysOverdue);

    public static PortalReservationDto ToPortal(ReservationDto r) => new(
        r.Id, r.TitleId, r.Title, r.PickupBranchName, r.Status, r.ReservedOn, r.HoldUntil, r.HoldExpired);
}

internal sealed class GetPortalInfoHandler(LibraryDbContext db) : IQueryHandler<GetPortalInfoQuery, PortalInfoDto>
{
    public async Task<Result<PortalInfoDto>> Handle(GetPortalInfoQuery q, CancellationToken ct)
    {
        var opened = await PortalGate.OpenAsync(db, q.Slug, ct);
        if (opened.IsFailure) return Result.Failure<PortalInfoDto>(opened.Error);
        var door = opened.Value; door.Enter();

        var branches = await db.Branches.AsNoTracking().Where(b => !b.IsDeleted && b.IsActive)
            .OrderBy(b => b.Name).Select(b => new PortalBranchDto(b.Id, b.Name)).ToListAsync(ct);

        var s = door.Settings;
        return Result.Success(new PortalInfoDto(
            door.Tenant.Name, s.AllowRenewals, s.AllowReservations, s.PublicCatalogue, door.Tenant.Currency, branches));
    }
}

internal sealed class PortalSignInHandler(LibraryDbContext db, IPortalSecurity security)
    : ICommandHandler<PortalSignInCommand, PortalSessionDto>
{
    // One message for an unknown card, a member with no PIN and a wrong PIN.
    private static readonly Error Wrong = Error.Custom("Portal.Unauthorized", "Card number or PIN is not correct.");

    public async Task<Result<PortalSessionDto>> Handle(PortalSignInCommand cmd, CancellationToken ct)
    {
        var opened = await PortalGate.OpenAsync(db, cmd.Slug, ct);
        if (opened.IsFailure) return Result.Failure<PortalSessionDto>(opened.Error);
        var door = opened.Value; door.Enter();

        var number = cmd.MemberNumber.Trim();
        var member = await db.Members.FirstOrDefaultAsync(m => m.MemberNumber == number && !m.IsDeleted, ct);

        if (member?.PortalPinHash is null)
        {
            // Spend the same effort as a real check, so the reply time does not say which it was.
            security.HashPin(cmd.Pin);
            return Result.Failure<PortalSessionDto>(Wrong);
        }

        if (member.PortalLockedUntil is { } until && until > DateTime.UtcNow)
        {
            var minutes = Math.Max(1, (int)Math.Ceiling((until - DateTime.UtcNow).TotalMinutes));
            return Result.Failure<PortalSessionDto>(Error.Custom("Portal.Conflict",
                $"Too many wrong PINs. Try again in {minutes} minute{(minutes == 1 ? "" : "s")}, or ask at the library desk for a new PIN."));
        }

        if (!security.VerifyPin(cmd.Pin.Trim(), member.PortalPinHash))
        {
            member.RecordPortalFailure();
            await db.SaveChangesAsync(ct);
            return Result.Failure<PortalSessionDto>(Wrong);
        }

        member.RecordPortalSuccess();
        await db.SaveChangesAsync(ct);

        var (token, expires) = security.CreateToken(door.Tenant.Id, member.Id, member.PortalPinHash);
        return Result.Success(new PortalSessionDto(token, expires, member.FullName, member.MemberNumber));
    }
}

internal sealed class PortalChangePinHandler(LibraryDbContext db, IPortalSecurity security)
    : ICommandHandler<PortalChangePinCommand, PortalSessionDto>
{
    public async Task<Result<PortalSessionDto>> Handle(PortalChangePinCommand cmd, CancellationToken ct)
    {
        var opened = await PortalGate.OpenAsync(db, cmd.Slug, ct);
        if (opened.IsFailure) return Result.Failure<PortalSessionDto>(opened.Error);
        var door = opened.Value; door.Enter();

        var found = await PortalGate.MemberAsync(db, security, door, cmd.Token, tracked: true, ct);
        if (found.IsFailure) return Result.Failure<PortalSessionDto>(found.Error);
        var member = found.Value;

        // Guesses at the current PIN count the same as guesses at sign-in.
        if (member.PortalLockedUntil is { } until && until > DateTime.UtcNow)
            return Result.Failure<PortalSessionDto>(Error.Custom("Portal.Conflict",
                "Too many wrong PINs. Please try again later."));

        if (!security.VerifyPin(cmd.CurrentPin.Trim(), member.PortalPinHash!))
        {
            member.RecordPortalFailure();
            await db.SaveChangesAsync(ct);
            return Result.Failure<PortalSessionDto>(Error.Custom("Portal.Conflict", "Your current PIN is not correct."));
        }

        member.SetPortalPin(security.HashPin(cmd.NewPin));
        await db.SaveChangesAsync(ct);

        // The old session died with the old PIN; hand back one that matches the new PIN.
        var (token, expires) = security.CreateToken(door.Tenant.Id, member.Id, member.PortalPinHash!);
        return Result.Success(new PortalSessionDto(token, expires, member.FullName, member.MemberNumber));
    }
}

internal sealed class GetPortalAccountHandler(LibraryDbContext db, IPortalSecurity security, ISender sender)
    : IQueryHandler<GetPortalAccountQuery, PortalAccountDto>
{
    public async Task<Result<PortalAccountDto>> Handle(GetPortalAccountQuery q, CancellationToken ct)
    {
        var opened = await PortalGate.OpenAsync(db, q.Slug, ct);
        if (opened.IsFailure) return Result.Failure<PortalAccountDto>(opened.Error);
        var door = opened.Value; door.Enter();

        var found = await PortalGate.MemberAsync(db, security, door, q.Token, tracked: false, ct);
        if (found.IsFailure) return Result.Failure<PortalAccountDto>(found.Error);
        var member = found.Value;
        var today  = LibraryDates.Today(q.Today);

        // The desk's own queries, narrowed to this member — one set of rules for what a loan,
        // a hold and a balance are.
        var loans = await sender.Send(new GetLoansQuery("active", MemberId: member.Id, PageSize: 200, Today: today), ct);
        if (loans.IsFailure) return Result.Failure<PortalAccountDto>(loans.Error);
        var reservations = await sender.Send(new GetReservationsQuery("open", MemberId: member.Id, Today: today), ct);
        if (reservations.IsFailure) return Result.Failure<PortalAccountDto>(reservations.Error);
        var fines = await sender.Send(new GetFinesQuery("unpaid", member.Id), ct);
        if (fines.IsFailure) return Result.Failure<PortalAccountDto>(fines.Error);

        var type = await db.MembershipTypes.AsNoTracking().FirstOrDefaultAsync(t => t.Id == member.MembershipTypeId, ct);
        var home = member.HomeBranchId is { } b
            ? await db.Branches.AsNoTracking().Where(x => x.Id == b).Select(x => x.Name).FirstOrDefaultAsync(ct)
            : null;

        var fineRows = fines.Value.Select(f => new PortalFineDto(f.Id, f.Type, f.Title, f.Reason, f.Balance, f.CreatedOn)).ToList();

        return Result.Success(new PortalAccountDto(
            new PortalMemberDto(member.MemberNumber, member.FullName, type?.Name ?? "—", member.ExpiresOn,
                LibraryRules.IsExpired(member, today), member.Status, type?.MaxLoans ?? 0, type?.MaxRenewals ?? 0,
                type?.MaxReservations ?? 0, home),
            loans.Value.Items.OrderBy(l => l.DueDate).Select(PortalMappings.ToPortal).ToList(),
            reservations.Value.Select(PortalMappings.ToPortal).ToList(),
            fineRows, fineRows.Sum(f => f.Balance)));
    }
}

internal sealed class PortalSearchHandler(LibraryDbContext db, IPortalSecurity security)
    : IQueryHandler<PortalSearchQuery, PagedDto<PortalTitleDto>>
{
    private const int PageSize = 20;

    public async Task<Result<PagedDto<PortalTitleDto>>> Handle(PortalSearchQuery q, CancellationToken ct)
    {
        var opened = await PortalGate.OpenAsync(db, q.Slug, ct);
        if (opened.IsFailure) return Result.Failure<PagedDto<PortalTitleDto>>(opened.Error);
        var door = opened.Value; door.Enter();

        if (!door.Settings.PublicCatalogue)
        {
            var found = await PortalGate.MemberAsync(db, security, door, q.Token, tracked: false, ct);
            if (found.IsFailure) return Result.Failure<PagedDto<PortalTitleDto>>(found.Error);
        }

        // Only what a member could actually borrow: lost, withdrawn and damaged copies are not stock.
        var copies = db.Copies.AsNoTracking().Where(c => !c.IsDeleted
            && c.Status != CopyStatus.Lost && c.Status != CopyStatus.Withdrawn && c.Status != CopyStatus.Damaged);

        var titles = db.Titles.AsNoTracking().Where(t => !t.IsDeleted && copies.Any(c => c.TitleId == t.Id));
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            if (s.Length > 100) s = s[..100];
            titles = titles.Where(t =>
                t.Title.Contains(s) || t.Authors.Contains(s)
                || (t.Subtitle != null && t.Subtitle.Contains(s))
                || (t.Isbn != null && t.Isbn.Contains(s))
                || (t.Category != null && t.Category.Contains(s)));
        }

        var total = await titles.CountAsync(ct);
        var page  = Math.Clamp(q.Page, 1, 500);
        var rows  = await titles.OrderBy(t => t.Title).Skip((page - 1) * PageSize).Take(PageSize).ToListAsync(ct);
        if (rows.Count == 0) return Result.Success(new PagedDto<PortalTitleDto>([], total));

        var ids = rows.Select(t => t.Id).ToList();
        var stock = await copies.Where(c => ids.Contains(c.TitleId))
            .GroupBy(c => new { c.TitleId, c.BranchId })
            .Select(g => new
            {
                g.Key.TitleId, g.Key.BranchId,
                Copies    = g.Count(),
                Available = g.Count(c => c.Status == CopyStatus.Available),
            }).ToListAsync(ct);

        var waiting = await db.Reservations.AsNoTracking()
            .Where(r => ids.Contains(r.TitleId) && r.Status == ReservationStatus.Waiting)
            .GroupBy(r => r.TitleId).Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);

        var names = await LibraryRules.BranchNamesAsync(db, ct);

        var items = rows.Select(t =>
        {
            var mine = stock.Where(s => s.TitleId == t.Id)
                .Select(s => new PortalBranchStockDto(s.BranchId, names.GetValueOrDefault(s.BranchId) ?? "—", s.Copies, s.Available))
                .OrderBy(s => s.BranchName).ToList();
            return new PortalTitleDto(
                t.Id, t.Title, t.Subtitle, t.Authors, t.Category, t.MaterialType, t.Publisher, t.PublicationYear,
                t.Language, t.Description, mine.Sum(s => s.Copies), mine.Sum(s => s.Available),
                waiting.GetValueOrDefault(t.Id), mine);
        }).ToList();

        return Result.Success(new PagedDto<PortalTitleDto>(items, total));
    }
}

internal sealed class PortalRenewHandler(LibraryDbContext db, IPortalSecurity security, ISender sender)
    : ICommandHandler<PortalRenewCommand, PortalLoanDto>
{
    public async Task<Result<PortalLoanDto>> Handle(PortalRenewCommand cmd, CancellationToken ct)
    {
        var opened = await PortalGate.OpenAsync(db, cmd.Slug, ct);
        if (opened.IsFailure) return Result.Failure<PortalLoanDto>(opened.Error);
        var door = opened.Value; door.Enter();

        var found = await PortalGate.MemberAsync(db, security, door, cmd.Token, tracked: false, ct);
        if (found.IsFailure) return Result.Failure<PortalLoanDto>(found.Error);

        if (!door.Settings.AllowRenewals)
            return Result.Failure<PortalLoanDto>(Error.Custom("Portal.Conflict",
                "Online renewals are switched off. Please ask at the library desk."));

        // Someone else's loan is reported as missing, not as forbidden.
        var memberId = found.Value.Id;
        if (!await db.Loans.AsNoTracking().AnyAsync(l => l.Id == cmd.LoanId && l.MemberId == memberId, ct))
            return Result.Failure<PortalLoanDto>(Error.NotFoundById("Loan", cmd.LoanId));

        // The desk's renewal, with all its rules: the limit, the queue, late days charged first.
        var renewed = await sender.Send(new RenewLoanCommand(cmd.LoanId, cmd.Today), ct);
        return renewed.IsSuccess
            ? Result.Success(PortalMappings.ToPortal(renewed.Value))
            : Result.Failure<PortalLoanDto>(renewed.Error);
    }
}

internal sealed class PortalReserveHandler(LibraryDbContext db, IPortalSecurity security, ISender sender)
    : ICommandHandler<PortalReserveCommand, PortalReservationDto>
{
    public async Task<Result<PortalReservationDto>> Handle(PortalReserveCommand cmd, CancellationToken ct)
    {
        var opened = await PortalGate.OpenAsync(db, cmd.Slug, ct);
        if (opened.IsFailure) return Result.Failure<PortalReservationDto>(opened.Error);
        var door = opened.Value; door.Enter();

        var found = await PortalGate.MemberAsync(db, security, door, cmd.Token, tracked: false, ct);
        if (found.IsFailure) return Result.Failure<PortalReservationDto>(found.Error);

        if (!door.Settings.AllowReservations)
            return Result.Failure<PortalReservationDto>(Error.Custom("Portal.Conflict",
                "Online reservations are switched off. Please ask at the library desk."));

        // The member is always the one signed in — never an id from the request.
        var reserved = await sender.Send(
            new CreateReservationCommand(cmd.TitleId, found.Value.Id, cmd.PickupBranchId, cmd.Today), ct);
        return reserved.IsSuccess
            ? Result.Success(PortalMappings.ToPortal(reserved.Value))
            : Result.Failure<PortalReservationDto>(reserved.Error);
    }
}

internal sealed class PortalCancelReservationHandler(LibraryDbContext db, IPortalSecurity security, ISender sender)
    : ICommandHandler<PortalCancelReservationCommand>
{
    public async Task<Result> Handle(PortalCancelReservationCommand cmd, CancellationToken ct)
    {
        var opened = await PortalGate.OpenAsync(db, cmd.Slug, ct);
        if (opened.IsFailure) return Result.Failure(opened.Error);
        var door = opened.Value; door.Enter();

        var found = await PortalGate.MemberAsync(db, security, door, cmd.Token, tracked: false, ct);
        if (found.IsFailure) return Result.Failure(found.Error);

        var memberId = found.Value.Id;
        if (!await db.Reservations.AsNoTracking().AnyAsync(r => r.Id == cmd.ReservationId && r.MemberId == memberId, ct))
            return Result.Failure(Error.NotFoundById("Reservation", cmd.ReservationId));

        return await sender.Send(new CancelReservationCommand(cmd.ReservationId, cmd.Today), ct);
    }
}
