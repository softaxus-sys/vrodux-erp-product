using System.Globalization;
using System.Xml;
using System.Xml.Linq;
using Softaxis.Finance.Application.UaeVat;

namespace Softaxis.Finance.Application.EInvoicing;

/// <summary>A seller or buyer as it must appear on a PINT AE invoice.</summary>
public sealed record PintAeParty(
    string  Name,
    string? Trn,
    string? Street,
    string? City,
    /// <summary>Emirate code (AUH, DXB, …) — goes to CountrySubentity for UAE parties.</summary>
    string? Emirate,
    string  CountryCode,
    /// <summary>Peppol participant id ("scheme:id"); when absent a UAE TRN is used under scheme 0235.</summary>
    string? PeppolId = null,
    string? Email = null);

public sealed record PintAeLine(
    int     LineNumber,
    string  Description,
    decimal Quantity,
    string  UnitCode,
    decimal UnitPrice,
    /// <summary>S, Z, E or O.</summary>
    string  TaxCategory,
    decimal TaxPercent,
    string? ExemptionReason);

public sealed record PintAeInvoice(
    string  InvoiceNumber,
    string  IssueDate,          // yyyy-MM-dd
    string? DueDate,            // yyyy-MM-dd
    string  CurrencyCode,
    /// <summary>Units of AED per one unit of <see cref="CurrencyCode"/>; 1 for AED invoices.</summary>
    decimal AedRate,
    PintAeParty Seller,
    PintAeParty Buyer,
    IReadOnlyList<PintAeLine> Lines,
    decimal PrepaidAmount = 0m,
    string? Note = null,
    /// <summary>380 commercial invoice. 381 (credit note) needs a different root and is not built yet.</summary>
    string  InvoiceTypeCode = "380");

public sealed record PintAeIssue(string Severity, string Code, string Message);

/// <summary>
/// Builds a UAE PINT AE invoice as UBL 2.1 XML, and checks it before anything is sent.
///
/// <para><b>Source of truth.</b> The structure follows UBL 2.1 and the Peppol PINT billing
/// specification as published for the UAE. The identifiers below (<see cref="CustomizationId"/>,
/// <see cref="ProfileId"/>, <see cref="TrnScheme"/>) are the values the published material uses,
/// but the FTA's final PINT AE data dictionary and the chosen ASP's own validation rules are what
/// the document will actually be judged against — check them against both before production use.
/// They are constants, not scattered literals, so updating them is a one-place change.</para>
///
/// <para>Pure: no database, no clock, no network.</para>
/// </summary>
public static class PintAeBuilder
{
    public const string CustomizationId = "urn:peppol:pint:billing-1@ae-1";
    public const string ProfileId       = "urn:peppol:bis:billing";
    /// <summary>Electronic address scheme for a UAE TRN.</summary>
    public const string TrnScheme       = "0235";

    private static readonly XNamespace Inv = "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2";
    private static readonly XNamespace Cac = "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2";
    private static readonly XNamespace Cbc = "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2";

    private static readonly string[] Categories = ["S", "Z", "E", "O"];

    // ── Totals (shared by builder and tests so the document and the checks cannot disagree) ──

    public static decimal LineAmount(PintAeLine l) => R(l.Quantity * l.UnitPrice);

    /// <summary>VAT per (category, rate), each rounded once — never summed from rounded line VAT.</summary>
    public static IReadOnlyList<(string Category, decimal Percent, decimal Taxable, decimal Tax, string? Reason)> TaxBreakdown(PintAeInvoice inv) =>
        inv.Lines
            .GroupBy(l => (Cat: Norm(l.TaxCategory), Pct: Norm(l.TaxCategory) == "S" ? l.TaxPercent : 0m))
            .Select(g =>
            {
                var taxable = g.Sum(LineAmount);
                var tax     = g.Key.Cat == "S" ? R(taxable * g.Key.Pct / 100m) : 0m;
                var reason  = g.Select(l => l.ExemptionReason).FirstOrDefault(r => !string.IsNullOrWhiteSpace(r));
                return (g.Key.Cat, g.Key.Pct, taxable, tax, reason);
            })
            .OrderBy(t => Array.IndexOf(Categories, t.Cat)).ThenBy(t => t.Pct)
            .ToList();

    public static (decimal LineTotal, decimal Tax, decimal Inclusive, decimal Payable) Totals(PintAeInvoice inv)
    {
        var line = inv.Lines.Sum(LineAmount);
        var tax  = TaxBreakdown(inv).Sum(t => t.Tax);
        var incl = line + tax;
        return (line, tax, incl, incl - R(inv.PrepaidAmount));
    }

    // ── Validation ──────────────────────────────────────────────────────────────────────────

    public static IReadOnlyList<PintAeIssue> Validate(PintAeInvoice inv)
    {
        var issues = new List<PintAeIssue>();
        void Err(string code, string msg)  => issues.Add(new("error", code, msg));
        void Warn(string code, string msg) => issues.Add(new("warning", code, msg));

        if (string.IsNullOrWhiteSpace(inv.InvoiceNumber)) Err("Invoice.Number", "The invoice has no number.");
        if (!IsDate(inv.IssueDate)) Err("Invoice.IssueDate", "The issue date must be a valid yyyy-MM-dd date.");
        if (inv.DueDate is not null && !IsDate(inv.DueDate)) Err("Invoice.DueDate", "The due date must be a valid yyyy-MM-dd date.");
        if (inv.CurrencyCode is not { Length: 3 }) Err("Invoice.Currency", "The invoice currency must be a 3-letter ISO code.");
        if (!inv.CurrencyCode.Equals("AED", StringComparison.OrdinalIgnoreCase) && inv.AedRate <= 0)
            Err("Invoice.AedRate", $"The invoice is in {inv.CurrencyCode} and no exchange rate to AED exists. The VAT total must also be stated in AED.");

        // Seller: must be a UAE VAT registrant, or there is nothing to send.
        if (string.IsNullOrWhiteSpace(inv.Seller.Name)) Err("Seller.Name", "The seller's legal name is missing (Settings → General → Company, or the VAT registration).");
        if (!UaeVatReturnBuilder.IsValidTrn(inv.Seller.Trn))
            Err("Seller.Trn", "The seller TRN must be 15 digits starting with 100. Set it in the VAT registration.");
        if (string.IsNullOrWhiteSpace(inv.Seller.Street) && string.IsNullOrWhiteSpace(inv.Seller.City))
            Warn("Seller.Address", "The seller address is empty.");

        // Buyer.
        if (string.IsNullOrWhiteSpace(inv.Buyer.Name)) Err("Buyer.Name", "The customer name is missing.");
        var buyerUae = inv.Buyer.CountryCode.Equals("AE", StringComparison.OrdinalIgnoreCase);
        if (!string.IsNullOrWhiteSpace(inv.Buyer.Trn) && buyerUae && !UaeVatReturnBuilder.IsValidTrn(inv.Buyer.Trn))
            Err("Buyer.Trn", "The customer TRN must be 15 digits starting with 100. Correct it on the customer or the invoice.");
        if (string.IsNullOrWhiteSpace(inv.Buyer.PeppolId) && string.IsNullOrWhiteSpace(inv.Buyer.Trn))
            Warn("Buyer.Address", "The customer has no TRN or Peppol ID, so the ASP has no electronic address to deliver to.");
        if (buyerUae && string.IsNullOrWhiteSpace(inv.Buyer.Emirate))
            Warn("Buyer.Emirate", "The customer's emirate is not set.");

        // Lines.
        if (inv.Lines.Count == 0) Err("Lines.Empty", "The invoice has no lines.");
        foreach (var l in inv.Lines)
        {
            var at = $"Line {l.LineNumber}";
            var cat = Norm(l.TaxCategory);
            if (string.IsNullOrWhiteSpace(l.Description)) Err("Line.Description", $"{at} has no description.");
            if (l.Quantity <= 0) Err("Line.Quantity", $"{at} has a quantity of zero or less.");
            if (l.UnitPrice < 0) Err("Line.Price", $"{at} has a negative price — issue a credit note instead.");
            if (!Categories.Contains(cat)) Err("Line.Category", $"{at} has an unknown VAT category '{l.TaxCategory}'.");
            if (cat == "S" && l.TaxPercent != UaeVatReturnBuilder.StandardRate)
                Err("Line.Rate", $"{at} is standard-rated at {l.TaxPercent:0.##}%. UAE standard rate is 5%.");
            if (cat is "E" or "O" && string.IsNullOrWhiteSpace(l.ExemptionReason))
                Err("Line.Reason", $"{at} is {(cat == "E" ? "exempt" : "out of scope")} and needs a reason.");
            if (string.IsNullOrWhiteSpace(l.UnitCode))
                Warn("Line.Unit", $"{at} has no unit code; C62 (one) will be used.");
        }

        return issues;
    }

    public static bool HasErrors(IEnumerable<PintAeIssue> issues) => issues.Any(i => i.Severity == "error");

    // ── XML ─────────────────────────────────────────────────────────────────────────────────

    public static string Build(PintAeInvoice inv)
    {
        var cur  = inv.CurrencyCode.ToUpperInvariant();
        var tot  = Totals(inv);
        var tax  = TaxBreakdown(inv);

        var root = new XElement(Inv + "Invoice",
            new XAttribute(XNamespace.Xmlns + "cac", Cac),
            new XAttribute(XNamespace.Xmlns + "cbc", Cbc),
            new XElement(Cbc + "CustomizationID", CustomizationId),
            new XElement(Cbc + "ProfileID", ProfileId),
            new XElement(Cbc + "ID", inv.InvoiceNumber),
            new XElement(Cbc + "IssueDate", inv.IssueDate),
            inv.DueDate is null ? null : new XElement(Cbc + "DueDate", inv.DueDate),
            new XElement(Cbc + "InvoiceTypeCode", inv.InvoiceTypeCode),
            string.IsNullOrWhiteSpace(inv.Note) ? null : new XElement(Cbc + "Note", inv.Note),
            new XElement(Cbc + "DocumentCurrencyCode", cur),
            cur == "AED" ? null : new XElement(Cbc + "TaxCurrencyCode", "AED"),
            new XElement(Cac + "AccountingSupplierParty", Party(inv.Seller)),
            new XElement(Cac + "AccountingCustomerParty", Party(inv.Buyer)),
            TaxTotal(tax, cur, withSubtotals: true),
            // The VAT total must also be stated in AED when the invoice is in another currency.
            cur == "AED" ? null : new XElement(Cac + "TaxTotal",
                Amt("TaxAmount", R(tot.Tax * inv.AedRate), "AED")),
            new XElement(Cac + "LegalMonetaryTotal",
                Amt("LineExtensionAmount", tot.LineTotal, cur),
                Amt("TaxExclusiveAmount", tot.LineTotal, cur),
                Amt("TaxInclusiveAmount", tot.Inclusive, cur),
                inv.PrepaidAmount > 0 ? Amt("PrepaidAmount", R(inv.PrepaidAmount), cur) : null,
                Amt("PayableAmount", tot.Payable, cur)),
            inv.Lines.Select(l => Line(l, cur)));

        var doc = new XDocument(new XDeclaration("1.0", "UTF-8", null), root);
        using var sw = new Utf8StringWriter();
        using (var xw = XmlWriter.Create(sw, new XmlWriterSettings { Indent = true, Encoding = new System.Text.UTF8Encoding(false) }))
            doc.Save(xw);
        return sw.ToString();
    }

    private static XElement Party(PintAeParty p)
    {
        var country = string.IsNullOrWhiteSpace(p.CountryCode) ? "AE" : p.CountryCode.ToUpperInvariant();
        var (scheme, id) = Endpoint(p, country);

        return new XElement(Cac + "Party",
            id is null ? null : new XElement(Cbc + "EndpointID", new XAttribute("schemeID", scheme!), id),
            new XElement(Cac + "PartyName", new XElement(Cbc + "Name", p.Name)),
            new XElement(Cac + "PostalAddress",
                string.IsNullOrWhiteSpace(p.Street) ? null : new XElement(Cbc + "StreetName", p.Street),
                string.IsNullOrWhiteSpace(p.City) ? null : new XElement(Cbc + "CityName", p.City),
                string.IsNullOrWhiteSpace(p.Emirate) ? null : new XElement(Cbc + "CountrySubentity", p.Emirate!.ToUpperInvariant()),
                new XElement(Cac + "Country", new XElement(Cbc + "IdentificationCode", country))),
            string.IsNullOrWhiteSpace(p.Trn) ? null : new XElement(Cac + "PartyTaxScheme",
                new XElement(Cbc + "CompanyID", p.Trn),
                new XElement(Cac + "TaxScheme", new XElement(Cbc + "ID", "VAT"))),
            new XElement(Cac + "PartyLegalEntity", new XElement(Cbc + "RegistrationName", p.Name)),
            string.IsNullOrWhiteSpace(p.Email) ? null : new XElement(Cac + "Contact", new XElement(Cbc + "ElectronicMail", p.Email)));
    }

    /// <summary>Peppol id if given as "scheme:id"; otherwise a UAE TRN under scheme 0235.</summary>
    private static (string? Scheme, string? Id) Endpoint(PintAeParty p, string country)
    {
        if (!string.IsNullOrWhiteSpace(p.PeppolId))
        {
            var parts = p.PeppolId.Split(':', 2, StringSplitOptions.TrimEntries);
            if (parts.Length == 2 && parts[0].Length > 0 && parts[1].Length > 0) return (parts[0], parts[1]);
        }
        if (country == "AE" && !string.IsNullOrWhiteSpace(p.Trn)) return (TrnScheme, p.Trn);
        return (null, null);
    }

    private static XElement TaxTotal(
        IReadOnlyList<(string Category, decimal Percent, decimal Taxable, decimal Tax, string? Reason)> tax,
        string cur, bool withSubtotals) =>
        new(Cac + "TaxTotal",
            Amt("TaxAmount", tax.Sum(t => t.Tax), cur),
            withSubtotals ? tax.Select(t => new XElement(Cac + "TaxSubtotal",
                Amt("TaxableAmount", t.Taxable, cur),
                Amt("TaxAmount", t.Tax, cur),
                Category(t.Category, t.Percent, t.Reason, "TaxCategory"))) : null);

    private static XElement Line(PintAeLine l, string cur)
    {
        var cat = Norm(l.TaxCategory);
        return new XElement(Cac + "InvoiceLine",
            new XElement(Cbc + "ID", l.LineNumber.ToString(CultureInfo.InvariantCulture)),
            new XElement(Cbc + "InvoicedQuantity",
                new XAttribute("unitCode", string.IsNullOrWhiteSpace(l.UnitCode) ? "C62" : l.UnitCode.ToUpperInvariant()),
                l.Quantity.ToString("0.####", CultureInfo.InvariantCulture)),
            Amt("LineExtensionAmount", LineAmount(l), cur),
            new XElement(Cac + "Item",
                new XElement(Cbc + "Name", l.Description),
                Category(cat, cat == "S" ? l.TaxPercent : 0m, null, "ClassifiedTaxCategory")),
            new XElement(Cac + "Price", Amt("PriceAmount", l.UnitPrice, cur, decimals: 4)));
    }

    private static XElement Category(string cat, decimal pct, string? reason, string element) =>
        new(Cac + element,
            new XElement(Cbc + "ID", cat),
            new XElement(Cbc + "Percent", pct.ToString("0.##", CultureInfo.InvariantCulture)),
            cat is "S" || string.IsNullOrWhiteSpace(reason) ? null : new XElement(Cbc + "TaxExemptionReason", reason),
            new XElement(Cac + "TaxScheme", new XElement(Cbc + "ID", "VAT")));

    private static XElement Amt(string name, decimal value, string cur, int decimals = 2) =>
        new(Cbc + name, new XAttribute("currencyID", cur),
            value.ToString(decimals == 2 ? "0.00" : "0.00##", CultureInfo.InvariantCulture));

    private static string Norm(string? c) => string.IsNullOrWhiteSpace(c) ? "S" : c.Trim().ToUpperInvariant();
    private static decimal R(decimal v) => Math.Round(v, 2, MidpointRounding.AwayFromZero);
    private static bool IsDate(string? s) =>
        DateOnly.TryParseExact(s, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _);

    private sealed class Utf8StringWriter : StringWriter
    {
        public override System.Text.Encoding Encoding => new System.Text.UTF8Encoding(false);
    }
}
