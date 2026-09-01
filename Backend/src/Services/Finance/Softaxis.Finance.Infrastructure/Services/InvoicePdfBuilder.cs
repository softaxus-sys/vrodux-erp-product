using System.Globalization;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using Softaxis.Finance.Application.Abstractions;
using Softaxis.Finance.Domain.Entities;

namespace Softaxis.Finance.Infrastructure.Services;

/// <summary>
/// Renders an invoice to a PDF, for attaching to the customer's email.
///
/// <para>QuestPDF, under its Community licence — free while company revenue is below the threshold
/// its licence states. The licence type is set explicitly in <see cref="Configure"/> rather than
/// left to a static initialiser somewhere, so the obligation is visible in the code that relies
/// on it.</para>
///
/// <para>Chosen over rendering the existing HTML with a headless browser because this is pure .NET:
/// it needs no Chromium on the on-prem Windows Service or in the container, which is the part most
/// likely to break a deploy. The trade is that the layout is authored here rather than shared with
/// the email template, so the two are kept deliberately close in content — same letterhead, same
/// figures, same bank block — even though they are separate code.</para>
/// </summary>
internal static class InvoicePdfBuilder
{
    /// <summary>
    /// Called once at startup. QuestPDF refuses to render until a licence is declared, and it must
    /// be declared by us rather than assumed.
    /// </summary>
    public static void Configure() => QuestPDF.Settings.License = LicenseType.Community;

    private static string Money(decimal amount, string currency) =>
        $"{currency} {amount.ToString("N2", CultureInfo.InvariantCulture)}";

    /// <summary>The filename a mail client will show. Kept to the invoice number so a customer
    /// filing several of them does not end up with six files called "invoice.pdf".</summary>
    public static string FileName(Invoice invoice) =>
        $"Invoice-{Sanitise(invoice.InvoiceNumber)}.pdf";

    /// <summary>Strips anything a filename cannot carry, so an odd invoice number cannot produce
    /// an unopenable attachment.</summary>
    private static string Sanitise(string s)
    {
        var invalid = Path.GetInvalidFileNameChars();
        var cleaned = new string(s.Select(c => invalid.Contains(c) ? '-' : c).ToArray()).Trim();
        return string.IsNullOrWhiteSpace(cleaned) ? "invoice" : cleaned;
    }

    /// <summary>
    /// The invoice as a mail attachment, or null if it could not be rendered.
    ///
    /// <para>Best-effort on purpose: a failure here must never stop the email. A customer who
    /// receives the invoice in the body but without the PDF is inconvenienced; a customer who
    /// receives nothing because the renderer threw has not been invoiced at all.</para>
    /// </summary>
    public static IReadOnlyList<EmailAttachment>? TryBuildAttachment(Invoice invoice, InvoiceBranding brand)
    {
        try
        {
            return [new EmailAttachment(FileName(invoice), Build(invoice, brand), "application/pdf")];
        }
        catch
        {
            return null;
        }
    }

    public static byte[] Build(Invoice invoice, InvoiceBranding brand)
        => CreateDocument(invoice, brand).GeneratePdf();

    /// <summary>
    /// The composed document, separate from rendering it. Splitting these lets the layout be
    /// rendered to an image for visual checking without going through a PDF reader.
    /// </summary>
    public static IDocument CreateDocument(Invoice invoice, InvoiceBranding brand)
    {
        var currency = invoice.CurrencyCode;
        var items    = invoice.Items.ToList();
        var logo     = DecodeImage(brand.LogoUrl);
        var sign     = DecodeImage(brand.SignatureUrl);
        var stamp    = DecodeImage(brand.StampUrl);

        return Document.Create(doc =>
        {
            doc.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(36);
                page.DefaultTextStyle(t => t.FontSize(9).FontColor("#1f2937"));

                page.Header().Element(h => Header(h, invoice, brand, logo));
                page.Content().Element(c => Content(c, invoice, brand, items, currency, sign, stamp));
                page.Footer().AlignCenter().Text(t =>
                {
                    t.DefaultTextStyle(s => s.FontSize(8).FontColor("#9ca3af"));
                    t.Span("Page ");
                    t.CurrentPageNumber();
                    t.Span(" of ");
                    t.TotalPages();
                });
            });
        });
    }

    private static void Header(IContainer c, Invoice invoice, InvoiceBranding brand, byte[]? logo) =>
        c.PaddingBottom(14).Row(row =>
        {
            row.RelativeItem().Column(col =>
            {
                if (logo is not null) col.Item().Height(42).AlignLeft().Image(logo).FitHeight();
                else col.Item().Text(brand.Name).FontSize(15).Bold();

                col.Item().PaddingTop(6).Text(brand.Name).FontSize(10).SemiBold();
                foreach (var line in new[] { brand.Address, brand.Phone, brand.Email, brand.Website })
                    if (!string.IsNullOrWhiteSpace(line))
                        col.Item().Text(line!).FontSize(8).FontColor("#6b7280");

                if (!string.IsNullOrWhiteSpace(brand.TaxNumber))
                    col.Item().Text($"TRN: {brand.TaxNumber}").FontSize(8).FontColor("#6b7280");
            });

            row.ConstantItem(190).Column(col =>
            {
                col.Item().AlignRight().Text("INVOICE").FontSize(20).Bold().FontColor("#111827");
                col.Item().AlignRight().PaddingTop(2).Text(invoice.InvoiceNumber).FontSize(10).SemiBold();
                col.Item().AlignRight().PaddingTop(6).Text($"Issued  {invoice.InvoiceDate}").FontSize(8);
                col.Item().AlignRight().Text($"Due     {invoice.DueDate}").FontSize(8);

                // Paid invoices say so on the document, so a customer filing a receipt can see at a
                // glance that nothing is outstanding.
                if (invoice.Status == "paid")
                    col.Item().AlignRight().PaddingTop(6)
                       .Background("#dcfce7").Padding(4)
                       .Text("PAID").FontSize(9).Bold().FontColor("#166534");
            });
        });

    private static void Content(
        IContainer c, Invoice invoice, InvoiceBranding brand, List<InvoiceItem> items,
        string currency, byte[]? sign, byte[]? stamp) =>
        c.Column(col =>
        {
            col.Item().PaddingBottom(10).Column(bill =>
            {
                bill.Item().Text("BILL TO").FontSize(7).Bold().FontColor("#9ca3af").LetterSpacing(0.1f);
                bill.Item().PaddingTop(2).Text(invoice.CustomerName).FontSize(10).SemiBold();
                if (!string.IsNullOrWhiteSpace(invoice.CustomerEmail))
                    bill.Item().Text(invoice.CustomerEmail!).FontSize(8).FontColor("#6b7280");
            });

            col.Item().Table(table =>
            {
                table.ColumnsDefinition(d =>
                {
                    d.RelativeColumn(5);
                    d.RelativeColumn(1.2f);
                    d.RelativeColumn(2);
                    d.RelativeColumn(2);
                });

                table.Header(h =>
                {
                    static IContainer Th(IContainer x) =>
                        x.Background("#f3f4f6").PaddingVertical(5).PaddingHorizontal(6);
                    h.Cell().Element(Th).Text("Description").FontSize(8).Bold();
                    h.Cell().Element(Th).AlignRight().Text("Qty").FontSize(8).Bold();
                    h.Cell().Element(Th).AlignRight().Text("Unit Price").FontSize(8).Bold();
                    h.Cell().Element(Th).AlignRight().Text("Amount").FontSize(8).Bold();
                });

                foreach (var i in items)
                {
                    static IContainer Td(IContainer x) =>
                        x.BorderBottom(1).BorderColor("#e5e7eb").PaddingVertical(5).PaddingHorizontal(6);
                    table.Cell().Element(Td).Text(i.Description);
                    table.Cell().Element(Td).AlignRight().Text(i.Quantity.ToString("0.##", CultureInfo.InvariantCulture));
                    table.Cell().Element(Td).AlignRight().Text(Money(i.UnitPrice, currency));
                    table.Cell().Element(Td).AlignRight().Text(Money(i.LineTotal, currency));
                }
            });

            col.Item().PaddingTop(10).AlignRight().Width(230).Column(tot =>
            {
                void Line(string label, string value, bool bold = false)
                    => tot.Item().PaddingVertical(2).Row(r =>
                    {
                        var lbl = r.RelativeItem().Text(label).FontSize(bold ? 10 : 9);
                        var amt = r.ConstantItem(110).AlignRight().Text(value).FontSize(bold ? 10 : 9);
                        if (bold) { lbl.Bold(); amt.Bold(); }
                    });

                Line("Subtotal", Money(invoice.SubTotal, currency));
                // A zero-rated invoice says 0% rather than hiding the line — the customer's own
                // bookkeeping needs to see that VAT was considered and came to nothing.
                Line($"VAT ({invoice.TaxRate.ToString("0.##", CultureInfo.InvariantCulture)}%)",
                     Money(invoice.TaxAmount, currency));
                tot.Item().PaddingTop(3).BorderTop(1).BorderColor("#d1d5db");
                Line("Total", Money(invoice.Total, currency), bold: true);

                if (invoice.AmountPaid > 0)
                {
                    Line("Paid", $"-{Money(invoice.AmountPaid, currency)}");
                    Line("Balance Due", Money(invoice.Total - invoice.AmountPaid, currency), bold: true);
                }
            });

            if (brand.HasBankDetails)
                col.Item().PaddingTop(16).Background("#f9fafb").Padding(10).Column(bank =>
                {
                    bank.Item().Text("PAYMENT DETAILS").FontSize(7).Bold().FontColor("#9ca3af");
                    bank.Item().PaddingTop(4).Column(rows =>
                    {
                        void Detail(string label, string? value)
                        {
                            if (string.IsNullOrWhiteSpace(value)) return;   // omit, never print blank
                            rows.Item().PaddingVertical(1).Row(r =>
                            {
                                r.ConstantItem(110).Text(label).FontSize(8).FontColor("#6b7280");
                                r.RelativeItem().Text(value!).FontSize(8).SemiBold();
                            });
                        }
                        Detail("Bank",           brand.BankName);
                        Detail("Account Name",   brand.BankAccountName);
                        Detail("Account Number", brand.BankAccountNumber);
                        Detail("IBAN",           brand.BankIban);
                        Detail("SWIFT / BIC",    brand.BankSwift);
                        Detail("Branch",         brand.BankBranch);
                    });
                    bank.Item().PaddingTop(6)
                        .Text($"Please quote invoice {invoice.InvoiceNumber} as the payment reference.")
                        .FontSize(7).Italic().FontColor("#6b7280");
                });

            if (!string.IsNullOrWhiteSpace(invoice.Notes))
                col.Item().PaddingTop(12).Column(n =>
                {
                    n.Item().Text("NOTES").FontSize(7).Bold().FontColor("#9ca3af");
                    n.Item().PaddingTop(2).Text(invoice.Notes!).FontSize(8).FontColor("#4b5563");
                });

            if (sign is not null || stamp is not null)
                col.Item().PaddingTop(20).Row(r =>
                {
                    r.RelativeItem();
                    if (stamp is not null) r.ConstantItem(90).Height(66).AlignRight().Image(stamp).FitArea();
                    if (sign is not null)
                        r.ConstantItem(130).Column(s =>
                        {
                            s.Item().Height(42).AlignRight().Image(sign).FitHeight();
                            s.Item().PaddingTop(2).BorderTop(1).BorderColor("#9ca3af")
                             .AlignRight().Text("Authorised Signatory").FontSize(7).FontColor("#6b7280");
                        });
                });
        });

    /// <summary>
    /// Letterhead images are stored as data URIs (there is no blob store). Anything unreadable is
    /// skipped rather than thrown — a corrupt logo must not stop an invoice going out.
    /// </summary>
    private static byte[]? DecodeImage(string? dataUri)
    {
        if (string.IsNullOrWhiteSpace(dataUri)) return null;
        var comma = dataUri.IndexOf(',');
        if (comma < 0 || !dataUri.StartsWith("data:image", StringComparison.OrdinalIgnoreCase)) return null;
        try { return Convert.FromBase64String(dataUri[(comma + 1)..]); }
        catch { return null; }
    }
}
