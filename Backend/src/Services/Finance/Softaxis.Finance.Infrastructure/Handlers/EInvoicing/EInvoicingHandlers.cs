using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.EInvoicing;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Handlers.GeneralLedger;
using Softaxis.Finance.Infrastructure.Persistence;
using Softaxis.Finance.Infrastructure.Services;

namespace Softaxis.Finance.Infrastructure.Handlers.EInvoicing;

/// <summary>Reads an invoice and everything around it into the builder's input. Shared by preview and send.</summary>
internal static class PintAeInputFactory
{
    /// <summary>Statuses whose invoice has been issued. A draft is not a tax invoice and must not be sent.</summary>
    public static readonly string[] IssuedStatuses = ["sent", "partially_paid", "paid", "overdue"];

    public static async Task<(Invoice? Invoice, PintAeInvoice? Input)> LoadAsync(FinanceDbContext db, Guid invoiceId, CancellationToken ct)
    {
        var invoice = await db.Invoices.AsNoTracking().Include(i => i.Items)
            .FirstOrDefaultAsync(i => i.Id == invoiceId && !i.IsDeleted, ct);
        if (invoice is null) return (null, null);

        // Seller: the VAT registration is the authoritative tax identity; the company settings fill gaps.
        var profile  = await db.UaeVatProfiles.AsNoTracking().FirstOrDefaultAsync(ct);
        var branding = await RecurringInvoiceGenerator.ResolveBrandingAsync(db, ct);
        var sellerAddress = profile?.Address ?? branding.Address;
        var seller = new PintAeParty(
            Name:        string.IsNullOrWhiteSpace(profile?.NameEn) ? branding.Name : profile!.NameEn,
            Trn:         Clean(profile?.Trn) ?? Clean(branding.TaxNumber),
            Street:      FirstLine(sellerAddress),
            City:        SecondLine(sellerAddress),
            Emirate:     profile?.DefaultEmirate,
            CountryCode: "AE",
            Email:       branding.Email);

        // Buyer: what is printed on the invoice wins (it is what the customer received); the customer
        // record supplies what an invoice does not carry — country, emirate, city, Peppol id.
        Customer? customer = invoice.CustomerId is { } cid
            ? await db.Customers.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cid, ct)
            : null;
        var buyerAddress = invoice.CustomerAddress ?? customer?.Address;
        var buyer = new PintAeParty(
            Name:        invoice.CustomerName,
            Trn:         Clean(invoice.CustomerTrn) ?? Clean(customer?.Trn),
            Street:      FirstLine(buyerAddress),
            City:        customer?.City ?? SecondLine(buyerAddress),
            Emirate:     customer?.Emirate,
            CountryCode: customer?.CountryCode ?? "AE",
            PeppolId:    customer?.PeppolId,
            Email:       invoice.CustomerEmail ?? customer?.Email);

        var currency = string.IsNullOrWhiteSpace(invoice.CurrencyCode) ? "AED" : invoice.CurrencyCode.ToUpperInvariant();
        // Same rate the ledger posted with, so the AED VAT total agrees with the VAT return.
        var aedRate = currency == "AED" ? 1m : await GlPoster.GetRateAsync(db, currency, invoice.InvoiceDate, ct);

        var n = 0;
        var lines = invoice.Items.Select(i => new PintAeLine(
            ++n, i.Description, i.Quantity, i.UnitCode ?? "C62", i.UnitPrice,
            i.TaxCategory ?? VatCategory.Standard,
            VatCategory.IsStandard(i.TaxCategory) ? invoice.TaxRate : 0m,
            i.ExemptionReason)).ToList();

        var input = new PintAeInvoice(
            invoice.InvoiceNumber, invoice.InvoiceDate,
            string.IsNullOrWhiteSpace(invoice.DueDate) ? null : invoice.DueDate,
            currency, aedRate, seller, buyer, lines,
            PrepaidAmount: invoice.AmountPaid,
            Note: invoice.Notes);

        return (invoice, input);
    }

    private static string? Clean(string? v) => string.IsNullOrWhiteSpace(v) ? null : v.Replace(" ", "").Trim();
    private static string[] Lines(string? a) =>
        (a ?? string.Empty).Split(['\n', '\r'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    private static string? FirstLine(string? a)  => Lines(a).FirstOrDefault();
    private static string? SecondLine(string? a) => Lines(a).Skip(1).FirstOrDefault();
}

internal static class EInvoiceMap
{
    public static EInvoiceSubmissionDto ToDto(EInvoiceSubmission s) => new(
        s.Id, s.Status, s.Provider, s.Environment, s.ProviderMessageId, s.HttpStatus,
        s.ResponseSnippet, s.SubmittedByName, s.CreatedAt, s.CompletedAt);
}

internal sealed class GetEInvoiceStatusHandler(FinanceDbContext db, IEInvoiceGateway gateway)
    : IQueryHandler<GetEInvoiceStatusQuery, EInvoiceStatusDto>
{
    public async Task<Result<EInvoiceStatusDto>> Handle(GetEInvoiceStatusQuery q, CancellationToken ct)
    {
        var (invoice, input) = await PintAeInputFactory.LoadAsync(db, q.InvoiceId, ct);
        if (invoice is null || input is null)
            return Result.Failure<EInvoiceStatusDto>(Error.Custom("EInvoice.NotFound", "Invoice not found."));

        var issues = PintAeBuilder.Validate(input).ToList();
        if (!PintAeInputFactory.IssuedStatuses.Contains(invoice.Status))
            issues.Insert(0, new("error", "Invoice.NotIssued", "Only an issued invoice can be sent. Send it to the customer first — a draft is not a tax invoice."));

        var history = await db.EInvoiceSubmissions.AsNoTracking()
            .Where(s => s.InvoiceId == invoice.Id).OrderByDescending(s => s.CreatedAt).ToListAsync(ct);
        var alreadyActive = history.Any(s => s.IsActive);

        return Result.Success(new EInvoiceStatusDto(
            invoice.Id, invoice.InvoiceNumber, gateway.IsConfigured, gateway.ProviderName, gateway.Environment,
            PintAeBuilder.Build(input), issues,
            CanSubmit: !PintAeBuilder.HasErrors(issues) && !alreadyActive,
            history.Select(EInvoiceMap.ToDto).ToList()));
    }
}

/// <summary>
/// Claim, then send. The submission row (status <c>sending</c>, active) is committed BEFORE the
/// request goes out: the filtered unique index allows one active row per invoice, so a double
/// click or a second user cannot put the same invoice in flight twice. The row is then completed
/// with the ASP's answer. A rejected or failed attempt releases the slot so it can be sent again.
/// </summary>
internal sealed class SubmitEInvoiceHandler(FinanceDbContext db, IEInvoiceGateway gateway)
    : ICommandHandler<SubmitEInvoiceCommand, EInvoiceSubmissionDto>
{
    public async Task<Result<EInvoiceSubmissionDto>> Handle(SubmitEInvoiceCommand cmd, CancellationToken ct)
    {
        var (invoice, input) = await PintAeInputFactory.LoadAsync(db, cmd.InvoiceId, ct);
        if (invoice is null || input is null)
            return Result.Failure<EInvoiceSubmissionDto>(Error.Custom("EInvoice.NotFound", "Invoice not found."));

        if (!PintAeInputFactory.IssuedStatuses.Contains(invoice.Status))
            return Result.Failure<EInvoiceSubmissionDto>(Error.Custom("EInvoice.Invalid",
                "Only an issued invoice can be sent. Send it to the customer first."));

        var issues = PintAeBuilder.Validate(input);
        if (PintAeBuilder.HasErrors(issues))
            return Result.Failure<EInvoiceSubmissionDto>(Error.Custom("EInvoice.Invalid",
                "The e-invoice has errors: " + string.Join(" ", issues.Where(i => i.Severity == "error").Select(i => i.Message))));

        if (await db.EInvoiceSubmissions.AnyAsync(s => s.InvoiceId == invoice.Id && s.IsActive, ct))
            return Result.Failure<EInvoiceSubmissionDto>(Error.Custom("EInvoice.Conflict",
                "This invoice has already been sent to the ASP, or is being sent now. Correct it with a credit note instead."));

        var xml = PintAeBuilder.Build(input);
        var submission = new EInvoiceSubmission(invoice.Id, invoice.InvoiceNumber, xml,
            gateway.ProviderName, gateway.Environment, cmd.UserId, cmd.UserName);

        if (!gateway.IsConfigured)
        {
            // Record the attempt honestly; never hold the slot or claim a send.
            submission.Complete(EInvoiceStatus.NotConfigured, null, null,
                "No Accredited Service Provider is configured, so nothing was sent. Download the XML to check it.");
            db.EInvoiceSubmissions.Add(submission);
            await db.SaveChangesAsync(ct);
            return Result.Success(EInvoiceMap.ToDto(submission));
        }

        db.EInvoiceSubmissions.Add(submission);
        try
        {
            await db.SaveChangesAsync(ct);   // the claim
        }
        catch (DbUpdateException)
        {
            return Result.Failure<EInvoiceSubmissionDto>(Error.Custom("EInvoice.Conflict",
                "This invoice is already being sent."));
        }

        EInvoiceSendResult result;
        try
        {
            result = await gateway.SendAsync(invoice.InvoiceNumber, xml, submission.Id.ToString(), CancellationToken.None);
        }
        catch (Exception ex)
        {
            result = new(EInvoiceStatus.Failed, null, null, $"Sending failed: {ex.Message}");
        }

        submission.Complete(result.Outcome, result.HttpStatus, result.ProviderMessageId, result.Message);
        await db.SaveChangesAsync(CancellationToken.None);
        return Result.Success(EInvoiceMap.ToDto(submission));
    }
}
