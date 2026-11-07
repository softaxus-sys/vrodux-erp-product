using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.EInvoicing;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.EInvoicing;
using Softaxis.Finance.Infrastructure.Handlers.GeneralLedger;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.EInvoicing;

internal static class EInvoiceMappings
{
    public static EInvoiceSubmissionDto ToDto(EInvoiceSubmission s) => new(
        s.Id, s.DocumentType, s.DocumentId, s.DocumentNumber, s.ProviderKey, s.Status, s.Attempts, s.NextAttemptAt,
        s.ExternalId, s.LastError, s.XmlSnapshot != null, s.CreatedAt, s.SentAt);

    public static IReadOnlyList<EInvoiceIssueDto> Issues(IEnumerable<EInvoiceIssue> issues) =>
        issues.Select(i => new EInvoiceIssueDto(i.Severity, i.Code, i.Message)).ToList();
}

internal sealed class GetEInvoiceSettingsHandler(FinanceDbContext db, IEInvoiceGateway gateway)
    : IQueryHandler<GetEInvoiceSettingsQuery, EInvoiceSettingsDto>
{
    public async Task<Result<EInvoiceSettingsDto>> Handle(GetEInvoiceSettingsQuery query, CancellationToken ct) =>
        Result.Success(await Build(db, gateway, ct));

    public static async Task<EInvoiceSettingsDto> Build(FinanceDbContext db, IEInvoiceGateway gateway, CancellationToken ct)
    {
        var s = await EInvoiceQueue.GetOrCreateSettingsAsync(db, ct);
        var supplier = await EInvoiceDocumentFactory.LoadSupplierAsync(db, ct);
        return new EInvoiceSettingsDto(s.ProviderKey, s.Environment, s.Enabled, s.GoLiveDate, s.LegalIdScheme, s.LegalId,
            s.RegistrationAuthority, s.SupplierCity, gateway.IsAvailable, gateway.IsAvailable ? null : gateway.UnavailableReason,
            supplier.Trn ?? "", supplier.Name);
    }
}

internal sealed class UpdateEInvoiceSettingsHandler(FinanceDbContext db, IEInvoiceGateway gateway)
    : ICommandHandler<UpdateEInvoiceSettingsCommand, EInvoiceSettingsDto>
{
    public async Task<Result<EInvoiceSettingsDto>> Handle(UpdateEInvoiceSettingsCommand cmd, CancellationToken ct)
    {
        var provider = string.IsNullOrWhiteSpace(cmd.ProviderKey) ? "none" : cmd.ProviderKey.Trim().ToLowerInvariant();

        // Switching sending on with no working provider would look enabled and send nothing.
        if (cmd.Enabled && (provider == "none" || provider != gateway.ProviderKey || !gateway.IsAvailable))
            return Result.Failure<EInvoiceSettingsDto>(Error.Custom("EInvoice.Conflict",
                "Sending cannot be switched on yet: no e-invoicing provider is connected. " +
                "You can still save your company's registration details and check your invoices."));

        var s = await EInvoiceQueue.GetOrCreateSettingsAsync(db, ct);
        s.Update(provider, cmd.Environment, cmd.Enabled, cmd.GoLiveDate, cmd.LegalIdScheme, cmd.LegalId,
            cmd.RegistrationAuthority, cmd.SupplierCity);
        await db.SaveChangesAsync(ct);
        return Result.Success(await GetEInvoiceSettingsHandler.Build(db, gateway, ct));
    }
}

internal sealed class CheckEInvoiceHandler(FinanceDbContext db) : IQueryHandler<CheckEInvoiceQuery, EInvoiceCheckDto>
{
    public async Task<Result<EInvoiceCheckDto>> Handle(CheckEInvoiceQuery q, CancellationToken ct)
    {
        if (!EInvoiceDocumentTypes.IsKnown(q.DocumentType))
            return Result.Failure<EInvoiceCheckDto>(Error.Custom("EInvoice.Invalid", "Document type must be invoice or credit_note."));
        var loaded = await EInvoiceDocumentFactory.LoadAsync(db, q.DocumentType, q.DocumentId, ct);
        if (loaded is null) return Result.Failure<EInvoiceCheckDto>(Error.NotFoundById("Document", q.DocumentId));

        var issues = PintAeValidator.Validate(loaded.Document);
        var errors = issues.Count(i => i.Severity == EInvoiceIssue.Error);
        return Result.Success(new EInvoiceCheckDto(q.DocumentType, q.DocumentId, loaded.Number, errors == 0, errors,
            issues.Count - errors, EInvoiceMappings.Issues(issues)));
    }
}

internal sealed class GetEInvoiceXmlHandler(FinanceDbContext db) : IQueryHandler<GetEInvoiceXmlQuery, EInvoiceFileDto>
{
    public async Task<Result<EInvoiceFileDto>> Handle(GetEInvoiceXmlQuery q, CancellationToken ct)
    {
        if (!EInvoiceDocumentTypes.IsKnown(q.DocumentType))
            return Result.Failure<EInvoiceFileDto>(Error.Custom("EInvoice.Invalid", "Document type must be invoice or credit_note."));

        // A document already handed to the provider is returned exactly as it was sent, never rebuilt.
        var sent = await db.EInvoiceSubmissions.AsNoTracking()
            .FirstOrDefaultAsync(s => s.DocumentType == q.DocumentType && s.DocumentId == q.DocumentId && s.XmlSnapshot != null, ct);
        if (sent?.XmlSnapshot is { } snapshot)
            return Result.Success(new EInvoiceFileDto($"{Safe(sent.DocumentNumber)}.xml", "application/xml", snapshot));

        var loaded = await EInvoiceDocumentFactory.LoadAsync(db, q.DocumentType, q.DocumentId, ct);
        if (loaded is null) return Result.Failure<EInvoiceFileDto>(Error.NotFoundById("Document", q.DocumentId));

        var errors = PintAeValidator.Validate(loaded.Document).Where(i => i.Severity == EInvoiceIssue.Error).ToList();
        if (errors.Count > 0)
            return Result.Failure<EInvoiceFileDto>(Error.Custom("EInvoice.Invalid",
                "The XML cannot be produced until these are fixed: " + string.Join(" ", errors.Select(e => e.Message))));

        return Result.Success(new EInvoiceFileDto($"{Safe(loaded.Number)}.xml", "application/xml", PintAeBuilder.Build(loaded.Document)));
    }

    private static string Safe(string n) => new(n.Select(c => char.IsLetterOrDigit(c) || c is '-' or '_' ? c : '_').ToArray());
}

internal sealed class QueueEInvoiceHandler(FinanceDbContext db) : ICommandHandler<QueueEInvoiceCommand, EInvoiceSubmissionDto>
{
    public async Task<Result<EInvoiceSubmissionDto>> Handle(QueueEInvoiceCommand cmd, CancellationToken ct)
    {
        if (!EInvoiceDocumentTypes.IsKnown(cmd.DocumentType))
            return Result.Failure<EInvoiceSubmissionDto>(Error.Custom("EInvoice.Invalid", "Document type must be invoice or credit_note."));

        if (cmd.DocumentType == EInvoiceDocumentTypes.Invoice)
        {
            var status = await db.Invoices.AsNoTracking().Where(x => x.Id == cmd.DocumentId).Select(x => x.Status).FirstOrDefaultAsync(ct);
            if (status is null) return Result.Failure<EInvoiceSubmissionDto>(Error.NotFoundById("Invoice", cmd.DocumentId));
            if (status is "draft" or "cancelled")
                return Result.Failure<EInvoiceSubmissionDto>(Error.Custom("EInvoice.Conflict", "Only an issued invoice can be e-invoiced. Send it first."));
        }
        else
        {
            var status = await db.CreditNotes.AsNoTracking().Where(x => x.Id == cmd.DocumentId && !x.IsDeleted).Select(x => x.Status).FirstOrDefaultAsync(ct);
            if (status is null) return Result.Failure<EInvoiceSubmissionDto>(Error.NotFoundById("Credit note", cmd.DocumentId));
            if (status != "issued")
                return Result.Failure<EInvoiceSubmissionDto>(Error.Custom("EInvoice.Conflict", "Only an issued credit note can be e-invoiced."));
        }

        var settings = await EInvoiceQueue.GetOrCreateSettingsAsync(db, ct);
        var sub = await EInvoiceQueue.QueueAsync(db, cmd.DocumentType, cmd.DocumentId, settings.ProviderKey, ct);
        return Result.Success(EInvoiceMappings.ToDto(sub));
    }
}

internal sealed class RetryEInvoiceSubmissionHandler(FinanceDbContext db) : ICommandHandler<RetryEInvoiceSubmissionCommand, EInvoiceSubmissionDto>
{
    public async Task<Result<EInvoiceSubmissionDto>> Handle(RetryEInvoiceSubmissionCommand cmd, CancellationToken ct)
    {
        var sub = await db.EInvoiceSubmissions.FirstOrDefaultAsync(s => s.Id == cmd.Id, ct);
        if (sub is null) return Result.Failure<EInvoiceSubmissionDto>(Error.NotFoundById("Submission", cmd.Id));
        if (sub.Status is not (EInvoiceStatus.Failed or EInvoiceStatus.Rejected or EInvoiceStatus.Blocked))
            return Result.Failure<EInvoiceSubmissionDto>(Error.Custom("EInvoice.Conflict",
                $"A submission that is {sub.Status} cannot be retried."));

        // A rejected document is rebuilt from the corrected data; the old snapshot would just be refused again.
        if (sub.Status == EInvoiceStatus.Rejected) db.Entry(sub).Property(nameof(EInvoiceSubmission.XmlSnapshot)).CurrentValue = null;

        var settings = await EInvoiceQueue.GetOrCreateSettingsAsync(db, ct);
        var updated = await EInvoiceQueue.QueueAsync(db, sub.DocumentType, sub.DocumentId, settings.ProviderKey, ct);
        return Result.Success(EInvoiceMappings.ToDto(updated));
    }
}

internal sealed class GetEInvoiceSubmissionsHandler(FinanceDbContext db) : IQueryHandler<GetEInvoiceSubmissionsQuery, EInvoiceSubmissionListDto>
{
    public async Task<Result<EInvoiceSubmissionListDto>> Handle(GetEInvoiceSubmissionsQuery q, CancellationToken ct)
    {
        var query = db.EInvoiceSubmissions.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(q.Status)) query = query.Where(s => s.Status == q.Status);
        if (!string.IsNullOrWhiteSpace(q.DocumentType)) query = query.Where(s => s.DocumentType == q.DocumentType);
        if (q.DocumentId is { } d) query = query.Where(s => s.DocumentId == d);

        var total = await query.CountAsync(ct);
        var size = Math.Clamp(q.PageSize, 1, 200);
        var rows = await query.OrderByDescending(s => s.CreatedAt).Skip((Math.Max(q.Page, 1) - 1) * size).Take(size).ToListAsync(ct);
        return Result.Success(new EInvoiceSubmissionListDto(total, rows.Select(EInvoiceMappings.ToDto).ToList()));
    }
}

internal sealed class GetEInvoiceReadinessHandler(FinanceDbContext db) : IQueryHandler<GetEInvoiceReadinessQuery, EInvoiceReadinessDto>
{
    private const int MaxInvoices = 500;

    public async Task<Result<EInvoiceReadinessDto>> Handle(GetEInvoiceReadinessQuery query, CancellationToken ct)
    {
        var supplier = await EInvoiceDocumentFactory.LoadSupplierAsync(db, ct);
        var supplierIssues = PintAeValidator.ValidateSupplier(supplier);

        var settings = await db.EInvoiceSettings.AsNoTracking().FirstOrDefaultAsync(ct);
        var since = !string.IsNullOrWhiteSpace(settings?.GoLiveDate)
            ? settings!.GoLiveDate!
            : DateTime.UtcNow.AddDays(-90).ToString("yyyy-MM-dd");

        var invoices = await db.Invoices.AsNoTracking().Include(x => x.Items)
            .Where(x => x.Status != "cancelled" && string.Compare(x.InvoiceDate, since) >= 0)
            .OrderByDescending(x => x.InvoiceDate).Take(MaxInvoices).ToListAsync(ct);

        var customerIds = invoices.Where(i => i.CustomerId != null).Select(i => i.CustomerId!.Value).Distinct().ToList();
        var customers = await db.Customers.AsNoTracking().Where(c => customerIds.Contains(c.Id)).ToDictionaryAsync(c => c.Id, ct);

        // One rate lookup per foreign currency, not per invoice.
        var today = DateTime.UtcNow.ToString("yyyy-MM-dd");
        var aed = new Dictionary<string, decimal?>(StringComparer.OrdinalIgnoreCase);
        foreach (var cur in invoices.Select(i => i.CurrencyCode).Distinct(StringComparer.OrdinalIgnoreCase)
                     .Where(c => !c.Equals("AED", StringComparison.OrdinalIgnoreCase)))
            aed[cur] = await EInvoiceDocumentFactory.RateToAedPublicAsync(db, cur, today, ct);

        var counts = new Dictionary<string, (string Message, int Count)>();
        var problems = new List<ReadinessProblemDto>();
        var ready = 0;
        foreach (var inv in invoices)
        {
            customers.TryGetValue(inv.CustomerId ?? Guid.Empty, out var customer);
            var doc = EInvoiceDocumentFactory.FromInvoice(inv, customer, supplier,
                aed.TryGetValue(inv.CurrencyCode, out var r) ? r : null);
            // Your own company's gaps are reported once, above, not repeated on every invoice.
            var errors = PintAeValidator.Validate(doc)
                .Where(i => i.Severity == EInvoiceIssue.Error && !i.Code.StartsWith("supplier_")).ToList();
            if (errors.Count == 0) { ready++; continue; }

            foreach (var e in errors)
                counts[e.Code] = counts.TryGetValue(e.Code, out var c) ? (c.Message, c.Count + 1) : (GenericMessage(e), 1);
            if (problems.Count < 60) problems.Add(new("invoice", inv.Id, inv.InvoiceNumber, errors[0].Message));
        }

        var activeCustomers = await db.Customers.AsNoTracking().Where(c => c.IsActive && !c.IsDeleted).ToListAsync(ct);
        var uae = activeCustomers.Where(c => string.IsNullOrWhiteSpace(c.CountryCode) || c.CountryCode.Equals("AE", StringComparison.OrdinalIgnoreCase)).ToList();
        var noTrn = uae.Count(c => string.IsNullOrWhiteSpace(c.Trn));
        var noAddr = uae.Count(c => string.IsNullOrWhiteSpace(c.Address));
        var noEmirate = uae.Count(c => string.IsNullOrWhiteSpace(c.Emirate));

        var byStatus = await db.EInvoiceSubmissions.AsNoTracking().GroupBy(s => s.Status)
            .Select(g => new { Status = g.Key, N = g.Count() }).ToListAsync(ct);
        int Sum(params string[] st) => byStatus.Where(x => st.Contains(x.Status)).Sum(x => x.N);

        return Result.Success(new EInvoiceReadinessDto(
            invoices.Count, ready, invoices.Count - ready,
            uae.Count, noTrn, noAddr, noEmirate,
            supplierIssues.Count == 0, EInvoiceMappings.Issues(supplierIssues),
            problems,
            counts.OrderByDescending(c => c.Value.Count).Select(c => new ReadinessTotalDto(c.Key, c.Value.Message, c.Value.Count)).ToList(),
            Sum(EInvoiceStatus.Queued, EInvoiceStatus.Sending),
            Sum(EInvoiceStatus.Failed, EInvoiceStatus.Rejected, EInvoiceStatus.Blocked),
            Sum(EInvoiceStatus.Sent, EInvoiceStatus.Delivered, EInvoiceStatus.Accepted)));
    }

    /// <summary>Per-line messages name a line number; the totals table wants the rule, not the example.</summary>
    private static string GenericMessage(EInvoiceIssue e) => e.Code switch
    {
        "buyer_trn" => "Customer tax registration number is missing or not 15 digits",
        "buyer_street" => "Customer street address is missing",
        "buyer_city" => "Customer city is missing",
        "buyer_emirate" => "Customer emirate is missing or not a valid code",
        "buyer_name" => "Customer name is missing",
        "buyer_address" => "Customer address is missing",
        "line_exemption_reason" => "A zero-rated, exempt or out-of-scope line has no reason",
        "line_tax_rate" => "A standard-rated line has a zero tax rate",
        "line_quantity" => "A line has a zero or negative quantity",
        "line_description" => "A line has no description",
        "aed_rate" => "A foreign-currency invoice has no exchange rate to AED",
        "lines" => "Invoice has no lines",
        _ => e.Message,
    };
}

// ── Credit notes ──────────────────────────────────────────────────────────────────────────────

internal static class CreditNoteMappings
{
    public static CreditNoteDto ToDto(CreditNote c, string? einvoiceStatus) => new(
        c.Id, c.CreditNoteNumber, c.InvoiceId, c.InvoiceNumber, c.CustomerName, c.CustomerEmail, c.CustomerAddress,
        c.CustomerTrn, c.CreditDate, c.TaxRate, c.CurrencyCode, c.Reason, c.Notes, c.Status, c.SubTotal, c.TaxAmount,
        c.Total, c.JournalEntryId, c.CreatedAt, c.IssuedAt, einvoiceStatus,
        c.Items.Select(i => new CreditNoteItemDto(i.Id, i.Description, i.Quantity, i.UnitPrice, i.LineTotal,
            i.TaxCategory, i.UnitCode, i.ExemptionReason)).ToList());

    public static Task<string?> StatusOfAsync(FinanceDbContext db, Guid id, CancellationToken ct) =>
        db.EInvoiceSubmissions.AsNoTracking().Where(s => s.DocumentType == EInvoiceDocumentTypes.CreditNote && s.DocumentId == id)
            .Select(s => (string?)s.Status).FirstOrDefaultAsync(ct);
}

internal sealed class CreateCreditNoteHandler(FinanceDbContext db) : ICommandHandler<CreateCreditNoteCommand, CreditNoteDto>
{
    public async Task<Result<CreditNoteDto>> Handle(CreateCreditNoteCommand cmd, CancellationToken ct)
    {
        var inv = await db.Invoices.Include(x => x.Items).FirstOrDefaultAsync(x => x.Id == cmd.InvoiceId, ct);
        if (inv is null) return Result.Failure<CreditNoteDto>(Error.NotFoundById("Invoice", cmd.InvoiceId));

        // A draft was never issued: it is edited or deleted, not credited. A cancelled one has no balance to credit.
        if (inv.Status is "draft" or "cancelled")
            return Result.Failure<CreditNoteDto>(Error.Custom("CreditNote.Conflict",
                inv.Status == "draft" ? "A draft invoice is edited directly. Only an issued invoice needs a credit note."
                                      : "A cancelled invoice has nothing left to credit."));

        var date = string.IsNullOrWhiteSpace(cmd.CreditDate) ? DateTime.UtcNow.ToString("yyyy-MM-dd") : cmd.CreditDate!;
        var cn = new CreditNote(inv.Id, inv.InvoiceNumber, inv.CustomerName, inv.CustomerEmail, inv.CustomerAddress, inv.CustomerTrn,
            inv.CustomerId, date, inv.TaxRate, inv.CurrencyCode, cmd.Reason, cmd.Notes);

        if (cmd.Items is { Count: > 0 })
            foreach (var i in cmd.Items)
                cn.Items.Add(new CreditNoteItem(cn.Id, i.Description, i.Quantity, i.UnitPrice, i.TaxCategory, i.UnitCode, i.ExemptionReason));
        else
            foreach (var i in inv.Items)
                cn.Items.Add(new CreditNoteItem(cn.Id, i.Description, i.Quantity, i.UnitPrice, i.TaxCategory, i.UnitCode, i.ExemptionReason));

        var creditable = inv.Total - inv.CreditedAmount;
        if (cn.Total > creditable + 0.01m)
            return Result.Failure<CreditNoteDto>(Error.Custom("CreditNote.Conflict",
                $"This credit note is for {cn.Total:N2}, but only {creditable:N2} of the invoice can still be credited."));
        if (cn.Total <= 0)
            return Result.Failure<CreditNoteDto>(Error.Custom("CreditNote.Conflict", "A credit note needs at least one line with an amount."));

        db.CreditNotes.Add(cn);
        await db.SaveChangesAsync(ct);
        return Result.Success(CreditNoteMappings.ToDto(cn, null));
    }
}

internal sealed class IssueCreditNoteHandler(FinanceDbContext db, ILogger<IssueCreditNoteHandler> logger)
    : ICommandHandler<IssueCreditNoteCommand, CreditNoteDto>
{
    public async Task<Result<CreditNoteDto>> Handle(IssueCreditNoteCommand cmd, CancellationToken ct)
    {
        var cn = await db.CreditNotes.Include(x => x.Items).FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (cn is null) return Result.Failure<CreditNoteDto>(Error.NotFoundById("Credit note", cmd.Id));
        if (cn.Status != "draft")
            return Result.Failure<CreditNoteDto>(Error.Custom("CreditNote.Conflict", $"A {cn.Status} credit note cannot be issued."));

        // Items are needed: an invoice's total is computed from its lines, and without them it reads as zero.
        var inv = await db.Invoices.Include(x => x.Items).FirstOrDefaultAsync(x => x.Id == cn.InvoiceId, ct);
        if (inv is null) return Result.Failure<CreditNoteDto>(Error.NotFoundById("Invoice", cn.InvoiceId));
        if (inv.Status is "draft" or "cancelled")
            return Result.Failure<CreditNoteDto>(Error.Custom("CreditNote.Conflict", "The invoice is no longer issued, so it cannot be credited."));

        // Re-checked at issue: another credit note may have been issued since this one was drafted.
        var creditable = inv.Total - inv.CreditedAmount;
        if (cn.Total > creditable + 0.01m)
            return Result.Failure<CreditNoteDto>(Error.Custom("CreditNote.Conflict",
                $"This credit note is for {cn.Total:N2}, but only {creditable:N2} of the invoice can still be credited."));

        if (await GlPoster.IsPeriodClosedAsync(db, cn.CreditDate, ct))
            return Result.Failure<CreditNoteDto>(Error.Custom("FiscalPeriod.Locked", $"The fiscal period for {cn.CreditDate} is closed for posting."));

        // The sale in reverse: revenue and VAT come back, the customer owes less.
        var rate = await GlPoster.GetRateAsync(db, cn.CurrencyCode, cn.CreditDate, ct);
        var lines = new List<GlPoster.Line>
        {
            new(GlPoster.SalesRevenue, cn.SubTotal * rate, 0, $"Credit note {cn.CreditNoteNumber} - Invoice {cn.InvoiceNumber}"),
            new(GlPoster.AccountsReceivable, 0, cn.Total * rate, $"Credit note {cn.CreditNoteNumber} - {cn.CustomerName}"),
        };
        if (cn.TaxAmount > 0)
            lines.Add(new(GlPoster.VatPayable, cn.TaxAmount * rate, 0, $"VAT reversed - Credit note {cn.CreditNoteNumber}"));

        var entryId = await GlPoster.PostAsync(db, cn.CreditDate, $"Credit Note {cn.CreditNoteNumber}", cn.CreditNoteNumber, lines, ct);
        cn.Issue(entryId);
        inv.ApplyCredit(cn.Total);

        // Committed before queueing: a credit note that exists but was not queued can be queued again.
        await db.SaveChangesAsync(ct);

        await EInvoiceQueue.EnqueueIfEnabledAsync(db, EInvoiceDocumentTypes.CreditNote, cn.Id, cn.CreditDate, logger, ct);
        return Result.Success(CreditNoteMappings.ToDto(cn, await CreditNoteMappings.StatusOfAsync(db, cn.Id, ct)));
    }
}

internal sealed class CancelCreditNoteHandler(FinanceDbContext db) : ICommandHandler<CancelCreditNoteCommand>
{
    public async Task<Result> Handle(CancelCreditNoteCommand cmd, CancellationToken ct)
    {
        var cn = await db.CreditNotes.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (cn is null) return Result.Failure(Error.NotFoundById("Credit note", cmd.Id));
        if (cn.Status != "draft")
            return Result.Failure(Error.Custom("CreditNote.Conflict",
                "Only a draft credit note can be cancelled. An issued one is part of the books; issue a new invoice if it was a mistake."));
        cn.Cancel();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class GetCreditNotesHandler(FinanceDbContext db) : IQueryHandler<GetCreditNotesQuery, IReadOnlyList<CreditNoteSummaryDto>>
{
    public async Task<Result<IReadOnlyList<CreditNoteSummaryDto>>> Handle(GetCreditNotesQuery q, CancellationToken ct)
    {
        var query = db.CreditNotes.AsNoTracking().Include(x => x.Items).Where(x => !x.IsDeleted);
        if (q.InvoiceId is { } id) query = query.Where(x => x.InvoiceId == id);
        if (!string.IsNullOrWhiteSpace(q.Status)) query = query.Where(x => x.Status == q.Status);
        var rows = await query.OrderByDescending(x => x.CreatedAt).Take(500).ToListAsync(ct);

        var ids = rows.Select(r => r.Id).ToList();
        var sub = await db.EInvoiceSubmissions.AsNoTracking()
            .Where(s => s.DocumentType == EInvoiceDocumentTypes.CreditNote && ids.Contains(s.DocumentId))
            .ToDictionaryAsync(s => s.DocumentId, s => s.Status, ct);

        IReadOnlyList<CreditNoteSummaryDto> list = rows.Select(c => new CreditNoteSummaryDto(
            c.Id, c.CreditNoteNumber, c.InvoiceId, c.InvoiceNumber, c.CustomerName, c.CreditDate, c.CurrencyCode,
            c.Reason, c.Status, c.Total, sub.GetValueOrDefault(c.Id))).ToList();
        return Result.Success(list);
    }
}

internal sealed class GetCreditNoteByIdHandler(FinanceDbContext db) : IQueryHandler<GetCreditNoteByIdQuery, CreditNoteDto>
{
    public async Task<Result<CreditNoteDto>> Handle(GetCreditNoteByIdQuery q, CancellationToken ct)
    {
        var cn = await db.CreditNotes.AsNoTracking().Include(x => x.Items).FirstOrDefaultAsync(x => x.Id == q.Id && !x.IsDeleted, ct);
        if (cn is null) return Result.Failure<CreditNoteDto>(Error.NotFoundById("Credit note", q.Id));
        return Result.Success(CreditNoteMappings.ToDto(cn, await CreditNoteMappings.StatusOfAsync(db, cn.Id, ct)));
    }
}
