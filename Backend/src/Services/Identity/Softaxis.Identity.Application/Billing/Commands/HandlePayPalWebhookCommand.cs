using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Identity.Application.Billing.Commands;

/// <summary>
/// Process a PayPal webhook.
///
/// <para>
/// <paramref name="RawBody"/> must be the byte-exact body: PayPal's verification API re-checks the
/// signature against the original JSON, so any reformatting fails verification.
/// <paramref name="Headers"/> carries the <c>paypal-transmission-*</c> / <c>paypal-cert-url</c> /
/// <c>paypal-auth-algo</c> values needed for that call (lower-cased keys).
/// </para>
/// </summary>
public sealed record HandlePayPalWebhookCommand(
    string RawBody,
    IReadOnlyDictionary<string, string> Headers) : ICommand;
