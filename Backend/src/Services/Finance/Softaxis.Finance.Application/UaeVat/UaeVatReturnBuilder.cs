using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Xml.Linq;

namespace Softaxis.Finance.Application.UaeVat;

/// <summary>
/// One VAT-bearing document, already converted to AED, as produced by the existing VAT ledger
/// (sales invoices → output, approved purchase bills → input). This builder never recomputes VAT;
/// <see cref="VatAed"/> is the ledger's figure × the GL's own exchange rate.
/// </summary>
public sealed record VatSourceLine(
    string  Type,            // "sale" | "purchase"
    string  Date,            // yyyy-MM-dd
    string  DocumentNumber,
    string  PartyName,
    string? PartyTrn,
    decimal Rate,            // percent
    string  Currency,
    decimal NetFcy,
    decimal VatFcy,
    decimal NetAed,
    decimal VatAed,
    bool    MissingFxRate);

public sealed record VatTaxpayer(
    string Trn, string NameEn, string? NameAr, string? Address, string DefaultEmirate,
    string? TaxAgencyName, string? Tan, string? TaxAgentName, string? Taan);

public sealed record VatReturnIssue(string Severity, string Code, string Message, string? Reference = null);

/// <summary>A VAT 201 box. Amount = net value; Vat = VAT (box 1–2, 9) or recoverable VAT.</summary>
public sealed record VatBox(string Box, string Label, decimal Amount, decimal Vat, decimal Adjustment = 0m);

public sealed record VatReconciliation(
    decimal ReturnNetVat, decimal LedgerNetVat, decimal? GlNetVat, decimal Difference,
    bool Reconciled, string Basis);

public sealed record VatReturnComputation(
    IReadOnlyList<VatBox> Boxes,
    decimal TotalOutputVat,
    decimal TotalInputVat,
    decimal NetVat,
    IReadOnlyList<VatReturnIssue> Issues,
    VatReconciliation Reconciliation)
{
    public bool HasErrors => Issues.Any(i => i.Severity == "error");
}

/// <summary>
/// Maps the existing VAT ledger onto the FTA VAT 201 return (Appendix 8 of the FTA "Tax Accounting
/// Software" requirements) and the FTA VAT Audit File (Appendix 5), and validates both.
/// Pure — no database, no clock dependencies beyond the supplied <c>today</c>.
/// </summary>
public static class UaeVatReturnBuilder
{
    public const decimal StandardRate = 5m;
    public const decimal ReconciliationTolerance = 1.00m;   // AED; absorbs per-document rounding

    public static readonly IReadOnlyDictionary<string, (string Box, string Name)> Emirates =
        new Dictionary<string, (string, string)>
        {
            ["AUH"] = ("1a", "Abu Dhabi"),  ["DXB"] = ("1b", "Dubai"),   ["SHJ"] = ("1c", "Sharjah"),
            ["AJM"] = ("1d", "Ajman"),      ["UAQ"] = ("1e", "Umm Al Quwain"),
            ["RAK"] = ("1f", "Ras Al Khaimah"), ["FUJ"] = ("1g", "Fujairah"),
        };

    /// <summary>UAE TRNs are 15 digits and, as issued by FTA, begin with "100".</summary>
    public static bool IsValidTrn(string? trn) =>
        trn is { Length: 15 } && trn.All(char.IsDigit) && trn.StartsWith("100", StringComparison.Ordinal);

    public static VatReturnComputation Compute(
        VatTaxpayer taxpayer, string fromDate, string toDate, IReadOnlyList<VatSourceLine> lines,
        decimal? glNetVat, DateOnly today)
    {
        var issues = new List<VatReturnIssue>();

        // ── Taxpayer + period ────────────────────────────────────────────────────────
        if (!IsValidTrn(taxpayer.Trn))
            issues.Add(new("error", "Trn.Invalid", "The workspace TRN must be 15 digits starting with 100. Set it in the VAT registration settings."));
        if (string.IsNullOrWhiteSpace(taxpayer.NameEn))
            issues.Add(new("error", "Taxpayer.NameMissing", "The taxable person's English name is required."));
        if (!Emirates.ContainsKey(taxpayer.DefaultEmirate))
            issues.Add(new("error", "Emirate.Invalid", "Choose the emirate where your supplies take place."));

        var okFrom = DateOnly.TryParseExact(fromDate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var from);
        var okTo   = DateOnly.TryParseExact(toDate,   "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var to);
        if (!okFrom || !okTo)
            issues.Add(new("error", "Period.InvalidDates", "The tax period dates must be valid yyyy-MM-dd dates."));
        else
        {
            if (to < from)
                issues.Add(new("error", "Period.Reversed", "The tax period ends before it starts."));
            else if (to.DayNumber - from.DayNumber > 366)
                issues.Add(new("error", "Period.TooLong", "A UAE VAT period is monthly or quarterly; this one spans more than a year."));
            if (to >= today)
                issues.Add(new("warning", "Period.NotEnded", "The tax period has not ended yet — later documents dated inside it would change the figures."));
        }

        // ── Lines ────────────────────────────────────────────────────────────────────
        foreach (var l in lines)
        {
            if (l.Rate != StandardRate && l.Rate != 0m)
                issues.Add(new("error", "Rate.Unsupported",
                    $"{l.DocumentNumber} uses a {l.Rate:0.##}% rate. UAE VAT only supports 5% or 0%.", l.DocumentNumber));
            if (l.MissingFxRate)
                issues.Add(new("error", "Fx.Missing",
                    $"{l.DocumentNumber} is in {l.Currency} and no exchange rate to AED exists. Add one under Currency & Rates.", l.DocumentNumber));
            if (l.Type == "purchase" && l.Rate == StandardRate && string.IsNullOrWhiteSpace(l.PartyTrn))
                issues.Add(new("warning", "Supplier.TrnMissing",
                    $"Input VAT on {l.DocumentNumber} is claimed but the supplier has no TRN — FTA may disallow recovery.", l.DocumentNumber));
            if (!string.IsNullOrWhiteSpace(l.PartyTrn) && !IsValidTrn(l.PartyTrn))
                issues.Add(new("warning", "Party.TrnInvalid",
                    $"{l.PartyName} on {l.DocumentNumber} has a TRN that is not 15 digits starting with 100.", l.DocumentNumber));
        }

        var sales     = lines.Where(l => l.Type == "sale").ToList();
        var purchases = lines.Where(l => l.Type == "purchase").ToList();

        if (sales.Any(l => l.Rate == 0m))
            issues.Add(new("warning", "ZeroRate.Unclassified",
                "0% sales are reported as zero-rated (box 3). Vrodux does not yet distinguish exempt, GCC or out-of-scope supplies — review before filing."));
        if (sales.Any(l => l.Rate == StandardRate))
            issues.Add(new("info", "Emirate.Default",
                $"All standard-rated sales are reported in {Emirates.GetValueOrDefault(taxpayer.DefaultEmirate).Name ?? taxpayer.DefaultEmirate} — invoices carry no place of supply yet."));
        issues.Add(new("info", "Boxes.NotDerived",
            "Boxes 2 and 10 (reverse charge), 4 (GCC), 5 (exempt), 6 (import VAT) and 7/11 (corrections) have no source data in Vrodux and are reported as 0."));

        // ── Boxes ────────────────────────────────────────────────────────────────────
        var std   = sales.Where(l => l.Rate == StandardRate).ToList();
        var zero  = sales.Where(l => l.Rate == 0m).ToList();
        var stdIn = purchases.Where(l => l.Rate == StandardRate).ToList();

        var boxes = new List<VatBox>();
        foreach (var (code, (box, name)) in Emirates)
        {
            var inEmirate = code == taxpayer.DefaultEmirate ? std : [];
            boxes.Add(new(box, $"Standard rated supplies in {name}", R(inEmirate.Sum(l => l.NetAed)), R(inEmirate.Sum(l => l.VatAed))));
        }
        boxes.Add(new("2", "Supplies subject to the reverse charge provisions", 0m, 0m));
        boxes.Add(new("3", "Zero rated supplies", R(zero.Sum(l => l.NetAed)), 0m));
        boxes.Add(new("4", "Supplies of goods and services to registered customers in other GCC implementing states", 0m, 0m));
        boxes.Add(new("5", "Exempt supplies", 0m, 0m));
        boxes.Add(new("6", "Import VAT accounted through UAE customs", 0m, 0m));
        boxes.Add(new("7", "Amendments or corrections to Output figures", 0m, 0m));
        var outAmount = boxes.Sum(b => b.Amount);
        var outVat    = boxes.Sum(b => b.Vat);
        boxes.Add(new("8", "Totals (outputs)", R(outAmount), R(outVat)));
        boxes.Add(new("9", "Standard rated expenses", R(stdIn.Sum(l => l.NetAed)), R(stdIn.Sum(l => l.VatAed))));
        boxes.Add(new("10", "Supplies subject to the reverse charge provisions (inputs)", 0m, 0m));
        boxes.Add(new("11", "Amendments or corrections to Input figures", 0m, 0m));
        var inVat = R(stdIn.Sum(l => l.VatAed));
        boxes.Add(new("12", "Totals (inputs)", R(stdIn.Sum(l => l.NetAed)), inVat));
        var net = R(outVat - inVat);
        // Appendix 8 reuses "12" for the net-due section; suffixed here so ids stay unique.
        boxes.Add(new("12-due", "Total value of due tax for the period", 0m, R(outVat)));
        boxes.Add(new("13", "Total value of recoverable tax for the period", 0m, inVat));
        boxes.Add(new("14", "Net VAT due (or reclaimed) for the period", 0m, net));

        // ── Reconciliation ───────────────────────────────────────────────────────────
        var ledgerNet = R(lines.Where(l => l.Type == "sale").Sum(l => l.VatAed) - lines.Where(l => l.Type == "purchase").Sum(l => l.VatAed));
        decimal diff; string basis; bool reconciled;
        if (glNetVat is null)
        {
            diff = net - ledgerNet; reconciled = false;
            basis = "No VAT control account (2200) postings were found for the period, so the return could not be agreed to the general ledger.";
            issues.Add(new("warning", "Recon.NoGl", basis));
        }
        else
        {
            diff = R(net - glNetVat.Value);
            reconciled = Math.Abs(diff) <= ReconciliationTolerance && Math.Abs(net - ledgerNet) <= ReconciliationTolerance;
            basis = "Net VAT on the return compared with the period movement on the VAT control account (2200).";
            if (!reconciled)
                issues.Add(new("warning", "Recon.Difference",
                    $"Return net VAT {net:N2} differs from the VAT control account by {diff:N2} AED. Look for manual journals to 2200 or documents posted without VAT."));
        }

        return new VatReturnComputation(boxes, R(outVat), inVat, net, issues,
            new VatReconciliation(net, ledgerNet, glNetVat, diff, reconciled, basis));
    }

    private static decimal R(decimal v) => Math.Round(v, 2, MidpointRounding.AwayFromZero);

    // ── FTA VAT Audit File (Appendix 5) ─────────────────────────────────────────────
    /// <summary>
    /// Produces the FAF CSV. One line per document (LineNo 1): VAT is taken at document level so
    /// the file's totals equal the return's — line-level rounding would make them disagree.
    /// Commas are stripped from text fields, as the spec requires.
    /// </summary>
    public static string BuildAuditFile(VatTaxpayer t, string fromDate, string toDate,
        IReadOnlyList<VatSourceLine> lines, string productVersion, DateOnly today)
    {
        var sb = new StringBuilder();
        void Row(params object?[] cells) => sb.Append(string.Join(",", cells.Select(Cell))).Append("\r\n");

        Row("CompInfoStart");
        Row("TaxablePersonNameEn", "TaxablePersonNameAr", "TRN", "TaxAgencyName", "TAN", "TaxAgentName", "TAAN",
            "PeriodStart", "PeriodEnd", "FAFCreationDate", "ProductVersion", "FAFVersion");
        Row(t.NameEn, t.NameAr, t.Trn, t.TaxAgencyName, t.Tan, t.TaxAgentName, t.Taan,
            FafDate(fromDate), FafDate(toDate), today.ToString("dd-MM-yyyy", CultureInfo.InvariantCulture),
            productVersion, "FAFv1.0.0");
        Row("CompInfoEnd");

        var purchases = lines.Where(l => l.Type == "purchase").OrderBy(l => l.Date, StringComparer.Ordinal).ToList();
        Row("PurcDataStart");
        Row("SupplierName", "SupplierTRN", "InvoiceDate", "InvoiceNo", "PermitNo", "LineNo", "ProductDescription",
            "PurchaseValueAED", "VATValueAED", "TaxCode", "FCYCode", "PurchaseFCY", "VATFCY");
        foreach (var l in purchases)
            Row(l.PartyName, l.PartyTrn, FafDate(l.Date), l.DocumentNumber, "", 1, $"Purchase bill {l.DocumentNumber}",
                M(l.NetAed), M(l.VatAed), TaxCode(l), Fcy(l), FcyAmt(l, l.NetFcy), FcyAmt(l, l.VatFcy));
        Row("PurcDataEnd", M(purchases.Sum(l => l.NetAed)), M(purchases.Sum(l => l.VatAed)), purchases.Count);

        var sales = lines.Where(l => l.Type == "sale").OrderBy(l => l.Date, StringComparer.Ordinal).ToList();
        Row("SuppDataStart");
        Row("CustomerName", "CustomerTRN", "InvoiceDate", "InvoiceNo", "LineNo", "ProductDescription",
            "SupplyValueAED", "VATValueAED", "TaxCode", "Country", "FCYCode", "SupplyFCY", "VATFCY");
        foreach (var l in sales)
            Row(l.PartyName, l.PartyTrn, FafDate(l.Date), l.DocumentNumber, 1, $"Sales invoice {l.DocumentNumber}",
                M(l.NetAed), M(l.VatAed), TaxCode(l), "", Fcy(l), FcyAmt(l, l.NetFcy), FcyAmt(l, l.VatFcy));
        Row("SuppDataEnd", M(sales.Sum(l => l.NetAed)), M(sales.Sum(l => l.VatAed)), sales.Count);

        return sb.ToString();
    }

    private static string TaxCode(VatSourceLine l) => l.Rate == StandardRate ? "SR" : "ZR";
    private static string Fcy(VatSourceLine l) => l.Currency == "AED" ? "XXX" : l.Currency;
    private static string FcyAmt(VatSourceLine l, decimal v) => l.Currency == "AED" ? "0.00" : M(v);
    private static string M(decimal v) => R(v).ToString("0.00", CultureInfo.InvariantCulture);

    private static string FafDate(string isoDate) =>
        DateOnly.TryParseExact(isoDate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d)
            ? d.ToString("dd-MM-yyyy", CultureInfo.InvariantCulture) : "31-12-9999";

    private static string Cell(object? v) => v switch
    {
        null => "",
        string s => s.Replace(",", " ").Replace("\r", " ").Replace("\n", " ").Trim(),
        IFormattable f => f.ToString(null, CultureInfo.InvariantCulture),
        _ => v.ToString() ?? "",
    };

    // ── VAT 201 return file ──────────────────────────────────────────────────────────
    /// <summary>
    /// An XML rendering of the VAT 201 field set (Appendix 8). <b>FTA has not published an XML
    /// schema</b> for this file, and the spec requires the uploadable file to be encrypted with
    /// credentials FTA issues at vendor certification — so this is a faithful machine-readable
    /// worksheet, not a file EmaraTax will accept as "Auto Fill" input. The root carries
    /// <c>certified="false"</c> so nobody mistakes it for one.
    /// </summary>
    public static string BuildReturnXml(VatTaxpayer t, string periodLabel, string fromDate, string toDate,
        VatReturnComputation c, string softwareName, string softwareVersion, string? vendorTrn)
    {
        var doc = new XDocument(new XDeclaration("1.0", "utf-8", null),
            new XElement("VATReturn",
                new XAttribute("form", "VAT201"), new XAttribute("certified", "false"),
                new XElement("Software",
                    new XElement("VendorTRN", vendorTrn ?? ""), new XElement("Name", softwareName),
                    new XElement("Version", softwareVersion)),
                new XElement("TaxablePerson",
                    new XElement("TRN", t.Trn), new XElement("NameEn", t.NameEn), new XElement("NameAr", t.NameAr ?? ""),
                    new XElement("Address", t.Address ?? ""), new XElement("TaxAgencyName", t.TaxAgencyName ?? ""),
                    new XElement("TAN", t.Tan ?? ""), new XElement("TaxAgentName", t.TaxAgentName ?? ""),
                    new XElement("TAAN", t.Taan ?? "")),
                new XElement("Period", new XAttribute("reference", periodLabel),
                    new XElement("From", fromDate), new XElement("To", toDate)),
                new XElement("Boxes", c.Boxes.Select(b => new XElement("Box",
                    new XAttribute("id", b.Box),
                    new XElement("Label", b.Label),
                    new XElement("AmountAED", M(b.Amount)),
                    new XElement("VatAED", M(b.Vat)),
                    new XElement("AdjustmentAED", M(b.Adjustment))))),
                new XElement("NetVatPayableAED", M(c.NetVat))));
        return doc.Declaration + "\n" + doc.Root;
    }

    public static string Hash(string faf, string xml) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(faf + "\n--\n" + xml))).ToLowerInvariant();
}
