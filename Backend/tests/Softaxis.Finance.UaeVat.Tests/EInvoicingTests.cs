using System.Net;
using System.Text;
using System.Xml.Linq;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Softaxis.Finance.Application.EInvoicing;
using Softaxis.Finance.Infrastructure.EInvoicing;
using Xunit;

namespace Softaxis.Finance.UaeVat.Tests;

// Offline: the "ASP" is an in-process fake HttpMessageHandler. No real provider is contacted.

internal static class EI
{
    public static readonly XNamespace Cac = "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2";
    public static readonly XNamespace Cbc = "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2";

    public static PintAeInvoice Invoice(string currency = "AED", decimal rate = 1m, string sellerTrn = "100123456700003",
        IReadOnlyList<PintAeLine>? lines = null, decimal prepaid = 0m) =>
        new("INV-1001", "2026-10-15", "2026-11-14", currency, rate,
            new PintAeParty("Acme Trading LLC", sellerTrn, "Office 1, Bay Square", "Dubai", "DXB", "AE"),
            new PintAeParty("Buyer FZ LLC", "100999999900003", "Warehouse 4", "Sharjah", "SHJ", "AE"),
            lines ??
            [
                new(1, "Consulting", 1, "HUR", 1000m, "S", 5m, null),
                new(2, "Export service", 2, "C62", 200m, "Z", 0m, null),
                new(3, "Residential rent", 1, "C62", 600m, "E", 0m, "Residential lease — exempt"),
            ],
            PrepaidAmount: prepaid);
}

public class PintAeBuilderTests
{
    [Fact]
    public void Totals_tax_only_standard_lines()
    {
        var t = PintAeBuilder.Totals(EI.Invoice());
        Assert.Equal(2000m, t.LineTotal);
        Assert.Equal(50m, t.Tax);
        Assert.Equal(2050m, t.Inclusive);
        Assert.Equal(2050m, t.Payable);
    }

    [Fact]
    public void Xml_has_pint_identifiers_parties_and_a_subtotal_per_category()
    {
        var x = XDocument.Parse(PintAeBuilder.Build(EI.Invoice()));
        var root = x.Root!;

        Assert.Equal(PintAeBuilder.CustomizationId, root.Element(EI.Cbc + "CustomizationID")!.Value);
        Assert.Equal("INV-1001", root.Element(EI.Cbc + "ID")!.Value);
        Assert.Equal("380", root.Element(EI.Cbc + "InvoiceTypeCode")!.Value);

        var sellerEndpoint = root.Element(EI.Cac + "AccountingSupplierParty")!.Descendants(EI.Cbc + "EndpointID").Single();
        Assert.Equal("0235", sellerEndpoint.Attribute("schemeID")!.Value);
        Assert.Equal("100123456700003", sellerEndpoint.Value);

        var subtotals = root.Element(EI.Cac + "TaxTotal")!.Elements(EI.Cac + "TaxSubtotal").ToList();
        Assert.Equal(["S", "Z", "E"], subtotals.Select(s => s.Descendants(EI.Cbc + "ID").First().Value));
        Assert.Equal("50.00", root.Element(EI.Cac + "TaxTotal")!.Element(EI.Cbc + "TaxAmount")!.Value);
        Assert.Contains(subtotals, s => s.Descendants(EI.Cbc + "TaxExemptionReason").Any());

        Assert.Equal(3, root.Elements(EI.Cac + "InvoiceLine").Count());
        Assert.Equal("2050.00", root.Element(EI.Cac + "LegalMonetaryTotal")!.Element(EI.Cbc + "PayableAmount")!.Value);
    }

    [Fact]
    public void Foreign_currency_invoice_also_states_vat_in_aed()
    {
        var x = XDocument.Parse(PintAeBuilder.Build(EI.Invoice("USD", 3.6725m)));
        Assert.Equal("AED", x.Root!.Element(EI.Cbc + "TaxCurrencyCode")!.Value);
        var aed = x.Root.Elements(EI.Cac + "TaxTotal")
            .Select(t => t.Element(EI.Cbc + "TaxAmount")!)
            .Single(a => a.Attribute("currencyID")!.Value == "AED");
        Assert.Equal("183.63", aed.Value);   // 50 USD × 3.6725
    }

    [Fact]
    public void Prepaid_reduces_payable_only()
    {
        var t = PintAeBuilder.Totals(EI.Invoice(prepaid: 500m));
        Assert.Equal(2050m, t.Inclusive);
        Assert.Equal(1550m, t.Payable);
    }

    [Fact]
    public void Validation_blocks_bad_seller_trn_and_exempt_line_without_reason()
    {
        var issues = PintAeBuilder.Validate(EI.Invoice(sellerTrn: "12345",
            lines: [new(1, "Rent", 1, "C62", 100m, "E", 0m, null)]));
        Assert.Contains(issues, i => i.Code == "Seller.Trn" && i.Severity == "error");
        Assert.Contains(issues, i => i.Code == "Line.Reason" && i.Severity == "error");
        Assert.True(PintAeBuilder.HasErrors(issues));
    }

    [Fact]
    public void A_clean_invoice_has_no_errors()
    {
        Assert.False(PintAeBuilder.HasErrors(PintAeBuilder.Validate(EI.Invoice())));
    }

    [Fact]
    public void Non_aed_without_rate_is_an_error()
    {
        Assert.Contains(PintAeBuilder.Validate(EI.Invoice("USD", 0m)), i => i.Code == "Invoice.AedRate");
    }
}

public class OAuthAspGatewayTests
{
    private sealed class FakeAsp(Func<HttpRequestMessage, string, HttpResponseMessage> respond) : HttpMessageHandler
    {
        public List<(HttpRequestMessage Req, string Body)> Calls { get; } = [];
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage r, CancellationToken ct)
        {
            var body = r.Content is null ? "" : await r.Content.ReadAsStringAsync(ct);
            Calls.Add((r, body));
            return respond(r, body);
        }
    }

    private sealed class Factory(HttpMessageHandler h) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new(h, disposeHandler: false);
    }

    private sealed class Monitor(EInvoicingOptions o) : IOptionsMonitor<EInvoicingOptions>
    {
        public EInvoicingOptions CurrentValue => o;
        public EInvoicingOptions Get(string? name) => o;
        public IDisposable? OnChange(Action<EInvoicingOptions, string?> listener) => null;
    }

    private static EInvoicingOptions Opts(string? tokenUrl = "https://asp.test/oauth/token") => new()
    {
        Enabled = true, ProviderName = "TestASP", Environment = "sandbox",
        TokenUrl = tokenUrl, SubmitUrl = "https://asp.test/v1/invoices",
        // A unique client id per test keeps the gateway's shared token cache from leaking between tests.
        ClientId = "client-" + Guid.NewGuid().ToString("N"), ClientSecret = "s3cret", Scope = "einvoice",
    };

    private static HttpResponseMessage Json(HttpStatusCode code, string json) =>
        new(code) { Content = new StringContent(json, Encoding.UTF8, "application/json") };

    private static HttpResponseMessage Token(string token = "tok-1") =>
        Json(HttpStatusCode.OK, $$"""{"access_token":"{{token}}","token_type":"Bearer","expires_in":3600}""");

    private static OAuthAspGateway Gateway(FakeAsp asp, EInvoicingOptions o) =>
        new(new Factory(asp), new Monitor(o), NullLogger<OAuthAspGateway>.Instance);

    [Fact]
    public async Task Accepted_sends_bearer_idempotency_key_and_xml()
    {
        var asp = new FakeAsp((r, _) => r.RequestUri!.AbsolutePath.EndsWith("token")
            ? Token() : Json(HttpStatusCode.Accepted, """{"messageId":"ASP-777"}"""));
        var gw = Gateway(asp, Opts());

        var res = await gw.SendAsync("INV-1001", "<Invoice/>", "key-123", default);

        Assert.Equal("accepted", res.Outcome);
        Assert.Equal("ASP-777", res.ProviderMessageId);

        var (tokenReq, tokenBody) = asp.Calls[0];
        Assert.Equal("Basic", tokenReq.Headers.Authorization!.Scheme);
        Assert.Contains("grant_type=client_credentials", tokenBody);
        Assert.Contains("scope=einvoice", tokenBody);

        var (submit, xml) = asp.Calls[1];
        Assert.Equal(HttpMethod.Post, submit.Method);
        Assert.Equal("Bearer", submit.Headers.Authorization!.Scheme);
        Assert.Equal("tok-1", submit.Headers.Authorization.Parameter);
        Assert.Equal("key-123", submit.Headers.GetValues("Idempotency-Key").Single());
        Assert.Equal("<Invoice/>", xml);
    }

    [Fact]
    public async Task Token_is_reused_until_it_expires()
    {
        var asp = new FakeAsp((r, _) => r.RequestUri!.AbsolutePath.EndsWith("token") ? Token() : Json(HttpStatusCode.OK, "{}"));
        var gw = Gateway(asp, Opts());
        await gw.SendAsync("A", "<x/>", "1", default);
        await gw.SendAsync("B", "<x/>", "2", default);
        Assert.Equal(1, asp.Calls.Count(c => c.Req.RequestUri!.AbsolutePath.EndsWith("token")));
    }

    [Fact]
    public async Task A_401_refreshes_the_token_once_and_retries()
    {
        var submits = 0;
        var asp = new FakeAsp((r, _) =>
        {
            if (r.RequestUri!.AbsolutePath.EndsWith("token")) return Token("tok-" + Guid.NewGuid().ToString("N")[..4]);
            return ++submits == 1 ? new HttpResponseMessage(HttpStatusCode.Unauthorized) : Json(HttpStatusCode.OK, """{"id":"X1"}""");
        });
        var res = await Gateway(asp, Opts()).SendAsync("A", "<x/>", "1", default);
        Assert.Equal("accepted", res.Outcome);
        Assert.Equal(2, submits);
        Assert.Equal(2, asp.Calls.Count(c => c.Req.RequestUri!.AbsolutePath.EndsWith("token")));
    }

    [Theory]
    [InlineData(HttpStatusCode.BadRequest, "rejected")]
    [InlineData(HttpStatusCode.UnprocessableEntity, "rejected")]
    [InlineData(HttpStatusCode.ServiceUnavailable, "failed")]
    [InlineData(HttpStatusCode.TooManyRequests, "failed")]
    public async Task Errors_are_classified(HttpStatusCode code, string outcome)
    {
        var asp = new FakeAsp((r, _) => r.RequestUri!.AbsolutePath.EndsWith("token")
            ? Token() : Json(code, """{"error":"BR-AE-01 seller TRN invalid"}"""));
        var res = await Gateway(asp, Opts()).SendAsync("A", "<x/>", "1", default);
        Assert.Equal(outcome, res.Outcome);
        Assert.Equal((int)code, res.HttpStatus);
        Assert.Contains("BR-AE-01", res.Message);
    }

    [Fact]
    public async Task Rejected_sign_in_is_a_failure_and_nothing_is_submitted()
    {
        var asp = new FakeAsp((r, _) => new HttpResponseMessage(HttpStatusCode.Unauthorized));
        var res = await Gateway(asp, Opts()).SendAsync("A", "<x/>", "1", default);
        Assert.Equal("failed", res.Outcome);
        Assert.DoesNotContain(asp.Calls, c => c.Req.RequestUri!.AbsolutePath.EndsWith("invoices"));
        Assert.DoesNotContain("s3cret", res.Message);
    }

    [Fact]
    public async Task Not_configured_sends_nothing()
    {
        var asp = new FakeAsp((_, _) => throw new InvalidOperationException("must not be called"));
        var o = Opts(); o.Enabled = false;
        var gw = Gateway(asp, o);
        Assert.False(gw.IsConfigured);
        Assert.Equal("not_configured", (await gw.SendAsync("A", "<x/>", "1", default)).Outcome);
        Assert.Empty(asp.Calls);
    }

    [Fact]
    public async Task Plain_http_is_refused()
    {
        var asp = new FakeAsp((_, _) => throw new InvalidOperationException("must not be called"));
        var res = await Gateway(asp, Opts("http://asp.test/oauth/token")).SendAsync("A", "<x/>", "1", default);
        Assert.Equal("not_configured", res.Outcome);
        Assert.Empty(asp.Calls);
    }
}
