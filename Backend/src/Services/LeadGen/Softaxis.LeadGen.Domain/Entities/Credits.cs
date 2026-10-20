namespace Softaxis.LeadGen.Domain.Entities;

/// <summary>
/// A workspace's credit balance. The number here is only ever changed by the single guarded SQL
/// statements in the credit service — never by assigning a property — so two people spending at
/// once cannot both succeed against the same last credit. The ledger below is the audit trail.
/// </summary>
public sealed class CreditWallet
{
    private CreditWallet() { }
    public static CreditWallet CreateEmpty() => new() { Id = Guid.NewGuid() };

    public Guid     Id                { get; private set; }
    public long     Balance           { get; private set; }
    public long     LifetimePurchased { get; private set; }
    public long     LifetimeSpent     { get; private set; }
    public long     LifetimeRefunded  { get; private set; }
    /// <summary>The one-time starter grant has been given.</summary>
    public bool      TrialGranted     { get; private set; }
    /// <summary>Raised when the balance falls to this or below. Null = no alert.</summary>
    public long?     LowBalanceAlert  { get; private set; }
    public DateTime  CreatedAt        { get; private set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt        { get; private set; }

    public void SetLowBalanceAlert(long? threshold) { LowBalanceAlert = threshold; UpdatedAt = DateTime.UtcNow; }
    public void MarkTrialGranted() { TrialGranted = true; UpdatedAt = DateTime.UtcNow; }
}

/// <summary>Every credit movement. Amount is signed: purchases and refunds are positive, spend is negative.</summary>
public sealed class CreditLedgerEntry
{
    private CreditLedgerEntry() { }

    public CreditLedgerEntry(string type, int amount, long balanceAfter, string reason, string? refType, Guid? refId,
        string idempotencyKey, Guid? actorUserId, string? actorName)
    {
        Id = Guid.NewGuid(); Type = type; Amount = amount; BalanceAfter = balanceAfter; Reason = reason;
        RefType = refType; RefId = refId; IdempotencyKey = idempotencyKey; ActorUserId = actorUserId; ActorName = actorName;
    }

    public Guid     Id             { get; private set; }
    public string   Type           { get; private set; } = LedgerType.Adjustment;
    public int      Amount         { get; private set; }
    public long     BalanceAfter   { get; private set; }
    public string   Reason         { get; private set; } = string.Empty;
    public string?  RefType        { get; private set; }
    public Guid?    RefId          { get; private set; }
    /// <summary>Unique per workspace. A repeated webhook or retried request cannot post a second row.</summary>
    public string   IdempotencyKey { get; private set; } = null!;
    public Guid?    ActorUserId    { get; private set; }
    public string?  ActorName      { get; private set; }
    public DateTime CreatedAt      { get; private set; } = DateTime.UtcNow;
}

/// <summary>A purchase of a credit pack, from checkout to payment.</summary>
public sealed class CreditPurchase
{
    private CreditPurchase() { }

    public CreditPurchase(Guid packId, string packName, int credits, long amountMinor, string currency,
        string provider, Guid? userId, string? userName)
    {
        Id = Guid.NewGuid(); PackId = packId; PackName = packName; Credits = credits; AmountMinor = amountMinor;
        Currency = currency; Provider = provider; CreatedByUserId = userId; CreatedByName = userName;
    }

    public Guid      Id          { get; private set; }
    public Guid      PackId      { get; private set; }
    public string    PackName    { get; private set; } = null!;
    public int       Credits     { get; private set; }
    public long      AmountMinor { get; private set; }
    public string    Currency    { get; private set; } = "USD";
    public string    Provider    { get; private set; } = "stripe";
    /// <summary>Stripe session id or PayPal order id. Set once the provider has created the checkout.</summary>
    public string?   ProviderRef { get; private set; }
    public string    Status      { get; private set; } = PurchaseStatus.Pending;
    public string?   FailureReason { get; private set; }
    public Guid?     CreatedByUserId { get; private set; }
    public string?   CreatedByName   { get; private set; }
    public DateTime  CreatedAt   { get; private set; } = DateTime.UtcNow;
    public DateTime? PaidAt      { get; private set; }

    public void SetProviderRef(string reference) => ProviderRef = reference;
    public void MarkPaid() { Status = PurchaseStatus.Paid; PaidAt = DateTime.UtcNow; }
    public void MarkFailed(string reason) { Status = PurchaseStatus.Failed; FailureReason = reason.Length > 300 ? reason[..300] : reason; }
    public void MarkExpired() => Status = PurchaseStatus.Expired;
}
