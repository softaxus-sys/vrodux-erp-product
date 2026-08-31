using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.RealEstate.Application.Abstractions;
using Softaxis.RealEstate.Application.RentAlerts.Dtos;
using Softaxis.RealEstate.Domain.Entities;
using Softaxis.RealEstate.Infrastructure.Handlers.RentAlerts;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.Infrastructure.Services;

internal interface IRentAlertSender
{
    Task<RentAlertRunResultDto> RunForCurrentTenantAsync(bool dryRun, CancellationToken ct);
    Task<RentAlertRunResultDto> SendOneAsync(Guid contractId, Guid? installmentId, CancellationToken ct);
}

/// <summary>
/// Decides which reminders are due today and sends them. Shared by the nightly background pass and
/// the "run now" button, so the two can never disagree about what would be sent.
/// </summary>
internal sealed class RentAlertSender(
    RealEstateDbContext db,
    IRealEstateEmailService email,
    ILogger<RentAlertSender> logger) : IRentAlertSender
{
    private enum SendOutcome { Sent, Failed, AlreadyClaimed }

    // ── Public entry points ──────────────────────────────────────────────────

    public async Task<RentAlertRunResultDto> RunForCurrentTenantAsync(bool dryRun, CancellationToken ct)
    {
        var settings = await RentAlertSettingsStore.FindAsync(db, ct);
        if (settings is null)
            return Empty("No reminder settings for this workspace yet - open Rent Alerts to create them.");
        if (!settings.Enabled)
            return Empty("Rent reminders are switched off for this workspace.");

        var today    = settings.Today();
        var currency = await ResolveCurrencyAsync(ct);
        var cc       = await BuildCcListAsync(settings, ct);

        var contracts = await db.LeaseContracts
            .Include(c => c.Installments)
            .Where(c => !c.IsDeleted && c.Status == "active")
            .ToListAsync(ct);

        if (contracts.Count == 0) return Empty("No active leases.");

        var tenants = await db.Tenants.AsNoTracking()
            .Where(t => !t.IsDeleted)
            .ToDictionaryAsync(t => t.Id, ct);

        // Every notice already sent for these leases, loaded once. The unique index on the log is
        // the real guarantee; this set only avoids a pointless insert-and-rollback per notice.
        var contractIds = contracts.Select(c => c.Id).ToList();
        var alreadySent = (await db.RentAlertLogs.AsNoTracking()
                .Where(l => contractIds.Contains(l.ContractId))
                .Select(l => new { l.ContractId, l.InstallmentId, l.Kind, l.OffsetKey })
                .ToListAsync(ct))
            .Select(l => Key(l.ContractId, l.InstallmentId, l.Kind, l.OffsetKey))
            .ToHashSet(StringComparer.Ordinal);

        var due = 0; var overdue = 0; var expiry = 0; var skipped = 0; var failed = 0;
        var messages = new List<string>();

        foreach (var c in contracts)
        {
            if (!tenants.TryGetValue(c.TenantId, out var tenant) || string.IsNullOrWhiteSpace(tenant.Email))
            {
                skipped++;
                messages.Add(c.ContractNumber + ": no email address on the tenant record.");
                continue;
            }

            // ── Rent, per open installment ───────────────────────────────────
            foreach (var inst in c.Installments.Where(i => !i.IsDeleted && !i.IsSettled))
            {
                if (PlanForInstallment(settings, inst, today) is not { } plan) continue;

                var (kind, offsetKey, days) = plan;
                if (alreadySent.Contains(Key(c.Id, inst.Id, kind, offsetKey))) continue;

                var notice = kind == "rent_due"
                    ? RentEmailTemplates.RentDue(c, inst, tenant.Name, days, currency)
                    : RentEmailTemplates.RentOverdue(c, inst, tenant.Name, days, currency);

                if (dryRun)
                {
                    messages.Add(c.ContractNumber + " #" + inst.InstallmentNumber
                        + ": would send " + kind + " (" + offsetKey + ") to " + tenant.Email + ".");
                    if (kind == "rent_due") due++; else overdue++;
                    alreadySent.Add(Key(c.Id, inst.Id, kind, offsetKey));
                    continue;
                }

                var outcome = await ClaimAndSendAsync(c.Id, inst.Id, kind, offsetKey,
                    tenant.Email, tenant.Name, cc, notice.Subject, notice.Html, ct);

                if (outcome == SendOutcome.Sent) { if (kind == "rent_due") due++; else overdue++; }
                else if (outcome == SendOutcome.AlreadyClaimed) skipped++;
                else
                {
                    failed++;
                    messages.Add(c.ContractNumber + " #" + inst.InstallmentNumber
                        + ": could not deliver to " + tenant.Email + ".");
                }

                alreadySent.Add(Key(c.Id, inst.Id, kind, offsetKey));
            }

            // ── Lease expiry ─────────────────────────────────────────────────
            if (DaysBetween(today, c.EndDate) is not { } daysLeft || daysLeft < 0) continue;
            if (TightestRung(settings.ExpiryOffsets, daysLeft) is not { } rung) continue;

            var expiryKey = RentAlertLog.ExpiryKey(rung);
            if (alreadySent.Contains(Key(c.Id, null, "contract_expiry", expiryKey))) continue;

            var expiryNotice = RentEmailTemplates.ContractExpiring(c, tenant.Name, daysLeft, currency);

            if (dryRun)
            {
                messages.Add(c.ContractNumber + ": would send expiry notice (" + expiryKey + ") to " + tenant.Email + ".");
                expiry++;
                alreadySent.Add(Key(c.Id, null, "contract_expiry", expiryKey));
                continue;
            }

            var expiryOutcome = await ClaimAndSendAsync(c.Id, null, "contract_expiry", expiryKey,
                tenant.Email, tenant.Name, cc, expiryNotice.Subject, expiryNotice.Html, ct);

            if (expiryOutcome == SendOutcome.Sent) expiry++;
            else if (expiryOutcome == SendOutcome.AlreadyClaimed) skipped++;
            else
            {
                failed++;
                messages.Add(c.ContractNumber + ": could not deliver the expiry notice to " + tenant.Email + ".");
            }

            alreadySent.Add(Key(c.Id, null, "contract_expiry", expiryKey));
        }

        if (messages.Count == 0 && due + overdue + expiry == 0)
            messages.Add("Nothing due for a reminder today.");

        return new RentAlertRunResultDto(due, overdue, expiry, skipped, failed, messages);
    }

    public async Task<RentAlertRunResultDto> SendOneAsync(Guid contractId, Guid? installmentId, CancellationToken ct)
    {
        var settings = await RentAlertSettingsStore.GetOrCreateAsync(db, ct);
        var today    = settings.Today();
        var currency = await ResolveCurrencyAsync(ct);
        var cc       = await BuildCcListAsync(settings, ct);

        var c = await db.LeaseContracts.Include(x => x.Installments)
            .FirstOrDefaultAsync(x => x.Id == contractId && !x.IsDeleted, ct);
        if (c is null) return Empty("Lease not found.");

        var tenant = await db.Tenants.AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == c.TenantId && !t.IsDeleted, ct);
        if (tenant is null || string.IsNullOrWhiteSpace(tenant.Email))
            return Empty("That lease has no tenant email address on file.");

        // Manual sends are deliberately NOT keyed to a rung. An operator pressing send again means
        // they want it sent again; keying it to a rung would either silently do nothing or consume
        // a rung the automatic ladder still needs.
        var manualKey = "manual:" + DateTime.UtcNow.ToString("yyyyMMddHHmmss");

        if (installmentId is { } iid)
        {
            var inst = c.Installments.FirstOrDefault(i => i.Id == iid && !i.IsDeleted);
            if (inst is null) return Empty("Installment not found.");

            var isOverdue = inst.IsOverdue(today);
            var days      = isOverdue ? inst.DaysOverdue(today) : DaysBetween(today, inst.DueDate) ?? 0;
            var notice    = isOverdue
                ? RentEmailTemplates.RentOverdue(c, inst, tenant.Name, days, currency)
                : RentEmailTemplates.RentDue(c, inst, tenant.Name, days, currency);

            var outcome = await ClaimAndSendAsync(c.Id, inst.Id,
                isOverdue ? "rent_overdue" : "rent_due", manualKey,
                tenant.Email, tenant.Name, cc, notice.Subject, notice.Html, ct);

            return outcome == SendOutcome.Sent
                ? new RentAlertRunResultDto(isOverdue ? 0 : 1, isOverdue ? 1 : 0, 0, 0, 0,
                    ["Sent to " + tenant.Email + "."])
                : Failed("Could not deliver to " + tenant.Email + ". Check the email settings.");
        }

        var daysToExpiry = DaysBetween(today, c.EndDate) ?? 0;
        var expiryNotice = RentEmailTemplates.ContractExpiring(c, tenant.Name, daysToExpiry, currency);

        var expiryOutcome = await ClaimAndSendAsync(c.Id, null, "contract_expiry", manualKey,
            tenant.Email, tenant.Name, cc, expiryNotice.Subject, expiryNotice.Html, ct);

        return expiryOutcome == SendOutcome.Sent
            ? new RentAlertRunResultDto(0, 0, 1, 0, 0, ["Sent to " + tenant.Email + "."])
            : Failed("Could not deliver to " + tenant.Email + ". Check the email settings.");
    }

    // ── Which rung, if any, is this installment on today ──────────────────────

    /// <summary>
    /// Returns the notice kind, its ledger key, and the day count to put in the message - or null
    /// when nothing is owed today.
    ///
    /// Uses the TIGHTEST applicable rung rather than an exact day match. An exact match
    /// (daysUntil == 30) silently sends nothing at all if the service was down that day, which is
    /// the one failure mode this whole feature exists to prevent. Taking the tightest unsent rung
    /// instead means a first run against an existing book sends one notice per payment, not one
    /// per configured lead time.
    /// </summary>
    private static (string Kind, string OffsetKey, int Days)? PlanForInstallment(
        RentAlertSettings settings, RentInstallment inst, string today)
    {
        if (inst.IsOverdue(today))
        {
            var daysOverdue = inst.DaysOverdue(today);
            if (settings.OverdueMaxReminders == 0) return null;

            // Day 1 late is step 1; each further OverdueRepeatDays is the next step.
            var step = 1 + ((daysOverdue - 1) / Math.Max(1, settings.OverdueRepeatDays));
            if (step > settings.OverdueMaxReminders) return null;

            return ("rent_overdue", RentAlertLog.OverdueKey(step), daysOverdue);
        }

        if (DaysBetween(today, inst.DueDate) is not { } daysUntil) return null;

        // 0 is always in play so a payment falling due today is announced even when the configured
        // ladder stops at 1 day out.
        var offsets = settings.DueOffsets.Append(0).Distinct().OrderByDescending(n => n).ToList();
        if (TightestRung(offsets, daysUntil) is not { } rung) return null;

        return ("rent_due", RentAlertLog.BeforeKey(rung), daysUntil);
    }

    /// <summary>The smallest configured lead time that still covers <paramref name="days"/>.
    /// Null when the date is further out than the widest rung.</summary>
    private static int? TightestRung(IReadOnlyList<int> offsets, int days)
    {
        int? best = null;
        foreach (var o in offsets)
            if (o >= days && (best is null || o < best)) best = o;
        return best;
    }

    // ── Claim, then send ─────────────────────────────────────────────────────

    /// <summary>
    /// Writes the ledger row FIRST, then sends.
    ///
    /// Order matters and is the opposite of the obvious one. Sending first and recording after
    /// means a crash in between re-sends the same notice on the next pass - and a tenant emailed
    /// the same demand twice is a complaint. Claiming first means the worst case is a notice
    /// recorded as failed and visibly not delivered, which an operator can see and re-send.
    /// A duplicate claim (second worker, retried run) hits the unique index and is skipped.
    /// </summary>
    private async Task<SendOutcome> ClaimAndSendAsync(
        Guid contractId, Guid? installmentId, string kind, string offsetKey,
        string toEmail, string toName, IReadOnlyList<string> cc,
        string subject, string html, CancellationToken ct)
    {
        var ccCsv = cc.Count == 0 ? null : string.Join(",", cc);
        var log = new RentAlertLog(contractId, installmentId, kind, offsetKey, toEmail, ccCsv, false, null);

        db.RentAlertLogs.Add(log);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // Someone already claimed this rung. Detach so the failed insert does not poison the
            // next SaveChanges in this run.
            db.Entry(log).State = EntityState.Detached;
            return SendOutcome.AlreadyClaimed;
        }

        var sent = await email.SendAsync(toEmail, toName, cc, subject, html, ct);

        log.MarkResult(sent, sent ? null : "Email could not be delivered (SMTP unavailable or rejected).");
        await db.SaveChangesAsync(ct);

        return sent ? SendOutcome.Sent : SendOutcome.Failed;
    }

    // ── Recipients ───────────────────────────────────────────────────────────

    private async Task<IReadOnlyList<string>> BuildCcListAsync(RentAlertSettings settings, CancellationToken ct)
    {
        var list = settings.CcList.ToList();
        if (!settings.CcAllRealEstateUsers) return list;

        try
        {
            // Cross-schema read: every service points at the same physical database, different
            // schema. "identity" is a RESERVED SQL Server keyword and MUST be bracketed, or this
            // fails with "Incorrect syntax near the keyword 'identity'" (Module 5g hit this).
            //
            // Scope note: role-derived only. Per-user permission grants and denies (Module 5h) are
            // not applied, so a user granted real-estate access individually is not copied.
            var tenantId = TenantAmbient.TenantId ?? Guid.Empty;
            var emails = await db.Database.SqlQuery<string>($@"
                SELECT DISTINCT u.[email]
                FROM [identity].[users] u
                JOIN [identity].[user_roles] ur       ON ur.UserId = u.Id
                JOIN [identity].[role_permissions] rp ON rp.RoleId = ur.RoleId
                JOIN [identity].[permissions] p       ON p.Id = rp.PermissionId
                WHERE u.IsDeleted = 0
                  AND u.TenantId = {tenantId}
                  AND p.Module LIKE 'real-estate%'").ToListAsync(ct);

            list.AddRange(emails.Where(e => !string.IsNullOrWhiteSpace(e)));
        }
        catch (Exception ex)
        {
            // A failure to build the CC list must never stop the tenant's own reminder.
            logger.LogWarning(ex, "Could not resolve real-estate users to copy; sending without them.");
        }

        return list.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
    }

    /// <summary>The workspace's operating currency (Module 6e), for the amounts in the notice.
    /// Falls back to AED rather than printing a bare number with no unit.</summary>
    private async Task<string> ResolveCurrencyAsync(CancellationToken ct)
    {
        try
        {
            var tenantId = TenantAmbient.TenantId ?? Guid.Empty;
            var found = await db.Database
                .SqlQuery<string?>($"SELECT [Currency] FROM [identity].[tenants] WHERE [Id] = {tenantId}")
                .ToListAsync(ct);

            var currency = found.FirstOrDefault();
            return string.IsNullOrWhiteSpace(currency) ? "AED" : currency!;
        }
        catch
        {
            return "AED";
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static string Key(Guid contractId, Guid? installmentId, string kind, string offsetKey) =>
        contractId.ToString() + "|" + (installmentId?.ToString() ?? "-") + "|" + kind + "|" + offsetKey;

    private static int? DaysBetween(string from, string to) =>
        DateTime.TryParse(from, out var f) && DateTime.TryParse(to, out var t)
            ? (int)(t.Date - f.Date).TotalDays
            : null;

    private static RentAlertRunResultDto Empty(string message) => new(0, 0, 0, 0, 0, [message]);

    private static RentAlertRunResultDto Failed(string message) => new(0, 0, 0, 0, 1, [message]);
}
