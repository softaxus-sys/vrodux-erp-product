using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.DependencyInjection;
using Softaxis.RealEstate.Application.WebsiteIntegrations;
using Softaxis.RealEstate.Domain.Entities;

namespace Softaxis.RealEstate.API.Authorization;

/// <summary>
/// Authenticates a website by its API key and pins it to the one website address configured for
/// that key.
///
/// Two independent checks:
///  1. <b>API key</b> (<c>X-Api-Key</c> header) — the real credential. It identifies the workspace,
///     so a website can only ever read its own workspace's published properties.
///  2. <b>Website address</b> — when the request carries an <c>Origin</c> or <c>Referer</c> header
///     (every browser request does), it must match the configured website. A key copied into
///     another site's front-end is refused there.
///
/// A server-side request (the website's own server fetching listings, which is how it should be
/// used) sends neither header, so it passes on the key alone. Headers can be forged by a
/// non-browser client, which is why the key — kept on the website's server, never in a browser —
/// is the control that matters, and why it can be regenerated at any time.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class WebsiteApiKeyAttribute : Attribute, IAsyncActionFilter
{
    public const string HeaderName = "X-Api-Key";
    public const string ClientItemKey = "WebsiteClient";

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var http = context.HttpContext;
        var key = http.Request.Headers[HeaderName].ToString();

        if (string.IsNullOrWhiteSpace(key))
        {
            context.Result = Fail(StatusCodes.Status401Unauthorized, "ApiKey.Missing", $"Send the website API key in the {HeaderName} header.");
            return;
        }

        var sender = http.RequestServices.GetRequiredService<ISender>();
        var result = await sender.Send(new ResolveWebsiteClientQuery(key), http.RequestAborted);
        if (!result.IsSuccess)
        {
            context.Result = Fail(StatusCodes.Status401Unauthorized, "ApiKey.Invalid", "Invalid or inactive API key.");
            return;
        }

        var client = result.Value;
        if (!IsAllowedCaller(http.Request, client.WebsiteOrigin))
        {
            context.Result = Fail(StatusCodes.Status403Forbidden, "ApiKey.OriginNotAllowed",
                "This API key is not allowed from this website.");
            return;
        }

        http.Items[ClientItemKey] = client;
        await next();
    }

    /// <summary>Origin and Referer are only checked when present; see the class remarks.</summary>
    internal static bool IsAllowedCaller(HttpRequest request, string allowedOrigin)
    {
        var origin = request.Headers.Origin.ToString();
        if (!string.IsNullOrEmpty(origin)
            && !string.Equals(WebsiteIntegration.NormaliseOrigin(origin), allowedOrigin, StringComparison.OrdinalIgnoreCase))
            return false;

        var referer = request.Headers.Referer.ToString();
        if (!string.IsNullOrEmpty(referer)
            && !string.Equals(WebsiteIntegration.NormaliseOrigin(referer), allowedOrigin, StringComparison.OrdinalIgnoreCase))
            return false;

        return true;
    }

    private static ObjectResult Fail(int status, string code, string description) =>
        new(new { Code = code, Description = description }) { StatusCode = status };
}
