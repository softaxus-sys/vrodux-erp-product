using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Xml;

namespace Softaxis.Finance.Application.EInvoicing;

/// <summary>A party on an e-invoice, already resolved to what PINT AE needs.</summary>
public sealed record EInvoiceParty(
    string  Name,
    string? Trn,
    string? LegalIdScheme,      // AE:TL | AE:EID | AE:PAS | AE:CD
    string? LegalId,
    string? RegistrationAuthority,
    string? Street,
    string? City,
    string? Emirate,            // AUH DXB SHJ AJM UAQ RAK FUJ
    string? CountryCode,
    string? PeppolId);          // "0235:1234567890" or null

public sealed record EInvoiceLine(
    string  Description,
    decimal Quantity,
    string? UnitCode,
    decimal UnitPrice,
    string  TaxCategory,        // S Z E O
    decimal TaxRate,
    string? ExemptionReason);

/// <summary>Everything the builder needs, with no database or HTTP in sight so it can be tested alone.</summary>
public sealed record EInvoiceDocument(
    bool    IsCreditNote,
    string  Number,
    string  IssueDate,          // yyyy-MM-dd
    string? DueDate,
    string  CurrencyCode,
    decimal? AedRate,           // units of AED per unit of CurrencyCode; null when CurrencyCode is AED
    string? Note,
    string? CreditReason,
    string? OriginalInvoiceNumber,
    string? OriginalInvoiceDate,
    EInvoiceParty Supplier,
    EInvoiceParty Buyer,
    IReadOnlyList<EInvoiceLine> Lines);

public sealed record EInvoiceIssue(string Severity, string Code, string Message)
{
    public const string Error = "error";
    public const string Warning = "warning";
}

public sealed record EInvoiceTotals(decimal LineExtension, decimal TaxExclusive, decimal TaxTotal, decimal TaxInclusive,
    IReadOnlyList<EInvoiceTaxBreakdown> Breakdown, decimal? TaxTotalAed);

public sealed record EInvoiceTaxBreakdown(string Category, decimal Rate, decimal Taxable, decimal Tax, string? Reason);

public static class PintAeCodes
{
    public const string CustomizationId = "urn:peppol:pint:billing-1@ae-1";
    public const string ProfileId       = "urn:peppol:bis:billing";
    public const string EndpointScheme  = "0235";
    /// <summary>Endpoint the specification reserves for a buyer that is not on the network.</summary>
    public const string BuyerNotOnPeppol = "9900000098";

    public static readonly IReadOnlyList<string> Emirates = ["AUH", "DXB", "SHJ", "AJM", "UAQ", "RAK", "FUJ"];
    public static readonly IReadOnlyList<string> LegalIdSchemes = ["AE:TL", "AE:EID", "AE:PAS", "AE:CD"];

    /// <summary>UN/ECE Recommendation 20 codes commonly sold. Not the whole list: an unknown code is a warning, not an error.</summary>
    public static readonly IReadOnlySet<string> CommonUnitCodes = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "C62", "H87", "EA", "HUR", "DAY", "MON", "WEE", "ANN", "KGM", "GRM", "TNE", "LTR", "MLT", "MTR", "CMT", "MMT",
        "MTK", "MTQ", "BX", "PK", "SET", "PR", "DZN", "CS", "KMT", "KWH", "MWH", "LS", "NMP",
    };
}

public static class PintAeValidator
{
    public static bool IsValidTrn(string? trn) =>
        trn is { Length: 15 } && trn.All(char.IsAsciiDigit);

    /// <summary>The 10-digit network identifier: the first ten digits of the TRN.</summary>
    public static string? TinFromTrn(string? trn) => IsValidTrn(trn) ? trn![..10] : null;

    public static EInvoiceTotals Totals(EInvoiceDocument d)
    {
        decimal R(decimal v) => Math.Round(v, 2, MidpointRounding.AwayFromZero);

        var lines = d.Lines.Select(l => (Line: l, Net: R(l.Quantity * l.UnitPrice))).ToList();
        var breakdown = lines
            .GroupBy(x => (Cat: x.Line.TaxCategory.ToUpperInvariant(), x.Line.TaxRate, Reason: x.Line.ExemptionReason))
            .Select(g =>
            {
                var taxable = g.Sum(x => x.Net);
                var tax = g.Key.Cat == "S" ? R(taxable * g.Key.TaxRate / 100) : 0m;
                return new EInvoiceTaxBreakdown(g.Key.Cat, g.Key.Cat == "S" ? g.Key.TaxRate : 0m, taxable, tax, g.Key.Reason);
            })
            .OrderBy(b => b.Category).ThenBy(b => b.Rate)
            .ToList();

        var ext = lines.Sum(x => x.Net);
        var tax = breakdown.Sum(b => b.Tax);
        decimal? aed = d.CurrencyCode.Equals("AED", StringComparison.OrdinalIgnoreCase) ? null
            : d.AedRate is { } rate ? R(tax * rate) : null;
        return new EInvoiceTotals(ext, ext, tax, ext + tax, breakdown, aed);
    }

    public static IReadOnlyList<EInvoiceIssue> Validate(EInvoiceDocument d)
    {
        var issues = new List<EInvoiceIssue>();
        void Err(string code, string msg) => issues.Add(new(EInvoiceIssue.Error, code, msg));
        void Warn(string code, string msg) => issues.Add(new(EInvoiceIssue.Warning, code, msg));

        if (string.IsNullOrWhiteSpace(d.Number)) Err("number", "The document has no number.");
        DateOnly issue = default;
        if (!DateOnly.TryParseExact(d.IssueDate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out issue))
            Err("issue_date", "The issue date is missing or not a valid date.");
        if (!string.IsNullOrWhiteSpace(d.DueDate))
        {
            if (!DateOnly.TryParseExact(d.DueDate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var due))
                Err("due_date", "The due date is not a valid date.");
            else if (issue != default && due < issue)
                Warn("due_date", "The due date is before the issue date.");
        }
        if (d.CurrencyCode is not { Length: 3 }) Err("currency", "The currency must be a 3-letter code.");
        else if (!d.CurrencyCode.Equals("AED", StringComparison.OrdinalIgnoreCase) && (d.AedRate is null || d.AedRate <= 0))
            Err("aed_rate", $"The invoice is in {d.CurrencyCode}. An exchange rate to AED is needed to state the VAT in dirhams, and none was found.");

        issues.AddRange(ValidateSupplier(d.Supplier));

        // Buyer
        if (string.IsNullOrWhiteSpace(d.Buyer.Name)) Err("buyer_name", "The customer has no name.");
        var buyerUae = string.IsNullOrWhiteSpace(d.Buyer.CountryCode) || d.Buyer.CountryCode.Equals("AE", StringComparison.OrdinalIgnoreCase);
        if (buyerUae)
        {
            if (string.IsNullOrWhiteSpace(d.Buyer.Trn)) Warn("buyer_trn", "The customer has no TRN. A VAT-registered customer must have one on a tax invoice; leave it blank only for a customer that is not registered.");
            else if (!IsValidTrn(d.Buyer.Trn)) Err("buyer_trn", "The customer's TRN must be 15 digits.");
            PartyAddress("The customer", d.Buyer, "buyer", Err);
        }
        else if (string.IsNullOrWhiteSpace(d.Buyer.Street) && string.IsNullOrWhiteSpace(d.Buyer.City))
            Err("buyer_address", "The customer's address is missing.");

        // Lines
        if (d.Lines.Count == 0) Err("lines", "The document has no lines.");
        for (var i = 0; i < d.Lines.Count; i++)
        {
            var l = d.Lines[i];
            var n = i + 1;
            if (string.IsNullOrWhiteSpace(l.Description)) Err("line_description", $"Line {n} has no description.");
            if (l.Quantity <= 0) Err("line_quantity", $"Line {n}: quantity must be more than zero. Corrections are made with a credit note, never a negative line.");
            if (l.UnitPrice < 0) Err("line_price", $"Line {n}: the price cannot be negative.");
            var cat = l.TaxCategory.ToUpperInvariant();
            if (cat is not ("S" or "Z" or "E" or "O")) Err("line_tax_category", $"Line {n}: tax category '{l.TaxCategory}' is not S, Z, E or O.");
            else if (cat == "S" && l.TaxRate <= 0) Err("line_tax_rate", $"Line {n} is standard-rated but the tax rate is zero.");
            else if (cat != "S" && string.IsNullOrWhiteSpace(l.ExemptionReason))
                Err("line_exemption_reason", $"Line {n} is {CategoryName(cat)}, so it needs a reason (for example the Cabinet Decision or article that applies).");
            if (string.IsNullOrWhiteSpace(l.UnitCode)) Warn("line_unit", $"Line {n} has no unit code; 'one' (C62) will be used.");
            else if (!PintAeCodes.CommonUnitCodes.Contains(l.UnitCode)) Warn("line_unit", $"Line {n}: unit code '{l.UnitCode}' is not one we recognise. Check it against UN/ECE Recommendation 20.");
        }

        // Credit notes
        if (d.IsCreditNote)
        {
            if (string.IsNullOrWhiteSpace(d.CreditReason)) Err("credit_reason", "A credit note must say why it is being issued.");
            if (string.IsNullOrWhiteSpace(d.OriginalInvoiceNumber)) Err("original_invoice", "A credit note must refer to the invoice it corrects.");
        }

        return issues;
    }

    /// <summary>Checks your own company's details, which are the same on every document.</summary>
    public static IReadOnlyList<EInvoiceIssue> ValidateSupplier(EInvoiceParty supplier)
    {
        var issues = new List<EInvoiceIssue>();
        void Err(string code, string msg) => issues.Add(new(EInvoiceIssue.Error, code, msg));
        if (string.IsNullOrWhiteSpace(supplier.Name)) Err("supplier_name", "Your company's legal name is missing. Set it in Settings, General.");
        if (!IsValidTrn(supplier.Trn)) Err("supplier_trn", "Your company's tax registration number (TRN) must be 15 digits. Set it in Finance, Tax, FTA Return, or Settings, General.");
        if (string.IsNullOrWhiteSpace(supplier.LegalId) || string.IsNullOrWhiteSpace(supplier.LegalIdScheme))
            Err("supplier_legal_id", "Your company's trade licence (or other legal registration) number is missing. Add it in E-Invoicing settings.");
        else if (!PintAeCodes.LegalIdSchemes.Contains(supplier.LegalIdScheme.ToUpperInvariant()))
            Err("supplier_legal_id", $"'{supplier.LegalIdScheme}' is not a legal registration type. Use AE:TL, AE:EID, AE:PAS or AE:CD.");
        else if (supplier.LegalIdScheme.Equals("AE:TL", StringComparison.OrdinalIgnoreCase) && string.IsNullOrWhiteSpace(supplier.RegistrationAuthority))
            Err("supplier_authority", "A trade licence needs the issuing authority (for example DED Dubai). Add it in E-Invoicing settings.");
        PartyAddress("Your company", supplier, "supplier", Err);
        return issues;
    }

    private static void PartyAddress(string who, EInvoiceParty p, string key, Action<string, string> err)
    {
        if (string.IsNullOrWhiteSpace(p.Street)) err($"{key}_street", $"{who} has no street address.");
        if (string.IsNullOrWhiteSpace(p.City)) err($"{key}_city", $"{who} has no city.");
        if (string.IsNullOrWhiteSpace(p.Emirate)) err($"{key}_emirate", $"{who} has no emirate.");
        else if (!PintAeCodes.Emirates.Contains(p.Emirate.ToUpperInvariant())) err($"{key}_emirate", $"{who}: '{p.Emirate}' is not an emirate code (AUH, DXB, SHJ, AJM, UAQ, RAK, FUJ).");
    }

    private static string CategoryName(string c) => c switch { "Z" => "zero-rated", "E" => "exempt", _ => "out of scope" };
}

/// <summary>
/// Builds a PINT AE (UBL 2.1) document from an <see cref="EInvoiceDocument"/>. Pure and deterministic.
///
/// <para><b>Not certified.</b> This follows the published PINT AE structure but has not been run through
/// the official Schematron rules or accepted by an Accredited Service Provider. Providers such as Storecove
/// build the legal document themselves from our data; this file is for download, for providers that accept
/// UBL, and for checking that our data is complete before anything is sent. It says so inside the XML.</para>
/// </summary>
public static class PintAeBuilder
{
    private const string NsInvoice = "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2";
    private const string NsCredit  = "urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2";
    private const string Cac = "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2";
    private const string Cbc = "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2";

    public static string Build(EInvoiceDocument d)
    {
        var totals = PintAeValidator.Totals(d);
        var ci = CultureInfo.InvariantCulture;
        string M(decimal v) => v.ToString("0.00", ci);
        string Q(decimal v) => v.ToString("0.####", ci);

        var sb = new StringBuilder();
        var settings = new XmlWriterSettings { Indent = true, Encoding = new UTF8Encoding(false), OmitXmlDeclaration = false };
        using (var w = XmlWriter.Create(new Utf8StringWriter(sb), settings))
        {
            var root = d.IsCreditNote ? "CreditNote" : "Invoice";
            var cur = d.CurrencyCode.ToUpperInvariant();
            w.WriteStartDocument();
            w.WriteComment(" Prepared by Vrodux ERP in the PINT AE structure. Not certified: it has not been accepted by an Accredited Service Provider or validated against the official Schematron rules. ");
            w.WriteStartElement(root, d.IsCreditNote ? NsCredit : NsInvoice);
            w.WriteAttributeString("xmlns", "cac", null, Cac);
            w.WriteAttributeString("xmlns", "cbc", null, Cbc);

            Text(w, "CustomizationID", PintAeCodes.CustomizationId);
            Text(w, "ProfileID", PintAeCodes.ProfileId);
            Text(w, "ID", d.Number);
            Text(w, "IssueDate", d.IssueDate);
            if (!d.IsCreditNote && !string.IsNullOrWhiteSpace(d.DueDate)) Text(w, "DueDate", d.DueDate!);
            w.WriteStartElement("cbc", d.IsCreditNote ? "CreditNoteTypeCode" : "InvoiceTypeCode", Cbc);
            w.WriteAttributeString("name", "00000000");
            w.WriteString(d.IsCreditNote ? "381" : "380");
            w.WriteEndElement();
            var note = d.IsCreditNote ? JoinNote(d.CreditReason, d.Note) : d.Note;
            if (!string.IsNullOrWhiteSpace(note)) Text(w, "Note", note!);
            Text(w, "DocumentCurrencyCode", cur);
            var inAed = cur == "AED";
            if (!inAed) Text(w, "TaxCurrencyCode", "AED");

            if (d.IsCreditNote && !string.IsNullOrWhiteSpace(d.OriginalInvoiceNumber))
            {
                w.WriteStartElement("cac", "BillingReference", Cac);
                w.WriteStartElement("cac", "InvoiceDocumentReference", Cac);
                Text(w, "ID", d.OriginalInvoiceNumber!);
                if (!string.IsNullOrWhiteSpace(d.OriginalInvoiceDate)) Text(w, "IssueDate", d.OriginalInvoiceDate!);
                w.WriteEndElement(); w.WriteEndElement();
            }

            Party(w, "AccountingSupplierParty", d.Supplier, supplier: true);
            Party(w, "AccountingCustomerParty", d.Buyer, supplier: false);

            // In a foreign currency the VAT is stated twice: in the document currency and in dirhams.
            WriteTaxTotal(w, totals, cur, M);
            if (!inAed && totals.TaxTotalAed is { } aed)
            {
                w.WriteStartElement("cac", "TaxTotal", Cac);
                Amount(w, "TaxAmount", "AED", M(aed));
                w.WriteEndElement();
            }

            w.WriteStartElement("cac", "LegalMonetaryTotal", Cac);
            Amount(w, "LineExtensionAmount", cur, M(totals.LineExtension));
            Amount(w, "TaxExclusiveAmount", cur, M(totals.TaxExclusive));
            Amount(w, "TaxInclusiveAmount", cur, M(totals.TaxInclusive));
            Amount(w, "PayableAmount", cur, M(totals.TaxInclusive));
            w.WriteEndElement();

            var id = 0;
            foreach (var l in d.Lines)
            {
                id++;
                var net = Math.Round(l.Quantity * l.UnitPrice, 2, MidpointRounding.AwayFromZero);
                w.WriteStartElement("cac", d.IsCreditNote ? "CreditNoteLine" : "InvoiceLine", Cac);
                Text(w, "ID", id.ToString(ci));
                w.WriteStartElement("cbc", d.IsCreditNote ? "CreditedQuantity" : "InvoicedQuantity", Cbc);
                w.WriteAttributeString("unitCode", string.IsNullOrWhiteSpace(l.UnitCode) ? "C62" : l.UnitCode!.ToUpperInvariant());
                w.WriteString(Q(l.Quantity));
                w.WriteEndElement();
                Amount(w, "LineExtensionAmount", cur, M(net));
                w.WriteStartElement("cac", "Item", Cac);
                Text(w, "Name", Trunc(l.Description, 200));
                w.WriteStartElement("cac", "ClassifiedTaxCategory", Cac);
                var cat = l.TaxCategory.ToUpperInvariant();
                Text(w, "ID", cat);
                Text(w, "Percent", M(cat == "S" ? l.TaxRate : 0m));
                if (cat != "S" && !string.IsNullOrWhiteSpace(l.ExemptionReason)) Text(w, "TaxExemptionReason", l.ExemptionReason!);
                w.WriteStartElement("cac", "TaxScheme", Cac); Text(w, "ID", "VAT"); w.WriteEndElement();
                w.WriteEndElement(); w.WriteEndElement();
                w.WriteStartElement("cac", "Price", Cac);
                Amount(w, "PriceAmount", cur, l.UnitPrice.ToString("0.00##", ci));
                w.WriteEndElement();
                w.WriteEndElement();
            }

            w.WriteEndElement();
            w.WriteEndDocument();
        }
        return sb.ToString();
    }

    public static string Hash(string xml) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(xml))).ToLowerInvariant();

    private static void WriteTaxTotal(XmlWriter w, EInvoiceTotals t, string cur, Func<decimal, string> M)
    {
        w.WriteStartElement("cac", "TaxTotal", Cac);
        Amount(w, "TaxAmount", cur, M(t.TaxTotal));
        foreach (var b in t.Breakdown)
        {
            w.WriteStartElement("cac", "TaxSubtotal", Cac);
            Amount(w, "TaxableAmount", cur, M(b.Taxable));
            Amount(w, "TaxAmount", cur, M(b.Tax));
            w.WriteStartElement("cac", "TaxCategory", Cac);
            Text(w, "ID", b.Category);
            Text(w, "Percent", M(b.Rate));
            if (b.Category != "S" && !string.IsNullOrWhiteSpace(b.Reason)) Text(w, "TaxExemptionReason", b.Reason!);
            w.WriteStartElement("cac", "TaxScheme", Cac); Text(w, "ID", "VAT"); w.WriteEndElement();
            w.WriteEndElement(); w.WriteEndElement();
        }
        w.WriteEndElement();
    }

    private static void Party(XmlWriter w, string wrapper, EInvoiceParty p, bool supplier)
    {
        w.WriteStartElement("cac", wrapper, Cac);
        w.WriteStartElement("cac", "Party", Cac);

        w.WriteStartElement("cbc", "EndpointID", Cbc);
        w.WriteAttributeString("schemeID", PintAeCodes.EndpointScheme);
        w.WriteString(EndpointFor(p, supplier));
        w.WriteEndElement();

        w.WriteStartElement("cac", "PartyName", Cac); Text(w, "Name", p.Name); w.WriteEndElement();

        w.WriteStartElement("cac", "PostalAddress", Cac);
        if (!string.IsNullOrWhiteSpace(p.Street)) Text(w, "StreetName", Trunc(p.Street!.Replace('\n', ' ').Replace('\r', ' '), 150));
        if (!string.IsNullOrWhiteSpace(p.City)) Text(w, "CityName", p.City!);
        if (!string.IsNullOrWhiteSpace(p.Emirate)) Text(w, "CountrySubentity", p.Emirate!.ToUpperInvariant());
        w.WriteStartElement("cac", "Country", Cac); Text(w, "IdentificationCode", string.IsNullOrWhiteSpace(p.CountryCode) ? "AE" : p.CountryCode!.ToUpperInvariant()); w.WriteEndElement();
        w.WriteEndElement();

        if (!string.IsNullOrWhiteSpace(p.Trn))
        {
            w.WriteStartElement("cac", "PartyTaxScheme", Cac);
            Text(w, "CompanyID", p.Trn!);
            w.WriteStartElement("cac", "TaxScheme", Cac); Text(w, "ID", "VAT"); w.WriteEndElement();
            w.WriteEndElement();
        }

        w.WriteStartElement("cac", "PartyLegalEntity", Cac);
        Text(w, "RegistrationName", p.Name);
        if (!string.IsNullOrWhiteSpace(p.LegalId))
        {
            w.WriteStartElement("cbc", "CompanyID", Cbc);
            if (!string.IsNullOrWhiteSpace(p.LegalIdScheme)) w.WriteAttributeString("schemeID", p.LegalIdScheme!.ToUpperInvariant());
            w.WriteString(p.LegalId);
            w.WriteEndElement();
        }
        if (supplier && !string.IsNullOrWhiteSpace(p.RegistrationAuthority))
        {
            w.WriteStartElement("cac", "RegistrationAddress", Cac);
            Text(w, "CityName", p.RegistrationAuthority!);
            w.WriteStartElement("cac", "Country", Cac); Text(w, "IdentificationCode", "AE"); w.WriteEndElement();
            w.WriteEndElement();
        }
        w.WriteEndElement();

        w.WriteEndElement(); w.WriteEndElement();
    }

    /// <summary>The network address: the first ten digits of the TRN, or the reserved placeholder for a buyer that is not on the network.</summary>
    private static string EndpointFor(EInvoiceParty p, bool supplier)
    {
        if (!string.IsNullOrWhiteSpace(p.PeppolId))
        {
            var id = p.PeppolId!.Trim();
            var i = id.IndexOf(':');
            return i >= 0 ? id[(i + 1)..] : id;
        }
        return PintAeValidator.TinFromTrn(p.Trn) ?? (supplier ? "" : PintAeCodes.BuyerNotOnPeppol);
    }

    private static string? JoinNote(string? a, string? b)
    {
        var s = string.Join(" | ", new[] { a, b }.Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x!.Trim()));
        return s.Length > 0 ? s : null;
    }

    private static string Trunc(string v, int max) => v.Length <= max ? v : v[..max];
    private static void Text(XmlWriter w, string name, string value) { w.WriteStartElement("cbc", name, Cbc); w.WriteString(value); w.WriteEndElement(); }
    private static void Amount(XmlWriter w, string name, string cur, string value)
    {
        w.WriteStartElement("cbc", name, Cbc);
        w.WriteAttributeString("currencyID", cur);
        w.WriteString(value);
        w.WriteEndElement();
    }

    private sealed class Utf8StringWriter(StringBuilder sb) : StringWriter(sb, CultureInfo.InvariantCulture)
    {
        public override Encoding Encoding => new UTF8Encoding(false);
    }
}
