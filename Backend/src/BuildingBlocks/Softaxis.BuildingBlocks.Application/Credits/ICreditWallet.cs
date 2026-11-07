namespace Softaxis.BuildingBlocks.Application.Credits;

/// <summary>
/// A module that sells credits (SEO audits, Lead Generation, …). The central Billing page lists every
/// registered wallet, sells credits for it and delivers them — the module only says what it is and
/// how to add to / read its own balance. Adding a new paid add-on is therefore one class implementing
/// this interface plus one DI line; it then appears on the Billing page with its own price and balance.
/// </summary>
public interface ICreditWallet
{
    /// <summary>Stable key, e.g. <c>seo</c>. Stored on purchases and used as the key of the price table.</summary>
    string ModuleKey { get; }

    /// <summary>Shown on the Billing page, e.g. "SEO audits".</summary>
    string DisplayName { get; }

    /// <summary>One or two sentences: what these credits are for.</summary>
    string Description { get; }

    /// <summary>Short plain-language rules of thumb, shown as the card's instructions ("1 credit checks about 25 pages").</summary>
    IReadOnlyList<string> HowItWorks { get; }

    /// <summary>"credit" for everything today; a module could say "scan" or "reveal".</summary>
    string UnitName => "credit";

    /// <summary>Current balance for a workspace. Must not create a wallet or grant anything as a side effect.</summary>
    Task<long> BalanceAsync(Guid tenantId, CancellationToken ct);

    /// <summary>
    /// Adds purchased credits. <paramref name="purchaseId"/> is the idempotency key: calling this twice
    /// for the same purchase (a webhook retry, a restart half-way) must add the credits exactly once.
    /// Returns false only when the credits could not be added.
    /// </summary>
    Task<bool> AddPurchasedAsync(Guid tenantId, int credits, string reason, Guid purchaseId, CancellationToken ct);

    /// <summary>
    /// How many credits may be swapped out to another module: only credits that were bought (or swapped in), never free ones.
    /// Computed as <c>balance − free credits not yet used up</c>, assuming usage drains free credits first — the
    /// conservative reading, so a free grant can never be converted into another module's paid credits.
    /// </summary>
    Task<long> SwappableAsync(Guid tenantId, CancellationToken ct);

    /// <summary>Takes credits out for a swap. Guarded like any spend (never below zero); idempotent on <paramref name="swapId"/>. False if there were not enough.</summary>
    Task<bool> RemoveForSwapAsync(Guid tenantId, int credits, string reason, Guid swapId, CancellationToken ct);

    /// <summary>Adds the credits received from a swap. Idempotent on <paramref name="swapId"/>.</summary>
    Task<bool> AddFromSwapAsync(Guid tenantId, int credits, string reason, Guid swapId, CancellationToken ct);
}
