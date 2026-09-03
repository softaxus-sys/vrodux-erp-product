using Microsoft.EntityFrameworkCore;
using Softaxis.Finance.Application.Abstractions;
using Softaxis.Finance.Infrastructure.Handlers.GeneralLedger;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Services;

/// <summary>
/// The daily pass over one workspace's invoices: sends the ones scheduled for today, and chases the
/// ones whose due date is approaching.
///
/// <para>Runs inside the existing recurring-invoice sweep, which already resolves the workspace, its
/// currency and the ambient tenant — a second background service would have duplicated all of it.</para>
/// </summary>
public static class InvoiceScheduleSweep
{
    /// <summary>
    /// Days before the due date at which the customer is reminded, tightest last.
    ///
    /// <para>Fixed for now. Per-workspace configuration is the obvious next step, but a ladder nobody
    /// has set yet should still do something sensible rather than nothing.</para>
    /// </summary>
    private static readonly int[] ReminderOffsets = [7, 3, 1];

    public sealed record SweepResult(int Sent, int SendFailed, int Reminded, int RemindFailed);

    public static async Task<SweepResult> RunAsync(
        FinanceDbContext db, IFinanceEmailService email, DateTime utcNow, CancellationToken ct)
    {
        var today = utcNow.ToString("yyyy-MM-dd");

        var (sent, sendFailed)       = await SendScheduledAsync(db, email, today, ct);
        var (reminded, remindFailed) = await SendDueRemindersAsync(db, email, today, ct);

        return new SweepResult(sent, sendFailed, reminded, remindFailed);
    }

    // ── Scheduled sends ───────────────────────────────────────────────────────

    /// <summary>
    /// Sends every draft whose scheduled date has arrived.
    ///
    /// <para>Uses <c>&lt;=</c> rather than an exact match: if the service was down on the day, the
    /// invoice still goes out on the next run. An exact comparison would silently skip it forever,
    /// which is the one failure this feature exists to prevent.</para>
    ///
    /// <para>Only drafts qualify. An invoice already sent by hand must not go out a second time
    /// because a schedule was left on it.</para>
    /// </summary>
    private static async Task<(int Sent, int Failed)> SendScheduledAsync(
        FinanceDbContext db, IFinanceEmailService email, string today, CancellationToken ct)
    {
        var due = await db.Invoices
            .Include(x => x.Items)
            .Where(x => !x.IsDeleted
                     && x.Status == "draft"
                     && x.ScheduledSendDate != null
                     && string.Compare(x.ScheduledSendDate, today) <= 0)
            .ToListAsync(ct);

        if (due.Count == 0) return (0, 0);

        int sent = 0, failed = 0;

        foreach (var invoice in due)
        {
            if (ct.IsCancellationRequested) break;

            // Sending posts the sales entry to the ledger, exactly as pressing Send does — an invoice
            // that reached the customer but never hit the books would understate receivables.
            if (await GlPoster.IsPeriodClosedAsync(db, invoice.InvoiceDate, ct))
            {
                // Left scheduled rather than cleared: reopening the period should let it go out.
                failed++;
                continue;
            }

            // The same posting the manual Send performs — shared so the ledger cannot depend on
            // which route the invoice took.
            var journalEntryId = await GlPoster.PostInvoiceSalesAsync(db, invoice, ct);
            invoice.SetJournalEntryId(journalEntryId);
            invoice.Send();

            // Cleared whatever happens next: the invoice is now "sent", so leaving the date on it
            // would have the next sweep skip it anyway — but an explicit clear says why.
            invoice.ClearScheduledSend();

            // Committed BEFORE the email. An invoice that exists but was not emailed can be re-sent;
            // an email for an invoice that failed to save is a bill the customer holds and the books
            // do not. Same ordering as the manual send path.
            await db.SaveChangesAsync(ct);

            if (await RecurringInvoiceGenerator.SendInvoiceAsync(db, invoice, [], null, email, ct))
            {
                sent++;
                await db.SaveChangesAsync(ct);   // persists the delivery record
            }
            else
            {
                // The invoice is legitimately sent and posted; only the email did not leave. Counted
                // so the log says so rather than reporting a clean run.
                failed++;
            }
        }

        return (sent, failed);
    }

    // ── Due-date reminders ────────────────────────────────────────────────────

    /// <summary>
    /// Chases unpaid invoices as their due date approaches.
    ///
    /// <para>Only invoices that have actually been sent and still owe money. A draft has not reached
    /// the customer, and chasing someone for an invoice they have paid is worse than not chasing at
    /// all.</para>
    /// </summary>
    private static async Task<(int Reminded, int Failed)> SendDueRemindersAsync(
        FinanceDbContext db, IFinanceEmailService email, string today, CancellationToken ct)
    {
        var candidates = await db.Invoices
            .Include(x => x.Items)
            .Where(x => !x.IsDeleted
                     && x.RemindBeforeDue
                     && x.CustomerEmail != null
                     && (x.Status == "sent" || x.Status == "partially_paid" || x.Status == "overdue")
                     && string.Compare(x.DueDate, today) >= 0)
            .ToListAsync(ct);

        if (candidates.Count == 0) return (0, 0);

        int reminded = 0, failed = 0;

        foreach (var invoice in candidates)
        {
            if (ct.IsCancellationRequested) break;

            // Nothing outstanding — the figures moved since the status was last written.
            if (invoice.AmountDue <= 0) continue;

            if (!DateTime.TryParse(invoice.DueDate, out var dueDate)) continue;
            if (!DateTime.TryParse(today, out var todayDate)) continue;

            var daysUntilDue = (int)(dueDate.Date - todayDate.Date).TotalDays;

            if (RungFor(daysUntilDue, invoice.LastReminderDaysBefore) is not { } rung) continue;

            var branding = await RecurringInvoiceGenerator.ResolveBrandingAsync(db, ct);
            var (cc, _)  = await RecurringInvoiceGenerator.MergeCustomerCcAsync(
                db, invoice.CustomerId, branding.CcList.Concat(invoice.CcList).ToList(), ct);

            var body = InvoiceReminderEmailTemplate.Build(invoice, branding, daysUntilDue);

            var ok = await email.SendInvoiceAsync(
                invoice.CustomerEmail!, invoice.CustomerName, cc, body.Subject, body.Html,
                body.InlineImages,
                // The invoice travels with the reminder — a chaser the customer cannot act on
                // without digging out the original is just noise.
                InvoicePdfBuilder.TryBuildAttachment(invoice, branding), ct);

            if (ok)
            {
                // Recorded only on a real send, so a failed reminder is retried tomorrow rather than
                // consuming a rung nobody received.
                invoice.RecordDueReminder(rung);
                await db.SaveChangesAsync(ct);
                reminded++;
            }
            else
            {
                failed++;
            }
        }

        return (reminded, failed);
    }

    /// <summary>
    /// The rung owed today, or null.
    ///
    /// <para>Takes the <b>tightest</b> rung that has arrived rather than an exact day match, for the
    /// same reason as the rent-alert ladder: an exact match sends nothing at all if the service was
    /// down that day. Taking the tightest also means the first run against an existing book sends one
    /// reminder per invoice, not one per configured offset.</para>
    ///
    /// <para><paramref name="alreadySent"/> is the smallest rung already used. A rung is only owed if
    /// it is tighter than that, so the ladder always moves forward and never repeats.</para>
    /// </summary>
    private static int? RungFor(int daysUntilDue, int? alreadySent)
    {
        if (daysUntilDue < 0) return null;   // past due; that is a different message, not this ladder

        int? owed = null;
        foreach (var offset in ReminderOffsets)
            if (daysUntilDue <= offset && (owed is null || offset < owed))
                owed = offset;

        if (owed is null) return null;
        return alreadySent is null || owed < alreadySent ? owed : null;
    }
}
