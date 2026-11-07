using System.Xml.Linq;
using Softaxis.Finance.Application.EInvoicing;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.EInvoicing;

namespace Softaxis.Finance.Tests;

public class EInvoicingTests
{
    private static readonly XNamespace Cbc = "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2";
    private static readonly XNamespace Cac = "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2";

    private static EInvoiceParty Supplier() => new("Acme Trading LLC", "100234567800003", "AE:TL", "123456",
        "DED Dubai", "Office 1, Sheikh Zayed Road", "Dubai", "DXB", "AE", null);

    private static EInvoiceParty Buyer(string? trn = "100999888700003") => new("Buyer Co", trn, null, null, null,
        "Shop 4, Al Rigga Road", "Dubai", "DXB", "AE", null);

    private static EInvoiceLine Line(string cat = "S", decimal qty = 2, decimal price = 100, decimal rate = 5, string? reason = null, string? unit = "C62") =>
        new("Consulting", qty, unit, price, cat, rate, reason);

    private static EInvoiceDocument Doc(bool credit = false, string cur = "AED", decimal? aedRate = null,
        EInvoiceParty? supplier = null, EInvoiceParty? buyer = null, params EInvoiceLine[] lines) =>
        new(credit, credit ? "CN-1" : "INV-1", "2026-11-05", credit ? null : "2026-12-05", cur, aedRate, null,
            credit ? "Customer returned goods" : null, credit ? "INV-1" : null, credit ? "2026-11-01" : null,
            supplier ?? Supplier(), buyer ?? Buyer(), lines.Length == 0 ? [Line()] : lines);

    private static bool HasError(IEnumerable<EInvoiceIssue> issues, string code) =>
        issues.Any(i => i.Severity == EInvoiceIssue.Error && i.Code == code);

    // ── Identifiers ──────────────────────────────────────────────────────────────

    [Theory]
    [InlineData("100234567800003", true)]
    [InlineData("10023456780000", false)]      // 14 digits
    [InlineData("1002345678000031", false)]    // 16 digits
    [InlineData("10023456780000A", false)]
    [InlineData(null, false)]
    public void Trn_must_be_exactly_fifteen_digits(string? trn, bool valid) =>
        Assert.Equal(valid, PintAeValidator.IsValidTrn(trn));

    [Fact]
    public void Network_id_is_the_first_ten_digits_of_the_trn()
    {
        Assert.Equal("1002345678", PintAeValidator.TinFromTrn("100234567800003"));
        Assert.Null(PintAeValidator.TinFromTrn("123"));
    }

    // ── Totals ───────────────────────────────────────────────────────────────────

    [Fact]
    public void Totals_group_by_category_and_round_each_group()
    {
        var d = Doc(lines: [Line("S", 3, 33.33m, 5), Line("Z", 1, 50, 0, "Export"), Line("E", 1, 20, 0, "Residential")]);
        var t = PintAeValidator.Totals(d);
        Assert.Equal(169.99m, t.LineExtension);        // 99.99 + 50 + 20
        Assert.Equal(5.00m, t.TaxTotal);               // 5% of 99.99 = 4.9995 -> 5.00
        Assert.Equal(174.99m, t.TaxInclusive);
        Assert.Equal(3, t.Breakdown.Count);
        Assert.Null(t.TaxTotalAed);
    }

    [Fact]
    public void Foreign_currency_states_the_vat_in_dirhams()
    {
        var d = Doc(cur: "USD", aedRate: 3.6725m, lines: [Line("S", 1, 1000, 5)]);
        var t = PintAeValidator.Totals(d);
        Assert.Equal(50.00m, t.TaxTotal);
        Assert.Equal(183.63m, t.TaxTotalAed);          // 50 x 3.6725 = 183.625 -> 183.63
    }

    // ── Validation ───────────────────────────────────────────────────────────────

    [Fact]
    public void A_complete_invoice_has_no_errors()
    {
        var issues = PintAeValidator.Validate(Doc());
        Assert.DoesNotContain(issues, i => i.Severity == EInvoiceIssue.Error);
    }

    [Fact]
    public void Missing_supplier_details_are_each_reported()
    {
        var bad = new EInvoiceParty("", "123", null, null, null, null, null, null, "AE", null);
        var issues = PintAeValidator.Validate(Doc(supplier: bad));
        Assert.True(HasError(issues, "supplier_name"));
        Assert.True(HasError(issues, "supplier_trn"));
        Assert.True(HasError(issues, "supplier_legal_id"));
        Assert.True(HasError(issues, "supplier_street"));
        Assert.True(HasError(issues, "supplier_emirate"));
    }

    [Fact]
    public void A_trade_licence_needs_its_issuing_authority()
    {
        var s = Supplier() with { RegistrationAuthority = null };
        Assert.True(HasError(PintAeValidator.Validate(Doc(supplier: s)), "supplier_authority"));
    }

    [Fact]
    public void An_unknown_emirate_is_refused()
    {
        var b = Buyer() with { Emirate = "Dubai" };   // the name, not the code
        Assert.True(HasError(PintAeValidator.Validate(Doc(buyer: b)), "buyer_emirate"));
    }

    [Fact]
    public void A_buyer_without_a_trn_is_a_warning_not_an_error()
    {
        var issues = PintAeValidator.Validate(Doc(buyer: Buyer(trn: null)));
        Assert.DoesNotContain(issues, i => i.Severity == EInvoiceIssue.Error);
        Assert.Contains(issues, i => i.Severity == EInvoiceIssue.Warning && i.Code == "buyer_trn");
    }

    [Fact]
    public void A_malformed_buyer_trn_is_an_error()
    {
        Assert.True(HasError(PintAeValidator.Validate(Doc(buyer: Buyer("12345"))), "buyer_trn"));
    }

    [Theory]
    [InlineData("Z")]
    [InlineData("E")]
    [InlineData("O")]
    public void Non_standard_lines_need_a_reason(string cat) =>
        Assert.True(HasError(PintAeValidator.Validate(Doc(lines: [Line(cat, rate: 0)])), "line_exemption_reason"));

    [Fact]
    public void A_standard_line_with_a_zero_rate_is_refused() =>
        Assert.True(HasError(PintAeValidator.Validate(Doc(lines: [Line("S", rate: 0)])), "line_tax_rate"));

    [Fact]
    public void Negative_or_zero_quantities_are_refused_because_corrections_use_credit_notes() =>
        Assert.True(HasError(PintAeValidator.Validate(Doc(lines: [Line(qty: -1)])), "line_quantity"));

    [Fact]
    public void A_foreign_currency_invoice_without_a_rate_is_refused() =>
        Assert.True(HasError(PintAeValidator.Validate(Doc(cur: "USD", aedRate: null)), "aed_rate"));

    [Fact]
    public void An_unrecognised_unit_code_is_only_a_warning()
    {
        var issues = PintAeValidator.Validate(Doc(lines: [Line(unit: "ZZZ")]));
        Assert.DoesNotContain(issues, i => i.Severity == EInvoiceIssue.Error);
        Assert.Contains(issues, i => i.Code == "line_unit");
    }

    [Fact]
    public void A_credit_note_needs_a_reason_and_the_invoice_it_corrects()
    {
        var d = Doc(credit: true) with { CreditReason = null, OriginalInvoiceNumber = null };
        var issues = PintAeValidator.Validate(d);
        Assert.True(HasError(issues, "credit_reason"));
        Assert.True(HasError(issues, "original_invoice"));
    }

    [Fact]
    public void A_document_with_no_lines_is_refused() =>
        Assert.True(HasError(PintAeValidator.Validate(Doc() with { Lines = [] }), "lines"));

    // ── XML ──────────────────────────────────────────────────────────────────────

    [Fact]
    public void The_invoice_xml_is_well_formed_and_carries_the_pint_ae_identifiers()
    {
        var xml = PintAeBuilder.Build(Doc());
        var doc = XDocument.Parse(xml);
        var root = doc.Root!;

        Assert.Equal("Invoice", root.Name.LocalName);
        Assert.Equal("urn:peppol:pint:billing-1@ae-1", (string)root.Element(Cbc + "CustomizationID")!);
        Assert.Equal("urn:peppol:bis:billing", (string)root.Element(Cbc + "ProfileID")!);
        Assert.Equal("INV-1", (string)root.Element(Cbc + "ID")!);
        Assert.Equal("380", (string)root.Element(Cbc + "InvoiceTypeCode")!);
        Assert.Equal("AED", (string)root.Element(Cbc + "DocumentCurrencyCode")!);
        Assert.Null(root.Element(Cbc + "TaxCurrencyCode"));
        Assert.Contains("Not certified", xml);
    }

    [Fact]
    public void Parties_carry_the_network_id_trn_and_legal_registration()
    {
        var root = XDocument.Parse(PintAeBuilder.Build(Doc())).Root!;
        var party = root.Element(Cac + "AccountingSupplierParty")!.Element(Cac + "Party")!;

        var endpoint = party.Element(Cbc + "EndpointID")!;
        Assert.Equal("0235", (string)endpoint.Attribute("schemeID")!);
        Assert.Equal("1002345678", endpoint.Value);
        Assert.Equal("100234567800003", (string)party.Element(Cac + "PartyTaxScheme")!.Element(Cbc + "CompanyID")!);

        var legal = party.Element(Cac + "PartyLegalEntity")!.Element(Cbc + "CompanyID")!;
        Assert.Equal("AE:TL", (string)legal.Attribute("schemeID")!);
        Assert.Equal("123456", legal.Value);
        Assert.Equal("DXB", (string)party.Element(Cac + "PostalAddress")!.Element(Cbc + "CountrySubentity")!);
    }

    [Fact]
    public void A_buyer_not_on_the_network_without_a_trn_gets_the_reserved_endpoint()
    {
        var root = XDocument.Parse(PintAeBuilder.Build(Doc(buyer: Buyer(trn: null)))).Root!;
        var endpoint = root.Element(Cac + "AccountingCustomerParty")!.Element(Cac + "Party")!.Element(Cbc + "EndpointID")!;
        Assert.Equal("9900000098", endpoint.Value);
    }

    [Fact]
    public void A_peppol_id_on_the_customer_wins_over_the_trn()
    {
        var b = Buyer() with { PeppolId = "0235:5555555555" };
        var root = XDocument.Parse(PintAeBuilder.Build(Doc(buyer: b))).Root!;
        var endpoint = root.Element(Cac + "AccountingCustomerParty")!.Element(Cac + "Party")!.Element(Cbc + "EndpointID")!;
        Assert.Equal("5555555555", endpoint.Value);
    }

    [Fact]
    public void Totals_and_lines_in_the_xml_match_the_computed_figures()
    {
        var root = XDocument.Parse(PintAeBuilder.Build(Doc(lines: [Line("S", 2, 100, 5), Line("Z", 1, 40, 0, "Export")]))).Root!;
        var monetary = root.Element(Cac + "LegalMonetaryTotal")!;
        Assert.Equal("240.00", (string)monetary.Element(Cbc + "LineExtensionAmount")!);
        Assert.Equal("250.00", (string)monetary.Element(Cbc + "TaxInclusiveAmount")!);
        Assert.Equal("250.00", (string)monetary.Element(Cbc + "PayableAmount")!);
        Assert.Equal("10.00", (string)root.Element(Cac + "TaxTotal")!.Element(Cbc + "TaxAmount")!);
        Assert.Equal(2, root.Elements(Cac + "InvoiceLine").Count());
        Assert.Equal(2, root.Element(Cac + "TaxTotal")!.Elements(Cac + "TaxSubtotal").Count());
    }

    [Fact]
    public void A_foreign_currency_invoice_has_a_second_tax_total_in_dirhams()
    {
        var root = XDocument.Parse(PintAeBuilder.Build(Doc(cur: "USD", aedRate: 3.6725m, lines: [Line("S", 1, 1000, 5)]))).Root!;
        Assert.Equal("AED", (string)root.Element(Cbc + "TaxCurrencyCode")!);
        var totals = root.Elements(Cac + "TaxTotal").ToList();
        Assert.Equal(2, totals.Count);
        Assert.Equal("AED", (string)totals[1].Element(Cbc + "TaxAmount")!.Attribute("currencyID")!);
        Assert.Equal("183.63", totals[1].Element(Cbc + "TaxAmount")!.Value);
    }

    [Fact]
    public void A_credit_note_uses_the_credit_note_structure_and_refers_to_the_invoice()
    {
        var root = XDocument.Parse(PintAeBuilder.Build(Doc(credit: true))).Root!;
        Assert.Equal("CreditNote", root.Name.LocalName);
        Assert.Equal("381", (string)root.Element(Cbc + "CreditNoteTypeCode")!);
        Assert.Null(root.Element(Cbc + "DueDate"));
        Assert.Equal("INV-1", (string)root.Element(Cac + "BillingReference")!.Element(Cac + "InvoiceDocumentReference")!.Element(Cbc + "ID")!);
        Assert.Contains("Customer returned goods", (string)root.Element(Cbc + "Note")!);
        Assert.Single(root.Elements(Cac + "CreditNoteLine"));
        Assert.Empty(root.Elements(Cac + "InvoiceLine"));
    }

    [Fact]
    public void Exemption_reasons_are_written_on_the_line_and_the_subtotal()
    {
        var root = XDocument.Parse(PintAeBuilder.Build(Doc(lines: [Line("E", 1, 10, 0, "Residential rent")]))).Root!;
        Assert.Contains("Residential rent", root.ToString());
    }

    [Fact]
    public void Special_characters_in_names_are_escaped()
    {
        var b = Buyer() with { Name = "Smith & Co <Ltd>" };
        var xml = PintAeBuilder.Build(Doc(buyer: b));
        var root = XDocument.Parse(xml).Root!;      // would throw if the markup were broken
        Assert.Contains("Smith & Co <Ltd>", root.Descendants(Cbc + "RegistrationName").Select(e => e.Value));
    }

    [Fact]
    public void The_same_document_always_produces_the_same_xml_and_hash()
    {
        var a = PintAeBuilder.Build(Doc());
        var b = PintAeBuilder.Build(Doc());
        Assert.Equal(a, b);
        Assert.Equal(PintAeBuilder.Hash(a), PintAeBuilder.Hash(b));
        Assert.NotEqual(PintAeBuilder.Hash(a), PintAeBuilder.Hash(PintAeBuilder.Build(Doc(lines: [Line(price: 101)]))));
    }

    // ── Submissions ──────────────────────────────────────────────────────────────

    [Fact]
    public void A_new_submission_is_queued_and_due_now()
    {
        var s = new EInvoiceSubmission("invoice", Guid.NewGuid(), "INV-1", "storecove");
        Assert.Equal(EInvoiceStatus.Queued, s.Status);
        Assert.True(s.NextAttemptAt <= DateTime.UtcNow);
    }

    [Fact]
    public void Failures_back_off_and_give_up_after_eight_attempts()
    {
        var s = new EInvoiceSubmission("invoice", Guid.NewGuid(), "INV-1", "storecove");
        for (var i = 1; i <= 7; i++)
        {
            s.BeginAttempt("<x/>", "h");
            s.Failed("provider busy");
            Assert.Equal(EInvoiceStatus.Queued, s.Status);
            Assert.True(s.NextAttemptAt > DateTime.UtcNow);
        }
        s.BeginAttempt("<x/>", "h");
        s.Failed("provider busy");
        Assert.Equal(EInvoiceStatus.Failed, s.Status);
        Assert.Null(s.NextAttemptAt);
    }

    [Fact]
    public void The_first_document_sent_is_the_one_kept()
    {
        var s = new EInvoiceSubmission("invoice", Guid.NewGuid(), "INV-1", "storecove");
        s.BeginAttempt("<first/>", "h1");
        s.Failed("busy");
        s.BeginAttempt("<second/>", "h2");
        Assert.Equal("<first/>", s.XmlSnapshot);
        Assert.Equal("h1", s.PayloadHash);
    }

    [Fact]
    public void Success_clears_the_error_and_stops_retrying()
    {
        var s = new EInvoiceSubmission("invoice", Guid.NewGuid(), "INV-1", "storecove");
        s.BeginAttempt("<x/>", "h");
        s.Failed("busy");
        s.BeginAttempt("<x/>", "h");
        s.Succeeded(EInvoiceStatus.Sent, "ext-1");
        Assert.Equal(EInvoiceStatus.Sent, s.Status);
        Assert.Null(s.LastError);
        Assert.Null(s.NextAttemptAt);
        Assert.Equal("ext-1", s.ExternalId);
    }

    [Fact]
    public void A_rejected_document_is_not_retried_automatically_but_can_be_requeued()
    {
        var s = new EInvoiceSubmission("invoice", Guid.NewGuid(), "INV-1", "storecove");
        s.BeginAttempt("<x/>", "h");
        s.Rejected("Buyer is not registered");
        Assert.Equal(EInvoiceStatus.Rejected, s.Status);
        Assert.Null(s.NextAttemptAt);
        s.Requeue();
        Assert.Equal(EInvoiceStatus.Queued, s.Status);
        Assert.Null(s.LastError);
    }

    [Fact]
    public void Only_documents_being_sent_or_already_out_are_locked_against_editing()
    {
        foreach (var st in new[] { EInvoiceStatus.Sending, EInvoiceStatus.Sent, EInvoiceStatus.Delivered, EInvoiceStatus.Accepted })
            Assert.Contains(st, EInvoiceStatus.Locking);
        foreach (var st in new[] { EInvoiceStatus.Queued, EInvoiceStatus.Blocked, EInvoiceStatus.Failed, EInvoiceStatus.Rejected })
            Assert.DoesNotContain(st, EInvoiceStatus.Locking);
    }

    [Fact]
    public async Task The_default_gateway_sends_nothing_and_says_so()
    {
        var gw = new UnavailableEInvoiceGateway();
        Assert.False(gw.IsAvailable);
        var result = await gw.SendAsync(new EInvoiceSendRequest("invoice", Guid.NewGuid(), "INV-1", "sandbox", "k", "<x/>", Doc()), CancellationToken.None);
        Assert.Equal(EInvoiceSendOutcome.NotAvailable, result.Outcome);
        Assert.Null(result.ExternalId);
    }

    // ── Credit notes and invoice balance ─────────────────────────────────────────

    private static CreditNote NewCredit(params CreditNoteItem[] items)
    {
        var cn = new CreditNote(Guid.NewGuid(), "INV-1", "Buyer Co", null, null, null, null, "2026-11-05", 5, "AED", "Returned", null);
        foreach (var i in items) cn.Items.Add(i);
        return cn;
    }

    [Fact]
    public void Credit_note_totals_apply_vat_only_to_standard_lines()
    {
        var cn = NewCredit();
        cn.Items.Add(new CreditNoteItem(cn.Id, "Std", 2, 100, null, null, null));
        cn.Items.Add(new CreditNoteItem(cn.Id, "Zero", 1, 50, "Z", null, "Export"));
        Assert.Equal(250m, cn.SubTotal);
        Assert.Equal(10m, cn.TaxAmount);
        Assert.Equal(260m, cn.Total);
    }

    [Fact]
    public void Issuing_a_credit_note_moves_it_out_of_draft()
    {
        var cn = NewCredit();
        var entry = Guid.NewGuid();
        cn.Issue(entry);
        Assert.Equal("issued", cn.Status);
        Assert.Equal(entry, cn.JournalEntryId);
        Assert.NotNull(cn.IssuedAt);
    }

    [Fact]
    public void A_credit_reduces_what_is_due_without_counting_as_money_received()
    {
        var inv = new Invoice("Buyer Co", null, "2026-11-01", "2026-12-01", 5, null);
        inv.Items.Add(new InvoiceItem(inv.Id, "Work", 1, 1000, null, null, null));
        Assert.Equal(1050m, inv.AmountDue);

        inv.ApplyCredit(210m);
        Assert.Equal(840m, inv.AmountDue);
        Assert.Equal(0m, inv.AmountPaid);

        inv.ReverseCredit(210m);
        Assert.Equal(1050m, inv.AmountDue);
    }

    [Fact]
    public void An_invoice_is_settled_when_payments_plus_credits_cover_the_total()
    {
        var inv = new Invoice("Buyer Co", null, "2026-11-01", "2026-12-01", 5, null);
        inv.Items.Add(new InvoiceItem(inv.Id, "Work", 1, 1000, null, null, null));
        inv.ApplyCredit(250m);
        inv.RecordPayment(800m);
        Assert.Equal("paid", inv.Status);
        Assert.Equal(0m, inv.AmountDue);
    }

    [Fact]
    public void Settings_ignore_unknown_environments_and_blank_providers()
    {
        var s = new EInvoiceSettings("none");
        s.Update("  ", "Staging", false, " ", "ae:tl", " 123 ", null, "Dubai");
        Assert.Equal("none", s.ProviderKey);
        Assert.Equal("sandbox", s.Environment);
        Assert.Null(s.GoLiveDate);
        Assert.Equal("AE:TL", s.LegalIdScheme);
        Assert.Equal("123", s.LegalId);
    }
}
