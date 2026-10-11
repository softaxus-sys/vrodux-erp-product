using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.POS.Application.Abstractions;
using Softaxis.POS.Application.Customers.Credit;
using Softaxis.POS.Application.Customers.Credit.Reminders;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Infrastructure.Persistence;

namespace Softaxis.POS.Infrastructure.Services;

/// <summary>
/// Emails customers about what they owe. Everything is scoped to the current tenant (the request's, or
/// the one the background service has set), so one shop's customers are never reached from another's run.
/// </summary>
internal sealed class CreditReminderService(POSDbContext db, IPosCreditReadService credit, ICreditMailSender mail) : ICreditReminderService
{
    /// <summary>After a failed send, wait this long before trying the same customer again.</summary>
    private static readonly TimeSpan FailureBackoff = TimeSpan.FromHours(20);

    public async Task<CreditReminderSettingsDto> GetSettingsAsync(CancellationToken ct) => ToDto(await GetOrCreateAsync(ct));

    public async Task<CreditReminderSettingsDto> UpdateSettingsAsync(UpdateCreditReminderSettingsCommand c, CancellationToken ct)
    {
        try { TimeZoneInfo.FindSystemTimeZoneById(c.TimeZoneId); }
        catch { throw new InvalidOperationException($"'{c.TimeZoneId}' is not a time zone this server knows."); }
        var s = await GetOrCreateAsync(ct);
        s.Update(c.Enabled, c.DaysBeforeDue, c.OverdueAfterDays, c.RepeatEveryDays, c.MaxOverdueReminders, c.SenderName, c.CcEmail, c.TimeZoneId);
        await db.SaveChangesAsync(ct);
        return ToDto(s);
    }

    public async Task<IReadOnlyList<CreditReminderLogDto>> GetLogAsync(Guid? customerId, CancellationToken ct)
    {
        var q = db.CreditReminderLogs.AsNoTracking().AsQueryable();
        if (customerId is Guid id) q = q.Where(l => l.CustomerId == id);
        return await q.OrderByDescending(l => l.CreatedAt).Take(100)
            .Select(l => new CreditReminderLogDto(l.Id, l.CustomerId, l.CustomerName, l.Email, l.Kind, l.Amount, l.Status, l.Error, l.CreatedAt))
            .ToListAsync(ct);
    }

    /// <summary>The automatic rules. A dry run reports who would be emailed and changes nothing.</summary>
    public async Task<CreditReminderRunDto> RunAsync(bool dryRun, CancellationToken ct)
    {
        var s = await GetOrCreateAsync(ct);
        var nowUtc = DateTime.UtcNow;
        var today = LocalNow(s).Date;
        var currency = ResolveCurrency();

        var customers = await db.Customers.AsNoTracking()
            .Where(c => !c.IsDeleted && c.IsActive && c.CreditBalance > 0)
            .OrderBy(c => c.Name).Take(2000).ToListAsync(ct);

        var recipients = new List<CreditReminderRecipientDto>();
        int dueSoon = 0, overdue = 0, failed = 0, noEmail = 0;

        foreach (var c in customers)
        {
            if (ct.IsCancellationRequested) break;
            var file = await credit.GetCustomerAsync(c.Id, nowUtc, ct);
            if (file is null) continue;

            var decision = await DecideAsync(s, file, today, nowUtc, ct);
            if (decision is null) continue;
            if (string.IsNullOrWhiteSpace(c.Email)) { noEmail++; continue; }

            var amount = decision.Value.Kind == "due_soon"
                ? file.OpenItems.Where(i => i.DaysOverdue == 0).Sum(i => i.Outstanding)
                : file.OpenItems.Where(i => i.DaysOverdue > 0).Sum(i => i.Outstanding);
            recipients.Add(new CreditReminderRecipientDto(c.Id, c.Name, c.Email!, decision.Value.Kind, amount));
            if (dryRun) { if (decision.Value.Kind == "due_soon") dueSoon++; else overdue++; continue; }

            var (log, _) = await DeliverAsync(s, c.Id, c.Name, c.Email!, decision.Value.Kind, decision.Value.Key, file, currency, ct);
            if (log is null) continue;                       // someone else already claimed it
            if (log.Status == "sent") { if (log.Kind == "due_soon") dueSoon++; else overdue++; }
            else failed++;
        }
        return new CreditReminderRunDto(dueSoon, overdue, failed, noEmail, dryRun, recipients);
    }

    /// <summary>A reminder to one customer on request: what is late, or everything open if nothing is.</summary>
    public async Task<(CreditReminderLogDto? Log, string? Error)> SendToCustomerAsync(Guid customerId, CancellationToken ct)
    {
        var c = await db.Customers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == customerId && !x.IsDeleted, ct);
        if (c is null) return (null, "Customer not found.");
        if (string.IsNullOrWhiteSpace(c.Email)) return (null, "This customer has no email address on file.");
        if (!mail.IsConfigured) return (null, "No mail account is set up on the server, so nothing can be sent.");
        var file = await credit.GetCustomerAsync(customerId, DateTime.UtcNow, ct);
        if (file is null || file.OpenItems.Count == 0) return (null, "This customer owes nothing.");

        var s = await GetOrCreateAsync(ct);
        var (log, err) = await DeliverAsync(s, c.Id, c.Name, c.Email!, "manual", null, file, ResolveCurrency(), ct);
        if (log is null) return (null, err);
        if (log.Status != "sent") return (null, log.Error ?? "The email could not be sent.");
        return (new CreditReminderLogDto(log.Id, log.CustomerId, log.CustomerName, log.Email, log.Kind, log.Amount, log.Status, log.Error, log.CreatedAt), null);
    }

    // ── rules ────────────────────────────────────────────────────────────────────────────────

    private async Task<(string Kind, string Key)?> DecideAsync(CreditReminderSettings s, CustomerCreditDto file, DateTime today, DateTime nowUtc, CancellationToken ct)
    {
        // A failed attempt lately means the address or the mail account is the problem; do not retry every pass.
        if (await db.CreditReminderLogs.AnyAsync(l => l.CustomerId == file.CustomerId && l.Status == "failed" && l.CreatedAt > nowUtc - FailureBackoff, ct))
            return null;

        var late = file.OpenItems.Where(i => i.DaysOverdue > 0).ToList();
        if (late.Count > 0)
        {
            var oldest = late.Max(i => i.DaysOverdue);
            if (oldest < Math.Max(1, s.OverdueAfterDays)) return null;
            var oldestDue = DateTime.Parse(late.OrderByDescending(i => i.DaysOverdue).First().DueOn, System.Globalization.CultureInfo.InvariantCulture);

            var sent = await db.CreditReminderLogs.AsNoTracking()
                .Where(l => l.CustomerId == file.CustomerId && l.Kind == "overdue" && l.Status == "sent" && l.CreatedAt >= oldestDue)
                .OrderByDescending(l => l.CreatedAt).Select(l => l.CreatedAt).ToListAsync(ct);
            var ok = sent.Count == 0 || (sent.Count < s.MaxOverdueReminders && (nowUtc - sent[0]).TotalDays >= s.RepeatEveryDays);
            return ok ? ("overdue", $"over:{file.CustomerId:N}:{today:yyyyMMdd}") : null;
        }

        if (s.DaysBeforeDue <= 0) return null;
        var soon = file.OpenItems.Where(i => i.DaysOverdue == 0 && DateTime.Parse(i.DueOn, System.Globalization.CultureInfo.InvariantCulture) <= today.AddDays(s.DaysBeforeDue)).ToList();
        if (soon.Count == 0) return null;
        var earliest = soon.Min(i => i.DueOn).Replace("-", "");
        var key = $"due:{file.CustomerId:N}:{earliest}";
        // Once per due date, however many passes run.
        return await db.CreditReminderLogs.AnyAsync(l => l.Key == key, ct) ? null : ("due_soon", key);
    }

    /// <summary>Claim, then send. The log row is written first under a unique key, so a repeated or
    /// concurrent pass cannot send the same reminder twice.</summary>
    private async Task<(CreditReminderLog? Log, string? Error)> DeliverAsync(CreditReminderSettings s, Guid customerId, string name, string email,
        string kind, string? key, CustomerCreditDto file, string currency, CancellationToken ct)
    {
        var items = file.OpenItems;
        var amount = kind == "due_soon" ? items.Where(i => i.DaysOverdue == 0).Sum(i => i.Outstanding)
            : items.Any(i => i.DaysOverdue > 0) ? items.Where(i => i.DaysOverdue > 0).Sum(i => i.Outstanding) : items.Sum(i => i.Outstanding);

        var log = new CreditReminderLog(customerId, name, email, kind, amount, key);
        db.CreditReminderLogs.Add(log);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException) { db.Entry(log).State = EntityState.Detached; return (null, "Already sent."); }

        var shop = string.IsNullOrWhiteSpace(s.SenderName) ? "Accounts team" : s.SenderName;
        var (subject, html) = CreditEmailTemplate.Build(kind, shop, name, currency, items, file.CreditBalance);
        var sent = await mail.SendAsync(email, name, shop, subject, html, s.CcEmail, ct);
        if (sent) log.MarkSent(); else log.MarkFailed(mail.IsConfigured ? "The mail server did not accept the message." : "No mail account is set up.");
        await db.SaveChangesAsync(ct);
        return (log, null);
    }

    // ── settings ─────────────────────────────────────────────────────────────────────────────

    internal async Task<CreditReminderSettings> GetOrCreateAsync(CancellationToken ct)
    {
        var s = await db.CreditReminderSettings.FirstOrDefaultAsync(ct);
        if (s is not null) return s;
        s = new CreditReminderSettings();
        db.CreditReminderSettings.Add(s);
        await db.SaveChangesAsync(ct);
        return s;
    }

    internal static DateTime LocalNow(CreditReminderSettings s)
    {
        try { return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, TimeZoneInfo.FindSystemTimeZoneById(s.TimeZoneId)); }
        catch { return DateTime.UtcNow; }
    }

    private static string ResolveCurrency()
    {
        var c = TenantCurrency.Resolve();
        return string.IsNullOrWhiteSpace(c) ? "USD" : c;
    }

    private CreditReminderSettingsDto ToDto(CreditReminderSettings s) => new(
        s.Enabled, s.DaysBeforeDue, s.OverdueAfterDays, s.RepeatEveryDays, s.MaxOverdueReminders,
        s.SenderName, s.CcEmail, s.TimeZoneId, mail.IsConfigured);
}
