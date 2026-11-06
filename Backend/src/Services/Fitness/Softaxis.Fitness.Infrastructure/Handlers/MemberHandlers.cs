using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Fitness.Application.Abstractions;
using Softaxis.Fitness.Application.Members;
using Softaxis.Fitness.Domain.Entities;
using Softaxis.Fitness.Infrastructure.Persistence;

namespace Softaxis.Fitness.Infrastructure.Handlers;

internal static class MemberReader
{
    public static async Task<MemberDetailDto> DetailAsync(FitnessDbContext db, FitnessMember m, string today, CancellationToken ct)
    {
        var subs = await db.Subscriptions.AsNoTracking().Where(s => !s.IsDeleted && s.MemberId == m.Id)
            .OrderByDescending(s => s.StartDate).ToListAsync(ct);
        var subIds = subs.Select(s => s.Id).ToList();
        var freezes = await db.Freezes.AsNoTracking().Where(f => subIds.Contains(f.SubscriptionId))
            .OrderByDescending(f => f.FromDate).ToListAsync(ct);

        var branches = await Fx.BranchNamesAsync(db, ct);
        var trainers = await Fx.TrainerNamesAsync(db, ct);
        var balance = (await Fx.BalancesAsync(db, [m.Id], ct)).GetValueOrDefault(m.Id);

        var since = Fx.Add(today, -30);
        var visits = await db.CheckIns.AsNoTracking()
            .Where(c => c.MemberId == m.Id && c.Allowed && !c.IsGuest && string.Compare(c.Date, since) >= 0).CountAsync(ct);
        var last = await db.CheckIns.AsNoTracking().Where(c => c.MemberId == m.Id && c.Allowed && !c.IsGuest)
            .OrderByDescending(c => c.CheckedInAt).Select(c => c.Date).FirstOrDefaultAsync(ct);
        var locker = await db.Lockers.AsNoTracking().Where(l => !l.IsDeleted && l.MemberId == m.Id)
            .Select(l => l.Number).FirstOrDefaultAsync(ct);

        return new MemberDetailDto(m.Id, m.MemberNumber, m.FirstName, m.LastName ?? "", m.FullName, m.Gender,
            m.DateOfBirth, m.Phone, m.Email, m.Address, m.NationalId, m.EmergencyName, m.EmergencyPhone,
            m.HealthNotes, m.FitnessGoal, m.Source, m.ReferredBy, m.Notes, m.PhotoData,
            m.HomeBranchId ?? Guid.Empty, m.HomeBranchId is { } b ? branches.GetValueOrDefault(b) : null,
            m.TrainerId, m.TrainerId is { } t ? trainers.GetValueOrDefault(t) : null, m.JoinedOn, m.WaiverSignedOn,
            m.Status, m.StatusReason, balance, visits, last,
            subs.Select(s => Fx.ToDto(s, today)).ToList(),
            freezes.Select(f => new FreezeDto(f.Id, f.SubscriptionId, f.FromDate, f.ToDate, f.Days, f.Reason)).ToList(),
            locker, m.PortalPinHash != null);
    }

    public static async Task<Result<Subscription>> LoadSubAsync(FitnessDbContext db, Guid id, CancellationToken ct)
    {
        var s = await db.Subscriptions.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, ct);
        return s is null ? Result.Failure<Subscription>(Fx.NotFound("Membership")) : Result.Success(s);
    }
}

// ── Members ─────────────────────────────────────────────────────────────────

internal sealed class GetMembersHandler(FitnessDbContext db) : IQueryHandler<GetMembersQuery, MemberPageDto>
{
    public async Task<Result<MemberPageDto>> Handle(GetMembersQuery q, CancellationToken ct)
    {
        var today = Fx.Today(q.Today);
        var settings = await Fx.SettingsAsync(db, ct);

        var members = db.Members.AsNoTracking().Where(m => !m.IsDeleted);
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            members = members.Where(m => m.FirstName.Contains(s) || (m.LastName != null && m.LastName.Contains(s))
                || m.MemberNumber.Contains(s) || (m.Phone != null && m.Phone.Contains(s))
                || (m.Email != null && m.Email.Contains(s)));
        }
        if (q.BranchId is { } branch) members = members.Where(m => m.HomeBranchId == branch);
        if (q.State == "inactive") members = members.Where(m => m.Status != MemberStatus.Active);

        var list = await members.OrderBy(m => m.FirstName).ThenBy(m => m.LastName).ToListAsync(ct);
        var ids = list.Select(m => m.Id).ToList();
        var subs = (await db.Subscriptions.AsNoTracking().Where(s => !s.IsDeleted && ids.Contains(s.MemberId)).ToListAsync(ct))
            .GroupBy(s => s.MemberId).ToDictionary(g => g.Key, g => g.ToList());
        var balances = await Fx.BalancesAsync(db, ids, ct);
        var branches = await Fx.BranchNamesAsync(db, ct);

        var rows = list.Select(m =>
        {
            var cur = Fx.Current(subs.GetValueOrDefault(m.Id) ?? [], today);
            var state = Fx.MembershipState(cur, today, settings.ExpiringWithinDays);
            return (m, cur, state);
        }).ToList();

        if (q.PlanId is { } plan) rows = rows.Where(r => r.cur?.PlanId == plan).ToList();
        if (!string.IsNullOrWhiteSpace(q.State) && q.State != "inactive")
            rows = rows.Where(r => q.State == "all" || r.state == q.State).ToList();

        var page = Math.Max(1, q.Page);
        var size = Math.Clamp(q.PageSize, 1, 200);
        var items = rows.Skip((page - 1) * size).Take(size).Select(r => new MemberSummaryDto(
            r.m.Id, r.m.MemberNumber, r.m.FullName, r.m.Phone, r.m.Email, r.m.Gender,
            r.m.HomeBranchId ?? Guid.Empty, r.m.HomeBranchId is { } b ? branches.GetValueOrDefault(b) : null,
            r.m.Status, r.cur?.PlanName, r.cur?.EndDate, r.state,
            r.cur is null ? null : Fx.DaysBetween(today, r.cur.EndDate),
            balances.GetValueOrDefault(r.m.Id), r.m.JoinedOn, r.m.PhotoData != null)).ToList();

        return Result.Success(new MemberPageDto(items, rows.Count, page, size));
    }
}

internal sealed class GetMemberHandler(FitnessDbContext db) : IQueryHandler<GetMemberQuery, MemberDetailDto>
{
    public async Task<Result<MemberDetailDto>> Handle(GetMemberQuery q, CancellationToken ct)
    {
        var m = await db.Members.AsNoTracking().FirstOrDefaultAsync(x => x.Id == q.Id && !x.IsDeleted, ct);
        return m is null ? Result.Failure<MemberDetailDto>(Fx.NotFound("Member"))
                         : Result.Success(await MemberReader.DetailAsync(db, m, Fx.Today(q.Today), ct));
    }
}

internal sealed class CreateMemberHandler(FitnessDbContext db) : ICommandHandler<CreateMemberCommand, MemberDetailDto>
{
    public async Task<Result<MemberDetailDto>> Handle(CreateMemberCommand c, CancellationToken ct)
    {
        var i = c.Member;
        var today = Fx.Today(c.Today);
        var settings = await Fx.SettingsAsync(db, ct);

        if (!string.IsNullOrWhiteSpace(i.Email)
            && await db.Members.AnyAsync(m => !m.IsDeleted && m.Email == i.Email!.Trim().ToLower(), ct))
            return Result.Failure<MemberDetailDto>(Error.Custom("Member.Duplicate", "A member with this email already exists."));
        if (!string.IsNullOrWhiteSpace(i.Phone)
            && await db.Members.AnyAsync(m => !m.IsDeleted && m.Phone == i.Phone!.Trim(), ct))
            return Result.Failure<MemberDetailDto>(Error.Custom("Member.Duplicate", "A member with this phone number already exists."));
        if (settings.RequireWaiver && string.IsNullOrWhiteSpace(i.WaiverSignedOn))
            return Result.Failure<MemberDetailDto>(Error.Custom("Member.Conflict", "A signed waiver is required before joining."));

        var branches = await Fx.BranchesAsync(db, ct);
        var branchId = i.HomeBranchId ?? branches[0].Id;
        if (branches.All(b => b.Id != branchId)) return Result.Failure<MemberDetailDto>(Fx.NotFound("Branch"));

        var number = $"{settings.MemberNumberPrefix}-{await Fx.NextAsync(db, "member", ct):D5}";
        var m = new FitnessMember(number, i.FirstName, i.LastName, branchId, Dates.Valid(i.JoinedOn) ? i.JoinedOn! : today);
        m.Update(i.FirstName, i.LastName, i.Gender, i.DateOfBirth, i.Phone, i.Email, i.Address, i.NationalId,
            i.EmergencyName, i.EmergencyPhone, i.HealthNotes, i.FitnessGoal, i.Source, i.ReferredBy, i.Notes,
            branchId, i.TrainerId, i.WaiverSignedOn);
        if (!string.IsNullOrEmpty(i.PhotoData)) m.SetPhoto(i.PhotoData);
        db.Members.Add(m);

        if (c.LeadId is { } leadId)
        {
            var lead = await db.Leads.FirstOrDefaultAsync(l => l.Id == leadId && !l.IsDeleted, ct);
            if (lead is not null) { lead.Convert(m.Id); m.LinkLead(lead.Id); }
        }
        await db.SaveChangesAsync(ct);
        return Result.Success(await MemberReader.DetailAsync(db, m, today, ct));
    }
}

internal sealed class UpdateMemberHandler(FitnessDbContext db) : ICommandHandler<UpdateMemberCommand, MemberDetailDto>
{
    public async Task<Result<MemberDetailDto>> Handle(UpdateMemberCommand c, CancellationToken ct)
    {
        var m = await db.Members.FirstOrDefaultAsync(x => x.Id == c.Id && !x.IsDeleted, ct);
        if (m is null) return Result.Failure<MemberDetailDto>(Fx.NotFound("Member"));
        var i = c.Member;

        if (!string.IsNullOrWhiteSpace(i.Email)
            && await db.Members.AnyAsync(x => !x.IsDeleted && x.Id != m.Id && x.Email == i.Email!.Trim().ToLower(), ct))
            return Result.Failure<MemberDetailDto>(Error.Custom("Member.Duplicate", "Another member already uses this email."));

        m.Update(i.FirstName, i.LastName, i.Gender, i.DateOfBirth, i.Phone, i.Email, i.Address, i.NationalId,
            i.EmergencyName, i.EmergencyPhone, i.HealthNotes, i.FitnessGoal, i.Source, i.ReferredBy, i.Notes,
            i.HomeBranchId ?? m.HomeBranchId, i.TrainerId, i.WaiverSignedOn);
        // A photo is only replaced when one is sent, so saving the form never wipes it.
        if (!string.IsNullOrEmpty(i.PhotoData)) m.SetPhoto(i.PhotoData);
        await db.SaveChangesAsync(ct);
        return Result.Success(await MemberReader.DetailAsync(db, m, Fx.Today(c.Today), ct));
    }
}

internal sealed class SetMemberStatusHandler(FitnessDbContext db) : ICommandHandler<SetMemberStatusCommand>
{
    public async Task<Result> Handle(SetMemberStatusCommand c, CancellationToken ct)
    {
        var m = await db.Members.FirstOrDefaultAsync(x => x.Id == c.Id && !x.IsDeleted, ct);
        if (m is null) return Result.Failure(Fx.NotFound("Member"));
        m.SetStatus(c.Status, c.Reason);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class DeleteMemberHandler(FitnessDbContext db) : ICommandHandler<DeleteMemberCommand>
{
    public async Task<Result> Handle(DeleteMemberCommand c, CancellationToken ct)
    {
        var m = await db.Members.FirstOrDefaultAsync(x => x.Id == c.Id && !x.IsDeleted, ct);
        if (m is null) return Result.Failure(Fx.NotFound("Member"));
        // Money history must stay explainable: a member with payments is deactivated, not deleted.
        if (await db.Payments.AnyAsync(p => p.MemberId == m.Id && !p.IsVoided, ct))
            return Result.Failure(Fx.Conflict("Member", "This member has payments on record. Mark them inactive instead of deleting."));
        m.Delete();
        foreach (var l in await db.Lockers.Where(l => l.MemberId == m.Id).ToListAsync(ct)) l.Release();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

// ── Memberships ─────────────────────────────────────────────────────────────

internal sealed class SellMembershipHandler(FitnessDbContext db, ICurrentUser user)
    : ICommandHandler<SellMembershipCommand, SubscriptionDto>
{
    public async Task<Result<SubscriptionDto>> Handle(SellMembershipCommand c, CancellationToken ct)
    {
        var today = Fx.Today(c.Today);
        var member = await db.Members.FirstOrDefaultAsync(m => m.Id == c.MemberId && !m.IsDeleted, ct);
        if (member is null) return Result.Failure<SubscriptionDto>(Fx.NotFound("Member"));
        if (member.Status == MemberStatus.Blacklisted)
            return Result.Failure<SubscriptionDto>(Fx.Conflict("Member", "This member is blacklisted."));

        var plan = await db.Plans.FirstOrDefaultAsync(p => p.Id == c.PlanId && !p.IsDeleted, ct);
        if (plan is null) return Result.Failure<SubscriptionDto>(Fx.NotFound("Plan"));
        if (!plan.IsActive) return Result.Failure<SubscriptionDto>(Fx.Conflict("Plan", "This plan is switched off."));

        string start = Dates.Valid(c.StartDate) ? c.StartDate! : today;
        Subscription? renewed = null;
        if (c.RenewFromId is { } rid)
        {
            renewed = await db.Subscriptions.FirstOrDefaultAsync(s => s.Id == rid && s.MemberId == member.Id && !s.IsDeleted, ct);
            if (renewed is null) return Result.Failure<SubscriptionDto>(Fx.NotFound("Membership"));
            // A renewal starts the day after the old one ends, so no paid day is lost or double-sold.
            var next = Fx.Add(renewed.EndDate, 1);
            if (string.CompareOrdinal(next, start) > 0 && !Dates.Valid(c.StartDate)) start = next;
        }

        var price = c.Price ?? plan.Price;
        if (c.Discount > price) return Result.Failure<SubscriptionDto>(Fx.Conflict("Membership", "The discount is more than the price."));
        var joining = c.ChargeJoiningFee && renewed is null ? plan.JoiningFee : 0m;

        var sub = new Subscription(member.Id, plan, c.BranchId ?? member.HomeBranchId, start, price, c.Discount, joining,
            renewed?.Id, user.Id, user.Name, c.Notes);
        sub.SetEndDate(Fx.Add(start, plan.DurationDays - 1));
        if (c.AmountPaid > sub.Total) return Result.Failure<SubscriptionDto>(Fx.Conflict("Membership", "The amount paid is more than the total."));
        db.Subscriptions.Add(sub);

        if (c.AmountPaid > 0)
        {
            sub.AddPayment(c.AmountPaid);
            db.Payments.Add(new FitnessPayment(await ReceiptAsync(ct), member.Id, sub.Id, null, sub.BranchId, c.AmountPaid,
                c.PaymentMethod!, today, c.PaymentReference, null, user.Id, user.Name));
        }
        await db.SaveChangesAsync(ct);
        return Result.Success(Fx.ToDto(sub, today));
    }

    private async Task<string> ReceiptAsync(CancellationToken ct) => $"RCT-{await Fx.NextAsync(db, "receipt", ct):D6}";
}

internal sealed class FreezeMembershipHandler(FitnessDbContext db) : ICommandHandler<FreezeMembershipCommand, SubscriptionDto>
{
    public async Task<Result<SubscriptionDto>> Handle(FreezeMembershipCommand c, CancellationToken ct)
    {
        var today = Fx.Today(c.Today);
        var load = await MemberReader.LoadSubAsync(db, c.SubscriptionId, ct);
        if (load.IsFailure) return Result.Failure<SubscriptionDto>(load.Error);
        var s = load.Value;

        if (Fx.State(s, today) != "active") return Result.Failure<SubscriptionDto>(Fx.Conflict("Membership", "Only a running membership can be frozen."));
        if (!s.AllowFreeze) return Result.Failure<SubscriptionDto>(Fx.Conflict("Membership", "This plan does not allow freezing."));
        if (s.FreezeDaysUsed >= s.MaxFreezeDays)
            return Result.Failure<SubscriptionDto>(Fx.Conflict("Membership", "All freeze days for this membership are used."));

        var from = Dates.Valid(c.FromDate) ? c.FromDate! : today;
        s.Freeze(from);
        db.Freezes.Add(new FreezePeriod(s.Id, from, c.Reason));
        await db.SaveChangesAsync(ct);
        return Result.Success(Fx.ToDto(s, today));
    }
}

internal sealed class UnfreezeMembershipHandler(FitnessDbContext db) : ICommandHandler<UnfreezeMembershipCommand, SubscriptionDto>
{
    public async Task<Result<SubscriptionDto>> Handle(UnfreezeMembershipCommand c, CancellationToken ct)
    {
        var today = Fx.Today(c.Today);
        var load = await MemberReader.LoadSubAsync(db, c.SubscriptionId, ct);
        if (load.IsFailure) return Result.Failure<SubscriptionDto>(load.Error);
        var s = load.Value;
        if (s.Status != SubscriptionStatus.Frozen || s.FrozenFrom is null)
            return Result.Failure<SubscriptionDto>(Fx.Conflict("Membership", "This membership is not frozen."));

        // Only the freeze days the plan allows are given back; staying frozen longer does not extend it further.
        var frozen = Math.Max(0, Fx.DaysBetween(s.FrozenFrom, today));
        var credit = Math.Min(frozen, Math.Max(0, s.MaxFreezeDays - s.FreezeDaysUsed));
        var open = await db.Freezes.Where(f => f.SubscriptionId == s.Id && f.ToDate == null).ToListAsync(ct);
        foreach (var f in open) f.End(today, credit);

        s.Unfreeze(credit, Fx.Add(s.EndDate, credit));
        await db.SaveChangesAsync(ct);
        return Result.Success(Fx.ToDto(s, today));
    }
}

internal sealed class CancelMembershipHandler(FitnessDbContext db) : ICommandHandler<CancelMembershipCommand, SubscriptionDto>
{
    public async Task<Result<SubscriptionDto>> Handle(CancelMembershipCommand c, CancellationToken ct)
    {
        var today = Fx.Today(c.Today);
        var load = await MemberReader.LoadSubAsync(db, c.SubscriptionId, ct);
        if (load.IsFailure) return Result.Failure<SubscriptionDto>(load.Error);
        var s = load.Value;
        if (s.Status == SubscriptionStatus.Cancelled) return Result.Failure<SubscriptionDto>(Fx.Conflict("Membership", "Already cancelled."));

        foreach (var f in await db.Freezes.Where(f => f.SubscriptionId == s.Id && f.ToDate == null).ToListAsync(ct)) f.End(today, 0);
        s.Cancel(today, c.Reason);
        await db.SaveChangesAsync(ct);
        return Result.Success(Fx.ToDto(s, today));
    }
}

internal sealed class AdjustMembershipHandler(FitnessDbContext db) : ICommandHandler<AdjustMembershipCommand, SubscriptionDto>
{
    public async Task<Result<SubscriptionDto>> Handle(AdjustMembershipCommand c, CancellationToken ct)
    {
        var load = await MemberReader.LoadSubAsync(db, c.SubscriptionId, ct);
        if (load.IsFailure) return Result.Failure<SubscriptionDto>(load.Error);
        var s = load.Value;
        if (c.Discount > s.Price) return Result.Failure<SubscriptionDto>(Fx.Conflict("Membership", "The discount is more than the price."));
        s.ChangeDiscount(c.Discount);
        if (Dates.Valid(c.EndDate))
        {
            if (string.CompareOrdinal(c.EndDate, s.StartDate) < 0)
                return Result.Failure<SubscriptionDto>(Fx.Conflict("Membership", "The end date is before the start."));
            s.SetEndDate(c.EndDate!);
        }
        await db.SaveChangesAsync(ct);
        return Result.Success(Fx.ToDto(s, Fx.Today(null)));
    }
}

// ── Payments ────────────────────────────────────────────────────────────────

internal static class PaymentReader
{
    public static PaymentDto ToDto(FitnessPayment p, FitnessMember? m) => new(p.Id, p.ReceiptNumber, p.MemberId,
        m?.FullName, m?.MemberNumber, p.SubscriptionId, p.PtPackageId, p.BranchId, p.Amount, p.Method, p.PaidOn,
        p.Reference, p.Notes, p.ReceivedByName, p.IsVoided, p.VoidReason, p.VoidedByName, p.CreatedAt);
}

internal sealed class GetPaymentsHandler(FitnessDbContext db) : IQueryHandler<GetPaymentsQuery, PaymentPageDto>
{
    public async Task<Result<PaymentPageDto>> Handle(GetPaymentsQuery q, CancellationToken ct)
    {
        var pays = db.Payments.AsNoTracking().AsQueryable();
        if (!q.IncludeVoided) pays = pays.Where(p => !p.IsVoided);
        if (q.MemberId is { } mid) pays = pays.Where(p => p.MemberId == mid);
        if (Dates.Valid(q.From)) pays = pays.Where(p => string.Compare(p.PaidOn, q.From) >= 0);
        if (Dates.Valid(q.To)) pays = pays.Where(p => string.Compare(p.PaidOn, q.To) <= 0);
        if (!string.IsNullOrWhiteSpace(q.Method)) pays = pays.Where(p => p.Method == q.Method);
        if (q.BranchId is { } b) pays = pays.Where(p => p.BranchId == b);

        var total = await pays.CountAsync(ct);
        var sum = await pays.Where(p => !p.IsVoided).SumAsync(p => (decimal?)p.Amount, ct) ?? 0m;
        var page = Math.Max(1, q.Page);
        var rows = await pays.OrderByDescending(p => p.PaidOn).ThenByDescending(p => p.CreatedAt)
            .Skip((page - 1) * q.PageSize).Take(Math.Clamp(q.PageSize, 1, 500)).ToListAsync(ct);
        var ids = rows.Select(r => r.MemberId).Distinct().ToList();
        var members = await db.Members.AsNoTracking().IgnoreQueryFilters().Where(m => ids.Contains(m.Id)).ToDictionaryAsync(m => m.Id, ct);

        return Result.Success(new PaymentPageDto(rows.Select(p => PaymentReader.ToDto(p, members.GetValueOrDefault(p.MemberId))).ToList(), total, sum));
    }
}

internal sealed class RecordPaymentHandler(FitnessDbContext db, ICurrentUser user) : ICommandHandler<RecordPaymentCommand, PaymentDto>
{
    public async Task<Result<PaymentDto>> Handle(RecordPaymentCommand c, CancellationToken ct)
    {
        var member = await db.Members.FirstOrDefaultAsync(m => m.Id == c.MemberId && !m.IsDeleted, ct);
        if (member is null) return Result.Failure<PaymentDto>(Fx.NotFound("Member"));

        Guid? branch = c.BranchId ?? member.HomeBranchId;
        if (c.SubscriptionId is { } sid)
        {
            var s = await db.Subscriptions.FirstOrDefaultAsync(x => x.Id == sid && x.MemberId == member.Id && !x.IsDeleted, ct);
            if (s is null) return Result.Failure<PaymentDto>(Fx.NotFound("Membership"));
            if (s.Status == SubscriptionStatus.Cancelled) return Result.Failure<PaymentDto>(Fx.Conflict("Payment", "This membership is cancelled."));
            if (c.Amount > s.Balance) return Result.Failure<PaymentDto>(Fx.Conflict("Payment", $"The balance is only {s.Balance:0.##}."));
            s.AddPayment(c.Amount);
            branch ??= s.BranchId;
        }
        else if (c.PtPackageId is { } pid)
        {
            var p = await db.PtPackages.FirstOrDefaultAsync(x => x.Id == pid && x.MemberId == member.Id && !x.IsDeleted, ct);
            if (p is null) return Result.Failure<PaymentDto>(Fx.NotFound("Training package"));
            if (p.IsCancelled) return Result.Failure<PaymentDto>(Fx.Conflict("Payment", "This package is cancelled."));
            if (c.Amount > p.Balance) return Result.Failure<PaymentDto>(Fx.Conflict("Payment", $"The balance is only {p.Balance:0.##}."));
            p.AddPayment(c.Amount);
        }

        var pay = new FitnessPayment($"RCT-{await Fx.NextAsync(db, "receipt", ct):D6}", member.Id, c.SubscriptionId, c.PtPackageId,
            branch, c.Amount, c.Method, Dates.Valid(c.PaidOn) ? c.PaidOn! : Fx.Today(c.Today), c.Reference, c.Notes, user.Id, user.Name);
        db.Payments.Add(pay);
        await db.SaveChangesAsync(ct);
        return Result.Success(PaymentReader.ToDto(pay, member));
    }
}

internal sealed class VoidPaymentHandler(FitnessDbContext db, ICurrentUser user) : ICommandHandler<VoidPaymentCommand, PaymentDto>
{
    public async Task<Result<PaymentDto>> Handle(VoidPaymentCommand c, CancellationToken ct)
    {
        var p = await db.Payments.FirstOrDefaultAsync(x => x.Id == c.Id, ct);
        if (p is null) return Result.Failure<PaymentDto>(Fx.NotFound("Payment"));
        if (p.IsVoided) return Result.Failure<PaymentDto>(Fx.Conflict("Payment", "Already voided."));

        // A void puts the money back on the balance it was paid against.
        if (p.SubscriptionId is { } sid) (await db.Subscriptions.FirstOrDefaultAsync(s => s.Id == sid, ct))?.RemovePayment(p.Amount);
        if (p.PtPackageId is { } pid) (await db.PtPackages.FirstOrDefaultAsync(x => x.Id == pid, ct))?.RemovePayment(p.Amount);
        p.Void(c.Reason, user.Name);
        await db.SaveChangesAsync(ct);
        var m = await db.Members.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == p.MemberId, ct);
        return Result.Success(PaymentReader.ToDto(p, m));
    }
}

// ── Progress ────────────────────────────────────────────────────────────────

internal static class MeasurementReader
{
    public static MeasurementDto ToDto(BodyMeasurement m) => new(m.Id, m.MemberId, m.MeasuredOn, m.WeightKg, m.HeightCm,
        m.BodyFatPct, m.MuscleMassKg, m.ChestCm, m.WaistCm, m.HipsCm, m.ArmCm, m.ThighCm, m.RestingHeartRate,
        m.BloodPressure, m.Notes, m.Bmi, m.TrainerId);
}

internal sealed class GetMeasurementsHandler(FitnessDbContext db) : IQueryHandler<GetMeasurementsQuery, IReadOnlyList<MeasurementDto>>
{
    public async Task<Result<IReadOnlyList<MeasurementDto>>> Handle(GetMeasurementsQuery q, CancellationToken ct) =>
        Result.Success<IReadOnlyList<MeasurementDto>>((await db.Measurements.AsNoTracking()
            .Where(m => m.MemberId == q.MemberId).OrderByDescending(m => m.MeasuredOn).ToListAsync(ct))
            .Select(MeasurementReader.ToDto).ToList());
}

internal sealed class SaveMeasurementHandler(FitnessDbContext db) : ICommandHandler<SaveMeasurementCommand, MeasurementDto>
{
    public async Task<Result<MeasurementDto>> Handle(SaveMeasurementCommand c, CancellationToken ct)
    {
        if (!await db.Members.AnyAsync(m => m.Id == c.MemberId && !m.IsDeleted, ct))
            return Result.Failure<MeasurementDto>(Fx.NotFound("Member"));
        BodyMeasurement? m;
        if (c.Id is { } id)
        {
            m = await db.Measurements.FirstOrDefaultAsync(x => x.Id == id && x.MemberId == c.MemberId, ct);
            if (m is null) return Result.Failure<MeasurementDto>(Fx.NotFound("Measurement"));
        }
        else { m = new BodyMeasurement(c.MemberId, c.MeasuredOn, c.TrainerId); db.Measurements.Add(m); }
        m.Update(c.MeasuredOn, c.WeightKg, c.HeightCm, c.BodyFatPct, c.MuscleMassKg, c.ChestCm, c.WaistCm, c.HipsCm,
            c.ArmCm, c.ThighCm, c.RestingHeartRate, c.BloodPressure, c.Notes);
        await db.SaveChangesAsync(ct);
        return Result.Success(MeasurementReader.ToDto(m));
    }
}

internal sealed class DeleteMeasurementHandler(FitnessDbContext db) : ICommandHandler<DeleteMeasurementCommand>
{
    public async Task<Result> Handle(DeleteMeasurementCommand c, CancellationToken ct)
    {
        var m = await db.Measurements.FirstOrDefaultAsync(x => x.Id == c.Id, ct);
        if (m is null) return Result.Failure(Fx.NotFound("Measurement"));
        db.Measurements.Remove(m);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

// ── Workout / diet programs ─────────────────────────────────────────────────

internal static class ProgramReader
{
    public static async Task<ProgramDto> ToDtoAsync(FitnessDbContext db, FitnessProgram p, CancellationToken ct)
    {
        var member = p.MemberId is { } m ? await db.Members.AsNoTracking().FirstOrDefaultAsync(x => x.Id == m, ct) : null;
        var trainers = await Fx.TrainerNamesAsync(db, ct);
        return new ProgramDto(p.Id, p.Type, p.Name, p.Goal, p.Level, p.Weeks, p.Description, p.ItemsJson, p.MemberId,
            member?.FullName, p.TrainerId, p.TrainerId is { } t ? trainers.GetValueOrDefault(t) : null, p.TemplateId,
            p.StartDate, p.IsActive, p.CreatedAt);
    }
}

internal sealed class GetProgramsHandler(FitnessDbContext db) : IQueryHandler<GetProgramsQuery, IReadOnlyList<ProgramDto>>
{
    public async Task<Result<IReadOnlyList<ProgramDto>>> Handle(GetProgramsQuery q, CancellationToken ct)
    {
        var programs = db.Programs.AsNoTracking().Where(p => !p.IsDeleted);
        if (!string.IsNullOrWhiteSpace(q.Type)) programs = programs.Where(p => p.Type == q.Type);
        if (q.TemplatesOnly) programs = programs.Where(p => p.MemberId == null);
        else if (q.MemberId is { } mid) programs = programs.Where(p => p.MemberId == mid);

        var list = await programs.OrderByDescending(p => p.CreatedAt).ToListAsync(ct);
        var memberIds = list.Where(p => p.MemberId != null).Select(p => p.MemberId!.Value).Distinct().ToList();
        var members = await db.Members.AsNoTracking().Where(m => memberIds.Contains(m.Id)).ToDictionaryAsync(m => m.Id, m => m.FirstName + (m.LastName == null ? "" : " " + m.LastName), ct);
        var trainers = await Fx.TrainerNamesAsync(db, ct);

        return Result.Success<IReadOnlyList<ProgramDto>>(list.Select(p => new ProgramDto(p.Id, p.Type, p.Name, p.Goal,
            p.Level, p.Weeks, p.Description, p.ItemsJson, p.MemberId, p.MemberId is { } m ? members.GetValueOrDefault(m) : null,
            p.TrainerId, p.TrainerId is { } t ? trainers.GetValueOrDefault(t) : null, p.TemplateId, p.StartDate,
            p.IsActive, p.CreatedAt)).ToList());
    }
}

internal sealed class SaveProgramHandler(FitnessDbContext db) : ICommandHandler<SaveProgramCommand, ProgramDto>
{
    public async Task<Result<ProgramDto>> Handle(SaveProgramCommand c, CancellationToken ct)
    {
        FitnessProgram? p;
        if (c.Id is { } id)
        {
            p = await db.Programs.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, ct);
            if (p is null) return Result.Failure<ProgramDto>(Fx.NotFound("Program"));
        }
        else
        {
            if (c.MemberId is { } mid && !await db.Members.AnyAsync(m => m.Id == mid && !m.IsDeleted, ct))
                return Result.Failure<ProgramDto>(Fx.NotFound("Member"));
            p = new FitnessProgram(c.Type, c.Name);
            p.SetMember(c.MemberId);
            db.Programs.Add(p);
        }
        p.Update(c.Name, c.Goal, c.Level, c.Weeks, c.Description, c.ItemsJson ?? "[]", c.TrainerId, c.StartDate, c.IsActive);
        await db.SaveChangesAsync(ct);
        return Result.Success(await ProgramReader.ToDtoAsync(db, p, ct));
    }
}

internal sealed class AssignProgramHandler(FitnessDbContext db) : ICommandHandler<AssignProgramCommand, ProgramDto>
{
    public async Task<Result<ProgramDto>> Handle(AssignProgramCommand c, CancellationToken ct)
    {
        var t = await db.Programs.AsNoTracking().FirstOrDefaultAsync(p => p.Id == c.TemplateId && !p.IsDeleted && p.MemberId == null, ct);
        if (t is null) return Result.Failure<ProgramDto>(Fx.NotFound("Program template"));
        if (!await db.Members.AnyAsync(m => m.Id == c.MemberId && !m.IsDeleted, ct)) return Result.Failure<ProgramDto>(Fx.NotFound("Member"));

        var copy = t.AssignTo(c.MemberId, c.TrainerId, Dates.Valid(c.StartDate) ? c.StartDate! : Fx.Today(null));
        db.Programs.Add(copy);
        await db.SaveChangesAsync(ct);
        return Result.Success(await ProgramReader.ToDtoAsync(db, copy, ct));
    }
}

internal sealed class DeleteProgramHandler(FitnessDbContext db) : ICommandHandler<DeleteProgramCommand>
{
    public async Task<Result> Handle(DeleteProgramCommand c, CancellationToken ct)
    {
        var p = await db.Programs.FirstOrDefaultAsync(x => x.Id == c.Id && !x.IsDeleted, ct);
        if (p is null) return Result.Failure(Fx.NotFound("Program"));
        p.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
