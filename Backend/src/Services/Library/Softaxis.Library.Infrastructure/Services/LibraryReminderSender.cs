using System.Globalization;
using System.Net;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.Library.Application.Reminders;
using Softaxis.Library.Domain.Entities;
using Softaxis.Library.Infrastructure.Handlers;
using Softaxis.Library.Infrastructure.Persistence;

namespace Softaxis.Library.Infrastructure.Services;

internal static class ReminderSettingsStore
{
    public const string DefaultTimeZone = "Asia/Dubai";

    /// <summary>
    /// The workspace's settings, created with defaults the first time they are asked for. Never
    /// seeded at startup: a startup pass has no tenant, so the row would belong to nobody.
    /// </summary>
    public static async Task<ReminderSettings> GetOrCreateAsync(LibraryDbContext db, CancellationToken ct)
    {
        var settings = await db.ReminderSettings.FirstOrDefaultAsync(ct);
        if (settings is not null) return settings;

        settings = new ReminderSettings(DefaultTimeZone);
        if (TenantAmbient.BypassFilter || TenantAmbient.TenantId is null) return settings;   // not saved without a tenant

        db.ReminderSettings.Add(settings);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // Two first reads at once: the other one won. Use its row.
            db.Entry(settings).State = EntityState.Detached;
            settings = await db.ReminderSettings.FirstAsync(ct);
        }
        return settings;
    }

    public static TimeZoneInfo? FindZone(string? id)
    {
        if (string.IsNullOrWhiteSpace(id)) return null;
        try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
        catch (TimeZoneNotFoundException) { return null; }
        catch (InvalidTimeZoneException) { return null; }
    }

    /// <summary>Now in the library's own time zone. An unknown zone falls back to UTC rather than throwing.</summary>
    public static DateTime LocalNow(ReminderSettings settings) =>
        TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, FindZone(settings.TimeZoneId) ?? TimeZoneInfo.Utc);
}

internal sealed class LibraryReminderSender(
    LibraryDbContext db, ILibraryEmailService email, ILogger<LibraryReminderSender> logger) : ILibraryReminderSender
{
    private sealed record Notice(
        string Kind, string Key, Guid MemberId, string MemberName, string? Email, Guid? LoanId,
        Guid? ReservationId, string Title, string Detail);

    public async Task<ReminderRunDto> RunAsync(string today, bool daily, bool dryRun, CancellationToken ct)
    {
        var settings = await ReminderSettingsStore.GetOrCreateAsync(db, ct);
        var notices  = new List<Notice>();

        if (daily)
        {
            await AddDueSoonAsync(notices, settings, today, ct);
            await AddOverdueAsync(notices, settings, today, ct);
        }
        if (settings.NotifyReady) await AddReadyAsync(notices, ct);

        // Anything already claimed has been sent, or is being sent by another pass.
        var keys    = notices.Select(n => n.Key).ToList();
        var claimed = await db.ReminderLogs.AsNoTracking().Where(l => keys.Contains(l.Key)).Select(l => l.Key).ToListAsync(ct);
        notices = notices.Where(n => !claimed.Contains(n.Key)).ToList();

        // A notice that failed is tried again, but not more than once a day: an address that
        // bounces would otherwise add a failed row on every pass.
        var since  = DateTime.UtcNow.AddHours(-20);
        var recent = await db.ReminderLogs.AsNoTracking()
            .Where(l => l.Status == ReminderStatus.Failed && l.CreatedAt >= since)
            .Select(l => new { l.Kind, l.LoanId, l.ReservationId }).ToListAsync(ct);
        if (recent.Count > 0)
            notices = notices.Where(n => !recent.Any(f =>
                f.Kind == n.Kind && f.LoanId == n.LoanId && f.ReservationId == n.ReservationId)).ToList();

        var noEmail = notices.Where(n => n.Email is null).Select(n => n.MemberId).Distinct().Count();
        var emails  = notices.Where(n => n.Email is not null)
            .GroupBy(n => (n.Kind, n.MemberId))
            .Select(g => g.ToList()).ToList();

        var preview = emails.Select(g => new ReminderPreviewDto(
            g[0].Kind, g[0].MemberName, g[0].Email!, g.Select(n => n.Title).ToList())).ToList();

        int Count(string kind) => emails.Count(g => g[0].Kind == kind);

        if (dryRun)
            return new ReminderRunDto(true, Count(ReminderKind.DueSoon), Count(ReminderKind.Overdue),
                Count(ReminderKind.Ready), 0, noEmail, preview);

        var libraryName = settings.LibraryName ?? "The Library";
        int dueSoon = 0, overdue = 0, ready = 0, failed = 0;
        var sent = new List<ReminderPreviewDto>();

        foreach (var group in emails)
        {
            if (ct.IsCancellationRequested) break;
            var first = group[0];

            // Claimed before sending — the opposite of the obvious order. Sending first means a
            // crash in between repeats the email on the next pass; claiming first means the worst
            // case is a row left "pending", which is visible and harmless.
            var rows = group.Select(n => new ReminderLog(
                n.Kind, n.Key, n.MemberId, n.MemberName, n.LoanId, n.ReservationId, n.Email!, n.Title)).ToList();
            db.ReminderLogs.AddRange(rows);
            try
            {
                await db.SaveChangesAsync(ct);
            }
            catch (DbUpdateException)
            {
                // Another pass claimed one of these first; it will send them.
                foreach (var row in rows) db.Entry(row).State = EntityState.Detached;
                continue;
            }

            var (subject, html) = ReminderEmails.Build(first.Kind, first.MemberName, libraryName,
                group.Select(n => (n.Title, n.Detail)).ToList());

            bool ok;
            try { ok = await email.SendAsync(first.Email!, first.MemberName, libraryName, subject, html, ct); }
            catch (Exception ex)
            {
                logger.LogError(ex, "Library notice to {Email} failed.", first.Email);
                ok = false;
            }

            foreach (var row in rows)
            {
                if (ok) row.MarkSent();
                else row.MarkFailed("The email could not be sent.");
            }
            await db.SaveChangesAsync(ct);

            if (!ok) { failed++; continue; }
            sent.Add(new ReminderPreviewDto(first.Kind, first.MemberName, first.Email!, group.Select(n => n.Title).ToList()));
            switch (first.Kind)
            {
                case ReminderKind.DueSoon: dueSoon++; break;
                case ReminderKind.Overdue: overdue++; break;
                default: ready++; break;
            }
        }

        if (daily && !TenantAmbient.BypassFilter && TenantAmbient.TenantId is not null)
        {
            settings.MarkDailyRun(today);
            await db.SaveChangesAsync(ct);
        }

        return new ReminderRunDto(false, dueSoon, overdue, ready, failed, noEmail, sent);
    }

    // ── What is owed ────────────────────────────────────────────────────────

    private async Task AddDueSoonAsync(List<Notice> notices, ReminderSettings settings, string today, CancellationToken ct)
    {
        if (settings.DueSoonDays <= 0) return;
        var upTo = LibraryDates.AddDays(today, settings.DueSoonDays);

        var rows = await (
            from l in db.Loans.AsNoTracking()
            join m in db.Members.AsNoTracking() on l.MemberId equals m.Id
            join t in db.Titles.AsNoTracking()  on l.TitleId  equals t.Id
            where l.Status == LoanStatus.Active && !m.IsDeleted
                  && string.Compare(l.DueDate, today) >= 0 && string.Compare(l.DueDate, upTo) <= 0
            select new { l.Id, l.DueDate, l.MemberId, m.FullName, m.Email, t.Title }).ToListAsync(ct);

        // The due date is part of the key, so a renewed loan earns a fresh notice for its new date.
        notices.AddRange(rows.Select(r => new Notice(
            ReminderKind.DueSoon, $"due:{r.Id:N}:{r.DueDate}", r.MemberId, r.FullName, Clean(r.Email),
            r.Id, null, r.Title, $"due {Pretty(r.DueDate)}")));
    }

    private async Task AddOverdueAsync(List<Notice> notices, ReminderSettings settings, string today, CancellationToken ct)
    {
        if (settings.OverdueEveryDays <= 0 || settings.OverdueMaxReminders <= 0) return;

        var rows = await (
            from l in db.Loans.AsNoTracking()
            join m in db.Members.AsNoTracking() on l.MemberId equals m.Id
            join t in db.Titles.AsNoTracking()  on l.TitleId  equals t.Id
            where l.Status == LoanStatus.Active && !m.IsDeleted && string.Compare(l.DueDate, today) < 0
            select new { l.Id, l.DueDate, l.MemberId, m.FullName, m.Email, t.Title }).ToListAsync(ct);
        if (rows.Count == 0) return;

        var loanIds = rows.Select(r => (Guid?)r.Id).ToList();
        var history = (await db.ReminderLogs.AsNoTracking()
                .Where(x => x.Kind == ReminderKind.Overdue && x.Status == ReminderStatus.Sent && loanIds.Contains(x.LoanId))
                .Select(x => new { x.LoanId, x.Key, x.CreatedAt }).ToListAsync(ct))
            .ToLookup(x => x.LoanId!.Value);

        foreach (var r in rows)
        {
            // Only notices about this due date count: a renewed loan that goes overdue again starts over.
            var prefix = $"overdue:{r.Id:N}:{r.DueDate}:";
            var before = history[r.Id].Where(x => x.Key.StartsWith(prefix, StringComparison.Ordinal)).ToList();
            if (before.Count >= settings.OverdueMaxReminders) continue;

            if (before.Count > 0)
            {
                var last = before.Max(x => x.CreatedAt).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
                if (LibraryDates.DaysBetween(last, today) < settings.OverdueEveryDays) continue;
            }

            var days = LibraryDates.DaysBetween(r.DueDate, today);
            notices.Add(new Notice(
                ReminderKind.Overdue, $"{prefix}{before.Count + 1}", r.MemberId, r.FullName, Clean(r.Email),
                r.Id, null, r.Title, $"was due {Pretty(r.DueDate)} — {days} day(s) overdue"));
        }
    }

    private async Task AddReadyAsync(List<Notice> notices, CancellationToken ct)
    {
        var rows = await (
            from r in db.Reservations.AsNoTracking()
            join m in db.Members.AsNoTracking()  on r.MemberId equals m.Id
            join t in db.Titles.AsNoTracking()   on r.TitleId  equals t.Id
            join b in db.Branches.AsNoTracking() on r.PickupBranchId equals b.Id
            where r.Status == ReservationStatus.Ready && !m.IsDeleted
            select new { r.Id, r.CopyId, r.HoldUntil, r.MemberId, m.FullName, m.Email, t.Title, Branch = b.Name }).ToListAsync(ct);

        notices.AddRange(rows.Select(r => new Notice(
            ReminderKind.Ready, $"ready:{r.Id:N}:{r.CopyId:N}", r.MemberId, r.FullName, Clean(r.Email),
            null, r.Id, r.Title,
            r.HoldUntil is null ? $"at {r.Branch}" : $"at {r.Branch}, held until {Pretty(r.HoldUntil)}")));
    }

    private static string? Clean(string? email) =>
        string.IsNullOrWhiteSpace(email) || !email.Contains('@') ? null : email.Trim();

    private static string Pretty(string date) =>
        DateOnly.TryParseExact(date, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d)
            ? d.ToString("d MMM yyyy", CultureInfo.InvariantCulture)
            : date;
}

internal static class ReminderEmails
{
    /// <summary>
    /// CSS is inline because mail clients strip stylesheets, and every value is encoded because
    /// member names and book titles are typed in by people.
    /// </summary>
    public static (string Subject, string Html) Build(
        string kind, string memberName, string libraryName, IReadOnlyList<(string Title, string Detail)> items)
    {
        var (subject, intro, outro) = kind switch
        {
            ReminderKind.DueSoon => (
                items.Count == 1 ? $"Due soon: {items[0].Title}" : $"{items.Count} items are due soon",
                "This is a reminder that the following will be due back shortly:",
                "Please return or renew before the due date to avoid a late fine."),
            ReminderKind.Overdue => (
                items.Count == 1 ? $"Overdue: {items[0].Title}" : $"{items.Count} items are overdue",
                "Our records show the following are now overdue:",
                "Please return them as soon as you can. A late fine may apply for each day overdue."),
            _ => (
                items.Count == 1 ? $"Ready for pickup: {items[0].Title}" : $"{items.Count} reserved items are ready",
                "Good news — what you reserved is ready to collect:",
                "Please bring your library card. After the date shown, the item goes to the next member waiting."),
        };

        string E(string s) => WebUtility.HtmlEncode(s);

        var list = new StringBuilder();
        foreach (var (title, detail) in items)
            list.Append("<tr><td style=\"padding:10px 12px;border-bottom:1px solid #e5e7eb;\">")
                .Append("<div style=\"font-weight:600;color:#111827;\">").Append(E(title)).Append("</div>")
                .Append("<div style=\"font-size:13px;color:#6b7280;margin-top:2px;\">").Append(E(detail)).Append("</div>")
                .Append("</td></tr>");

        var html = $"""
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#374151;max-width:560px;margin:0 auto;">
              <div style="background:#0f172a;color:#ffffff;padding:16px 20px;font-size:16px;font-weight:700;border-radius:8px 8px 0 0;">{E(libraryName)}</div>
              <div style="border:1px solid #e5e7eb;border-top:0;padding:20px;border-radius:0 0 8px 8px;">
                <p style="margin:0 0 12px;">Dear {E(memberName)},</p>
                <p style="margin:0 0 12px;">{E(intro)}</p>
                <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-bottom:0;margin:0 0 16px;">{list}</table>
                <p style="margin:0 0 12px;">{E(outro)}</p>
                <p style="margin:0;color:#6b7280;">{E(libraryName)}</p>
              </div>
            </div>
            """;

        return (subject, html);
    }
}
