using System.Security;
using System.Text;
using System.Xml.Linq;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Softaxis.Ecommerce.API.Controllers.Common;
using Softaxis.Ecommerce.API.Extensions;
using Softaxis.Ecommerce.Application.Shop;

namespace Softaxis.Ecommerce.API.Controllers;

/// <summary>Which store a browser address belongs to. Anonymous; used once per page load by the storefront.</summary>
[AllowAnonymous]
[Route("api/ecommerce/shop-host")]
[EnableRateLimiting(EcommerceRateLimitPolicies.Browse)]
public sealed class ShopHostController(ISender sender) : EcommerceControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Resolve([FromQuery] string host, CancellationToken ct) => OkOrError(await sender.Send(new ResolveShopHostQuery(host), ct));
}

/// <summary>
/// The public storefront API. No staff sign-in: the store comes from the address, and a signed-in shopper from the
/// <c>X-Shop-Token</c> header. Everything a visitor sees is read from Inventory and the store's own settings on the server —
/// the browser is never trusted for a price, a stock level or a total.
/// </summary>
[AllowAnonymous]
[Route("api/ecommerce/shop/{slug}")]
[EnableRateLimiting(EcommerceRateLimitPolicies.Browse)]
public sealed class ShopController(ISender sender) : EcommerceControllerBase
{
    private string? Token => Request.Headers["X-Shop-Token"].FirstOrDefault();

    /// <summary>The address of the page the shopper is on, taken from the browser. The server checks it belongs to the store before using it.</summary>
    private string? Origin =>
        Request.Headers.Origin.FirstOrDefault()
        ?? (Uri.TryCreate(Request.Headers.Referer.FirstOrDefault(), UriKind.Absolute, out var r) ? r.GetLeftPart(UriPartial.Authority) : null);

    [HttpGet]
    public async Task<IActionResult> Info(string slug, CancellationToken ct) => OkOrError(await sender.Send(new GetShopInfoQuery(slug), ct));

    // ── Catalogue ──
    [HttpGet("products")]
    public async Task<IActionResult> Products(string slug, [FromQuery] string? q, [FromQuery] string? category, [FromQuery] string? collection,
        [FromQuery] string sort = "newest", [FromQuery] int page = 1, [FromQuery] int pageSize = 24, CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetShopProductsQuery(slug, q, category, collection, sort, page, pageSize), ct));

    [HttpGet("products/{productSlug}")]
    public async Task<IActionResult> Product(string slug, string productSlug, CancellationToken ct) => OkOrError(await sender.Send(new GetShopProductQuery(slug, productSlug), ct));

    [HttpGet("categories")]
    public async Task<IActionResult> Categories(string slug, CancellationToken ct) => OkOrError(await sender.Send(new GetShopCategoriesQuery(slug), ct));

    [HttpGet("collections")]
    public async Task<IActionResult> Collections(string slug, CancellationToken ct) => OkOrError(await sender.Send(new GetShopCollectionsQuery(slug), ct));

    [HttpGet("pages/{pageSlug}")]
    public async Task<IActionResult> Page(string slug, string pageSlug, CancellationToken ct) => OkOrError(await sender.Send(new GetShopPageQuery(slug, pageSlug), ct));

    // ── Pictures ──
    [HttpGet("images/{templateId:guid}/{imageId:guid}")]
    public async Task<IActionResult> Image(string slug, Guid templateId, Guid imageId, CancellationToken ct) => await File(await sender.Send(new GetShopImageQuery(slug, templateId, imageId), ct));

    [HttpGet("assets/{assetId:guid}")]
    public async Task<IActionResult> Asset(string slug, Guid assetId, CancellationToken ct) => await File(await sender.Send(new GetShopAssetQuery(slug, assetId), ct));

    private Task<IActionResult> File(Softaxis.BuildingBlocks.Domain.Results.Result<ShopFileDto> r)
    {
        if (r.IsFailure) return Task.FromResult(OkOrError(r));
        // An image address never changes its picture (a new upload gets a new id), so browsers and the CDN may keep it for good.
        Response.Headers.CacheControl = "public, max-age=31536000, immutable";
        Response.Headers["X-Content-Type-Options"] = "nosniff";
        return Task.FromResult<IActionResult>(new FileContentResult(r.Value.Data, r.Value.ContentType));
    }

    // ── Search engines ──
    [HttpGet("sitemap.xml")]
    public async Task<IActionResult> Sitemap(string slug, CancellationToken ct)
    {
        var r = await sender.Send(new GetShopSitemapQuery(slug, Origin ?? $"{Request.Scheme}://{Request.Host}"), ct);
        if (r.IsFailure) return NotFound();
        XNamespace ns = "http://www.sitemaps.org/schemas/sitemap/0.9";
        var doc = new XDocument(new XElement(ns + "urlset", r.Value.Select(u => new XElement(ns + "url", new XElement(ns + "loc", u)))));
        return Content(doc.Declaration is null ? "<?xml version=\"1.0\" encoding=\"utf-8\"?>" + doc.Root : doc.ToString(), "application/xml", Encoding.UTF8);
    }

    // ── Cart and checkout ──
    public sealed record QuoteRequest(IReadOnlyList<ShopCartLine> Items, string? DiscountCode, string? Country, Guid? ZoneId);

    [HttpPost("quote")]
    public async Task<IActionResult> Quote(string slug, [FromBody] QuoteRequest r, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetShopQuoteQuery(slug, r.Items ?? [], r.DiscountCode, r.Country, r.ZoneId), ct));

    public sealed record CheckoutRequest(
        IReadOnlyList<ShopCartLine> Items, string? DiscountCode, string Email, string? Phone, string Name,
        string Line1, string? Line2, string City, string? Region, string? PostalCode, string Country,
        Guid ZoneId, string PaymentMethod, string? Note, bool SaveAddress);

    [HttpPost("checkout")]
    [EnableRateLimiting(EcommerceRateLimitPolicies.Checkout)]
    public async Task<IActionResult> Checkout(string slug, [FromBody] CheckoutRequest r, CancellationToken ct) =>
        OkOrError(await sender.Send(new ShopCheckoutCommand(slug, r.Items ?? [], r.DiscountCode, r.Email ?? "", r.Phone, r.Name ?? "",
            r.Line1 ?? "", r.Line2, r.City ?? "", r.Region, r.PostalCode, r.Country ?? "", r.ZoneId, r.PaymentMethod ?? "", r.Note, Token, Origin, r.SaveAddress), ct));

    [HttpGet("orders/{number}")]
    public async Task<IActionResult> Order(string slug, string number, [FromQuery] string? token = null, CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetShopOrderQuery(slug, number, token ?? ""), ct));

    public sealed record PayPalRequest(string PayPalOrderId);

    [HttpPost("orders/{number}/paypal/capture")]
    [EnableRateLimiting(EcommerceRateLimitPolicies.Checkout)]
    public async Task<IActionResult> Capture(string slug, string number, [FromBody] PayPalRequest r, [FromQuery] string? token = null, CancellationToken ct = default) =>
        OkOrError(await sender.Send(new CaptureShopPayPalCommand(slug, number, token ?? "", r?.PayPalOrderId ?? ""), ct));

    [HttpPost("orders/{number}/pay")]
    [EnableRateLimiting(EcommerceRateLimitPolicies.Checkout)]
    public async Task<IActionResult> Pay(string slug, string number, [FromQuery] string? token = null, CancellationToken ct = default) =>
        OkOrError(await sender.Send(new StartShopPaymentCommand(slug, number, token ?? "", Origin), ct));

    /// <summary>Stripe's server-to-server notice that a payment finished. Verified by signature over the raw body.</summary>
    [HttpPost("webhooks/stripe")]
    [DisableRateLimiting]
    public async Task<IActionResult> StripeWebhook(string slug, CancellationToken ct)
    {
        using var reader = new StreamReader(Request.Body, Encoding.UTF8);
        var payload = await reader.ReadToEndAsync(ct);
        if (payload.Length > 512_000) return BadRequest();
        var r = await sender.Send(new ShopStripeWebhookCommand(slug, payload, Request.Headers["Stripe-Signature"].FirstOrDefault()), ct);
        return r.IsSuccess ? Ok() : BadRequest(new { r.Error.Code });
    }

    // ── Accounts ──
    public sealed record RegisterRequest(string Email, string Password, string FirstName, string LastName, string? Phone, bool AcceptsMarketing);
    public sealed record SignInRequest(string Email, string Password);

    [HttpPost("account/register")]
    [EnableRateLimiting(EcommerceRateLimitPolicies.Auth)]
    public async Task<IActionResult> Register(string slug, [FromBody] RegisterRequest r, CancellationToken ct) =>
        OkOrError(await sender.Send(new ShopRegisterCommand(slug, r.Email ?? "", r.Password ?? "", r.FirstName ?? "", r.LastName ?? "", r.Phone, r.AcceptsMarketing), ct));

    [HttpPost("account/sign-in")]
    [EnableRateLimiting(EcommerceRateLimitPolicies.Auth)]
    public async Task<IActionResult> SignIn(string slug, [FromBody] SignInRequest r, CancellationToken ct) =>
        OkOrError(await sender.Send(new ShopSignInCommand(slug, r.Email ?? "", r.Password ?? ""), ct));

    [HttpGet("account")]
    public async Task<IActionResult> Account(string slug, CancellationToken ct) => OkOrError(await sender.Send(new GetShopAccountQuery(slug, Token ?? ""), ct));

    public sealed record UpdateAccountRequest(string FirstName, string LastName, string? Phone, bool AcceptsMarketing, string? CurrentPassword, string? NewPassword);

    [HttpPut("account")]
    [EnableRateLimiting(EcommerceRateLimitPolicies.Auth)]
    public async Task<IActionResult> UpdateAccount(string slug, [FromBody] UpdateAccountRequest r, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdateShopAccountCommand(slug, Token ?? "", r.FirstName ?? "", r.LastName ?? "", r.Phone, r.AcceptsMarketing, r.CurrentPassword, r.NewPassword), ct));

    [HttpGet("account/orders")]
    public async Task<IActionResult> MyOrders(string slug, [FromQuery] int page = 1, CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetShopMyOrdersQuery(slug, Token ?? "", page), ct));

    public sealed record AddressRequest(string Name, string? Phone, string Line1, string? Line2, string City, string? Region, string? PostalCode, string Country, bool IsDefault);

    [HttpPost("account/addresses")]
    public async Task<IActionResult> AddAddress(string slug, [FromBody] AddressRequest r, CancellationToken ct) =>
        OkOrError(await sender.Send(new SaveShopAddressCommand(slug, Token ?? "", null, r.Name ?? "", r.Phone, r.Line1 ?? "", r.Line2, r.City ?? "", r.Region, r.PostalCode, r.Country ?? "", r.IsDefault), ct));

    [HttpPut("account/addresses/{id:guid}")]
    public async Task<IActionResult> UpdateAddress(string slug, Guid id, [FromBody] AddressRequest r, CancellationToken ct) =>
        OkOrError(await sender.Send(new SaveShopAddressCommand(slug, Token ?? "", id, r.Name ?? "", r.Phone, r.Line1 ?? "", r.Line2, r.City ?? "", r.Region, r.PostalCode, r.Country ?? "", r.IsDefault), ct));

    [HttpDelete("account/addresses/{id:guid}")]
    public async Task<IActionResult> DeleteAddress(string slug, Guid id, CancellationToken ct) => NoContentOrError(await sender.Send(new DeleteShopAddressCommand(slug, Token ?? "", id), ct));

    public sealed record ForgotRequest(string Email);
    public sealed record ResetRequest(string Email, string Token, string NewPassword);

    [HttpPost("account/forgot-password")]
    [EnableRateLimiting(EcommerceRateLimitPolicies.Auth)]
    public async Task<IActionResult> Forgot(string slug, [FromBody] ForgotRequest r, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new ShopForgotPasswordCommand(slug, r.Email ?? "", Origin), ct));

    [HttpPost("account/reset-password")]
    [EnableRateLimiting(EcommerceRateLimitPolicies.Auth)]
    public async Task<IActionResult> Reset(string slug, [FromBody] ResetRequest r, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new ShopResetPasswordCommand(slug, r.Email ?? "", r.Token ?? "", r.NewPassword ?? ""), ct));
}
