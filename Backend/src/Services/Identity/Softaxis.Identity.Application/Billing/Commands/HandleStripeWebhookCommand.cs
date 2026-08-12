using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Identity.Application.Billing.Commands;

/// <summary>
/// Process a Stripe webhook.
///
/// <para>
/// <paramref name="RawBody"/> must be the byte-exact request body — Stripe signs the raw bytes, so
/// deserialising and re-serialising invalidates the signature and the event is rejected.
/// </para>
/// <para>
/// The handler lives in Infrastructure (it needs the Stripe SDK, which has no business leaking into
/// the Application layer). Only this provider-agnostic command crosses the boundary.
/// </para>
/// </summary>
public sealed record HandleStripeWebhookCommand(string RawBody, string? Signature) : ICommand;
