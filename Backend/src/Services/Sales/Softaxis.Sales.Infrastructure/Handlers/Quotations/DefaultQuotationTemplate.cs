using Softaxis.Sales.Domain.Entities;

namespace Softaxis.Sales.Infrastructure.Handlers.Quotations;

/// <summary>
/// The starter template every workspace gets the first time it opens its templates.
///
/// It carries the company's look rather than a copy of its details: the letterhead (logo, name,
/// address, TRN, signature, stamp) is read live from Settings → General → Company when a quotation
/// is rendered, and this template turns the logo on. That is deliberate — a snapshot of the
/// company block would go stale the day the logo or address changes, and every quotation sent
/// afterwards would carry the old one.
///
/// Created on first read rather than at startup: a startup seed has no ambient tenant, so the row
/// would land with a NULL tenant and be invisible to the very workspace it was meant for.
/// </summary>
internal static class DefaultQuotationTemplate
{
    public const string Name = "Standard Quotation";

    public static QuotationTemplate Build()
    {
        var t = new QuotationTemplate(Name,
            "Our standard proposal layout: company letterhead, cover note, payment terms and terms & conditions.");

        // {contact} and {customer} are filled in when a quotation is raised for a specific person
        // or company; a template has neither.
        t.Update(
            name:               Name,
            description:        "Our standard proposal layout: company letterhead, cover note, payment terms and terms & conditions.",
            titleTemplate:      "Quotation for {customer}",
            coverNote:          "Dear {contact},\n\nThank you for your interest in working with us. Please find our quotation below. " +
                                "If anything needs adjusting, or you would like to discuss it, just reply to this message and we will be glad to help.",
            termsAndConditions: "1. This quotation is valid until the date shown above; prices may change after that date.\n" +
                                "2. Taxes are shown separately where they apply.\n" +
                                "3. Delivery or start dates are confirmed once the quotation is accepted.\n" +
                                "4. Changes to the scope after acceptance may change the price and will be agreed in writing.\n" +
                                "5. Either party may cancel by written notice; work already carried out remains payable.",
            paymentTerms:       "Payment is due within 30 days of the invoice date.",
            footerNote:         "Thank you for your business.",
            validityDays:       30,
            defaultTaxRate:     0,
            defaultDiscount:    0,
            accentColor:        null,   // null = the company's own accent colour
            showLogo:           true,
            customFields:       null);

        t.SetDefault(true);
        return t;
    }
}
