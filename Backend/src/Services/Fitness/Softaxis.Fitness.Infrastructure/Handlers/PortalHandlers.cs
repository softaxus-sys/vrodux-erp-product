using MediatR;
using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Fitness.Application.Classes;
using Softaxis.Fitness.Application.Desk;
using Softaxis.Fitness.Application.Members;
using Softaxis.Fitness.Application.Portal;
using Softaxis.Fitness.Domain.Entities;
using Softaxis.Fitness.Infrastructure.Persistence;
using Softaxis.Fitness.Infrastructure.Services;

namespace Softaxis.Fitness.Infrastructure.Handlers;

// Staff side

internal static class PortalSettingsStore
{
    public static async Task<PortalSettings> GetOrCreateAsync(FitnessDbContext db, CancellationToken ct)
    {
        var settings = await db.PortalSettings.FirstOrDefaultAsync(ct);
        if (settings is not null) return settings;
        settings = new PortalSettings(enabled: false);
        db.PortalSettings.Add(settings);
        await db.SaveChangesAsync(ct);
        return settings;
    }

    public static async Task<PortalSettingsDto> ToDtoAsync(FitnessDbContext db, PortalSettings s, CancellationToken ct) =>
        new(s.Enabled, s.AllowBooking, await db.Members.CountAsync(m => !m.IsDeleted && m.PortalPinHash != null, ct));
}

internal sealed class GetPortalSettingsHandler(FitnessDbContext db) : IQueryHandler<GetPortalSettingsQuery, PortalSettingsDto>
{
    public async Task<Result<PortalSettingsDto>> Handle(GetPortalSettingsQuery q, CancellationToken ct) =>
        Result.Success(await PortalSettingsStore.ToDtoAsync(db, await PortalSettingsStore.GetOrCreateAsync(db, ct), ct));
}

internal sealed class UpdatePortalSettingsHandler(FitnessDbContext db) : ICommandHandler<UpdatePortalSettingsCommand, PortalSettingsDto>
{
    public async Task<Result<PortalSettingsDto>> Handle(UpdatePortalSettingsCommand c, CancellationToken ct)
    {
        var s = await PortalSettingsStore.GetOrCreateAsync(db, ct);
        s.Update(c.Enabled, c.AllowBooking);
        await db.SaveChangesAsync(ct);
        return Result.Success(await PortalSettingsStore.ToDtoAsync(db, s, ct));
    }
}

internal sealed class SetMemberPortalPinHandler(FitnessDbContext db, IPortalSecurity security)
    : ICommandHandler<SetMemberPortalPinCommand, MemberPortalPinDto>
{
    public async Task<Result<MemberPortalPinDto>> Handle(SetMemberPortalPinCommand c, CancellationToken ct)
    {
        var m = await db.Members.FirstOrDefaultAsync(x => x.Id == c.MemberId && !x.IsDeleted, ct);
        if (m is null) return Result.Failure<MemberPortalPinDto>(Fx.NotFound("Member"));
        // Only the hash is kept, so this reply is the one time the PIN can be read.
        var pin = security.NewPin();
        m.SetPortalPin(security.HashPin(pin));
        await db.SaveChangesAsync(ct);
        return Result.Success(new MemberPortalPinDto(m.MemberNumber, pin));
    }
}

internal sealed class ClearMemberPortalPinHandler(FitnessDbContext db) : ICommandHandler<ClearMemberPortalPinCommand>
{
    public async Task<Result> Handle(ClearMemberPortalPinCommand c, CancellationToken ct)
    {
        var m = await db.Members.FirstOrDefaultAsync(x => x.Id == c.MemberId && !x.IsDeleted, ct);
        if (m is null) return Result.Failure(Fx.NotFound("Member"));
        m.ClearPortalPin();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

// Member side: anonymous requests

/// <summary>A workspace whose portal is switched on.</summary>
internal sealed record PortalDoor(TenantLookup Tenant, PortalSettings Settings)
{
    /// <summary>
    /// Makes every Fitness query that follows belong to this workspace. An anonymous request has no
    /// tenant, and with no tenant the query filter lets every workspace through, so a handler must
    /// call this before it touches a Fitness table. Not async and not part of OpenAsync on purpose:
    /// a value set inside an awaited method is gone again when that method returns.
    /// </summary>
    public void Enter() => TenantAmbient.Set(Tenant.Id, isSuperAdmin: false, isResolved: true, Tenant.Currency);
}

internal static class PortalGate
{
    // The same answer whether the address is wrong or the portal is off.
    private static readonly Error NotOffered = Error.Custom("Portal.NotFound", "This gym does not offer online access.");
    public static readonly Error SignInAgain = Error.Custom("Portal.Unauthorized", "Please sign in again.");

    public static async Task<Result<PortalDoor>> OpenAsync(FitnessDbContext db, string? slug, CancellationToken ct)
    {
        var key = (slug ?? string.Empty).Trim().ToLowerInvariant();
        if (key.Length is 0 or > 100) return Result.Failure<PortalDoor>(NotOffered);

        var tenant = await db.TenantLookups.AsNoTracking().FirstOrDefaultAsync(t => t.Slug == key && !t.IsDeleted, ct);
        if (tenant is null || tenant.Status is "Suspended" or "Expired") return Result.Failure<PortalDoor>(NotOffered);

        TenantAmbient.Set(tenant.Id, isSuperAdmin: false, isResolved: true, tenant.Currency);
        var settings = await db.PortalSettings.AsNoTracking().FirstOrDefaultAsync(ct);
        return settings is { Enabled: true } ? Result.Success(new PortalDoor(tenant, settings)) : Result.Failure<PortalDoor>(NotOffered);
    }

    /// <summary>
    /// The member a session belongs to, read again on every request so a deleted member or a
    /// removed or changed PIN ends the session at once. Call after <see cref="PortalDoor.Enter"/>.
    /// </summary>
    public static async Task<Result<FitnessMember>> MemberAsync(
        FitnessDbContext db, IPortalSecurity security, PortalDoor door, string? token, bool tracked, CancellationToken ct)
    {
        var session = security.ReadToken(token);
        if (session is null || session.TenantId != door.Tenant.Id) return Result.Failure<FitnessMember>(SignInAgain);

        var members = tracked ? db.Members : db.Members.AsNoTracking();
        var member  = await members.FirstOrDefaultAsync(m => m.Id == session.MemberId && !m.IsDeleted, ct);
        if (member?.PortalPinHash is null || security.PinStamp(member.PortalPinHash) != session.PinStamp)
            return Result.Failure<FitnessMember>(SignInAgain);
        return Result.Success(member);
    }
}

internal sealed class GetPortalInfoHandler(FitnessDbContext db) : IQueryHandler<GetPortalInfoQuery, PortalInfoDto>
{
    public async Task<Result<PortalInfoDto>> Handle(GetPortalInfoQuery q, CancellationToken ct)
    {
        var opened = await PortalGate.OpenAsync(db, q.Slug, ct);
        if (opened.IsFailure) return Result.Failure<PortalInfoDto>(opened.Error);
        var door = opened.Value; door.Enter();
        return Result.Success(new PortalInfoDto(door.Tenant.Name, door.Settings.AllowBooking, door.Tenant.Currency));
    }
}

internal sealed class PortalSignInHandler(FitnessDbContext db, IPortalSecurity security) : ICommandHandler<PortalSignInCommand, PortalSessionDto>
{
    // One message for an unknown number, a member with no PIN and a wrong PIN.
    private static readonly Error Wrong = Error.Custom("Portal.Unauthorized", "Member number or PIN is not correct.");

    public async Task<Result<PortalSessionDto>> Handle(PortalSignInCommand c, CancellationToken ct)
    {
        var opened = await PortalGate.OpenAsync(db, c.Slug, ct);
        if (opened.IsFailure) return Result.Failure<PortalSessionDto>(opened.Error);
        var door = opened.Value; door.Enter();

        var number = c.MemberNumber.Trim();
        var member = await db.Members.FirstOrDefaultAsync(m => m.MemberNumber == number && !m.IsDeleted, ct);
        if (member?.PortalPinHash is null)
        {
            // Spend the same effort as a real check, so the reply time does not say which it was.
            security.HashPin(c.Pin);
            return Result.Failure<PortalSessionDto>(Wrong);
        }

        if (member.PortalLockedUntil is { } until && until > DateTime.UtcNow)
        {
            var minutes = Math.Max(1, (int)Math.Ceiling((until - DateTime.UtcNow).TotalMinutes));
            return Result.Failure<PortalSessionDto>(Error.Custom("Portal.Conflict",
                $"Too many wrong PINs. Try again in {minutes} minute{(minutes == 1 ? "" : "s")}, or ask at the front desk for a new PIN."));
        }

        if (!security.VerifyPin(c.Pin.Trim(), member.PortalPinHash))
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

internal sealed class PortalChangePinHandler(FitnessDbContext db, IPortalSecurity security) : ICommandHandler<PortalChangePinCommand, PortalSessionDto>
{
    public async Task<Result<PortalSessionDto>> Handle(PortalChangePinCommand c, CancellationToken ct)
    {
        var opened = await PortalGate.OpenAsync(db, c.Slug, ct);
        if (opened.IsFailure) return Result.Failure<PortalSessionDto>(opened.Error);
        var door = opened.Value; door.Enter();

        var found = await PortalGate.MemberAsync(db, security, door, c.Token, tracked: true, ct);
        if (found.IsFailure) return Result.Failure<PortalSessionDto>(found.Error);
        var member = found.Value;

        // Guesses at the current PIN count the same as guesses at sign-in.
        if (member.PortalLockedUntil is { } until && until > DateTime.UtcNow)
            return Result.Failure<PortalSessionDto>(Error.Custom("Portal.Conflict", "Too many wrong PINs. Please try again later."));
        if (!security.VerifyPin(c.CurrentPin.Trim(), member.PortalPinHash!))
        {
            member.RecordPortalFailure();
            await db.SaveChangesAsync(ct);
            return Result.Failure<PortalSessionDto>(Error.Custom("Portal.Conflict", "Your current PIN is not correct."));
        }

        member.SetPortalPin(security.HashPin(c.NewPin));
        await db.SaveChangesAsync(ct);
        var (token, expires) = security.CreateToken(door.Tenant.Id, member.Id, member.PortalPinHash!);
        return Result.Success(new PortalSessionDto(token, expires, member.FullName, member.MemberNumber));
    }
}

internal sealed class GetPortalAccountHandler(FitnessDbContext db, IPortalSecurity security, ISender sender)
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

        var detail = await sender.Send(new GetMemberQuery(member.Id, q.Today), ct);
        if (detail.IsFailure) return Result.Failure<PortalAccountDto>(detail.Error);
        var m = detail.Value;

        var payments = await sender.Send(new GetPaymentsQuery(member.Id, null, null, null, null, false, 1, 20), ct);
        var visits   = await sender.Send(new GetVisitsQuery(null, member.Id, null, null, false, false, 1, 15), ct);
        var bookings = await sender.Send(new GetBookingsQuery(null, member.Id, true, q.Today), ct);

        // Memberships that are cancelled are history the member does not need to see.
        var memberships = m.Subscriptions.Where(s => s.Status != SubscriptionStatus.Cancelled)
            .OrderByDescending(s => s.EndDate)
            .Select(s => new PortalMembershipDto(s.Id, s.PlanName, s.StartDate, s.EndDate, s.State,
                s.ClassCreditsLeft, s.PtSessionsLeft, s.Balance, s.FrozenFrom)).ToList();

        return Result.Success(new PortalAccountDto(m.FullName, m.MemberNumber, m.Status, m.HomeBranchName, m.TrainerName,
            m.Balance, m.Visits30Days, m.LastVisit, memberships,
            bookings.IsSuccess ? bookings.Value.Where(b => b.Status is BookingStatus.Booked or BookingStatus.Waitlisted)
                .Select(b => new PortalBookingDto(b.Id, b.SessionId, b.ClassName, b.Date, b.StartTime, b.Status, b.WaitlistPosition)).ToList() : [],
            payments.IsSuccess ? payments.Value.Items.Select(p => new PortalPaymentDto(p.ReceiptNumber, p.PaidOn, p.Amount, p.Method)).ToList() : [],
            visits.IsSuccess ? visits.Value.Items.Where(v => v.Allowed).Select(v => new PortalVisitDto(v.Date, v.CheckedInAt, v.BranchName)).ToList() : []));
    }
}

internal sealed class GetPortalClassesHandler(FitnessDbContext db, IPortalSecurity security, ISender sender)
    : IQueryHandler<GetPortalClassesQuery, IReadOnlyList<PortalClassDto>>
{
    public async Task<Result<IReadOnlyList<PortalClassDto>>> Handle(GetPortalClassesQuery q, CancellationToken ct)
    {
        var opened = await PortalGate.OpenAsync(db, q.Slug, ct);
        if (opened.IsFailure) return Result.Failure<IReadOnlyList<PortalClassDto>>(opened.Error);
        var door = opened.Value; door.Enter();
        var found = await PortalGate.MemberAsync(db, security, door, q.Token, tracked: false, ct);
        if (found.IsFailure) return Result.Failure<IReadOnlyList<PortalClassDto>>(found.Error);

        var today    = Fx.Today(q.Today);
        var settings = await Fx.SettingsAsync(db, ct);
        var sessions = await sender.Send(new GetSessionsQuery(today, Fx.Add(today, settings.BookingWindowDays), null, null, null, false), ct);
        if (sessions.IsFailure) return Result.Failure<IReadOnlyList<PortalClassDto>>(sessions.Error);
        var mine = await sender.Send(new GetBookingsQuery(null, found.Value.Id, true, today), ct);
        var mineIds = mine.IsSuccess
            ? mine.Value.Where(b => b.Status is BookingStatus.Booked or BookingStatus.Waitlisted).Select(b => b.SessionId).ToHashSet()
            : [];

        return Result.Success<IReadOnlyList<PortalClassDto>>(sessions.Value
            .Where(s => s.Status == SessionStatus.Scheduled)
            .OrderBy(s => s.Date).ThenBy(s => s.StartTime)
            .Select(s => new PortalClassDto(s.Id, s.ClassName, s.TrainerName, s.BranchName, s.Date, s.StartTime, s.EndTime,
                Math.Max(0, s.Capacity - s.Booked), s.Waitlisted, mineIds.Contains(s.Id))).ToList());
    }
}

internal sealed class PortalBookClassHandler(FitnessDbContext db, IPortalSecurity security, ISender sender)
    : ICommandHandler<PortalBookClassCommand, PortalBookingDto>
{
    public async Task<Result<PortalBookingDto>> Handle(PortalBookClassCommand c, CancellationToken ct)
    {
        var opened = await PortalGate.OpenAsync(db, c.Slug, ct);
        if (opened.IsFailure) return Result.Failure<PortalBookingDto>(opened.Error);
        var door = opened.Value; door.Enter();
        if (!door.Settings.AllowBooking)
            return Result.Failure<PortalBookingDto>(Error.Custom("Portal.Conflict", "Booking online is switched off. Please book at the front desk."));
        var found = await PortalGate.MemberAsync(db, security, door, c.Token, tracked: false, ct);
        if (found.IsFailure) return Result.Failure<PortalBookingDto>(found.Error);

        // The member always comes from the session, never from the request, and goes through the
        // desk's own command, so every class rule applies online exactly as it does at the desk.
        var booked = await sender.Send(new BookClassCommand(c.SessionId, found.Value.Id, true, c.Today, c.LocalTime), ct);
        if (booked.IsFailure) return Result.Failure<PortalBookingDto>(booked.Error);
        var b = booked.Value;
        return Result.Success(new PortalBookingDto(b.Id, b.SessionId, b.ClassName, b.Date, b.StartTime, b.Status, b.WaitlistPosition));
    }
}

internal sealed class PortalCancelBookingHandler(FitnessDbContext db, IPortalSecurity security, ISender sender)
    : ICommandHandler<PortalCancelBookingCommand>
{
    public async Task<Result> Handle(PortalCancelBookingCommand c, CancellationToken ct)
    {
        var opened = await PortalGate.OpenAsync(db, c.Slug, ct);
        if (opened.IsFailure) return Result.Failure(opened.Error);
        var door = opened.Value; door.Enter();
        var found = await PortalGate.MemberAsync(db, security, door, c.Token, tracked: false, ct);
        if (found.IsFailure) return Result.Failure(found.Error);

        // Someone else's booking looks exactly like one that does not exist.
        var own = await db.Bookings.AsNoTracking().AnyAsync(b => b.Id == c.BookingId && b.MemberId == found.Value.Id, ct);
        if (!own) return Result.Failure(Fx.NotFound("Booking"));

        var cancelled = await sender.Send(new CancelBookingCommand(c.BookingId, c.Today, c.LocalTime), ct);
        return cancelled.IsFailure ? Result.Failure(cancelled.Error) : Result.Success();
    }
}
