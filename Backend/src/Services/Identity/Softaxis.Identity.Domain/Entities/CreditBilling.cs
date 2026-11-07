using Softaxis.Identity.Domain.Enums;

namespace Softaxis.Identity.Domain.Entities;

public sealed record CreditTier(int FromCredits, decimal DiscountPercent);

/// <summary>
/// What a credit costs and the rules for buying them — editable by the platform owner without a redeploy.
/// Single row. A module is on sale only when it has a price here; with no row at all nothing is for sale,
/// so a fresh install can never sell credits at a price nobody chose.
/// </summary>
public sealed class CreditPricingSettings
{
    public static readonly Guid SingletonId = new("b2222222-0000-4000-8000-000000000002");

    private CreditPricingSettings() { }

    public CreditPricingSettings(string? updatedBy = null)
    {
        Id = SingletonId; UpdatedAt = DateTime.UtcNow; UpdatedBy = updatedBy;
        Tiers = DefaultTiers();
    }

    public Guid Id { get; private set; }

    /// <summary>USD price of ONE credit, per module key. Absent or zero = not for sale.</summary>
    public Dictionary<string, decimal> PricePerCredit { get; private set; } = [];

    /// <summary>Whole-order discount by quantity; the highest tier whose threshold the order reaches applies.</summary>
    public List<CreditTier> Tiers { get; private set; } = [];

    public int     MinCredits  { get; private set; } = 20;
    /// <summary>Smallest order in USD — card fees make smaller orders lose money.</summary>
    public decimal MinOrderUsd { get; private set; } = 5m;
    /// <summary>Largest online order in USD; above it the customer is asked to contact us.</summary>
    public decimal MaxOrderUsd { get; private set; } = 1000m;
    /// <summary>VAT added on top of the price. 0 while the company is not VAT-registered.</summary>
    public decimal VatPercent  { get; private set; }

    /// <summary>Whether customers may move purchased credits from one module to another.</summary>
    public bool    SwapEnabled     { get; private set; } = true;
    /// <summary>Taken from the value being moved (so 10 means "you receive 10% less value"). 0 = a straight value-for-value swap.</summary>
    public decimal SwapFeePercent  { get; private set; }
    public int     MinSwapCredits  { get; private set; } = 10;

    public DateTime UpdatedAt { get; private set; }
    public string?  UpdatedBy { get; private set; }

    public static List<CreditTier> DefaultTiers() =>
    [
        new(0, 0m), new(100, 5m), new(500, 10m), new(2000, 15m), new(10000, 20m),
    ];

    public void Update(IDictionary<string, decimal> prices, IEnumerable<CreditTier> tiers, int minCredits, decimal minOrderUsd, decimal maxOrderUsd, decimal vatPercent, bool swapEnabled, decimal swapFeePercent, int minSwapCredits, string? updatedBy)
    {
        PricePerCredit = prices.Where(kv => kv.Value > 0).ToDictionary(kv => kv.Key.Trim().ToLowerInvariant(), kv => Math.Round(kv.Value, 4));
        var cleaned = tiers.Where(t => t.FromCredits >= 0 && t.DiscountPercent is >= 0 and < 100)
            .GroupBy(t => t.FromCredits).Select(g => g.Last()).OrderBy(t => t.FromCredits).ToList();
        if (cleaned.Count == 0 || cleaned[0].FromCredits != 0) cleaned.Insert(0, new CreditTier(0, 0m));
        Tiers = cleaned;
        MinCredits = Math.Max(1, minCredits);
        MinOrderUsd = Math.Max(0m, minOrderUsd);
        MaxOrderUsd = Math.Max(MinOrderUsd, maxOrderUsd);
        VatPercent = Math.Clamp(vatPercent, 0m, 100m);
        SwapEnabled = swapEnabled;
        SwapFeePercent = Math.Clamp(swapFeePercent, 0m, 90m);
        MinSwapCredits = Math.Max(1, minSwapCredits);
        UpdatedAt = DateTime.UtcNow; UpdatedBy = updatedBy;
    }
}

/// <summary>Lifecycle of a credit purchase. <c>credited</c> is the only state in which the customer has the credits.</summary>
public static class CreditPurchaseStatus
{
    public const string Pending = "pending", Paid = "paid", Credited = "credited", Failed = "failed";
}

/// <summary>
/// One purchase of credits for one module. Created BEFORE the customer is sent to the payment page, so
/// a webhook can always be matched to a row we wrote and priced ourselves — never to anything the
/// browser sent back.
/// </summary>
public sealed class CreditPurchase
{
    private CreditPurchase() { }

    public CreditPurchase(Guid tenantId, string moduleKey, int credits, decimal unitPrice, decimal discountPercent,
        decimal netAmount, decimal vatAmount, decimal totalAmount, PaymentProvider provider, Guid? userId, string? userName)
    {
        Id = Guid.NewGuid(); TenantId = tenantId; ModuleKey = moduleKey; Credits = credits; UnitPrice = unitPrice;
        DiscountPercent = discountPercent; NetAmount = netAmount; VatAmount = vatAmount; TotalAmount = totalAmount;
        Currency = "USD"; Provider = provider; Status = CreditPurchaseStatus.Pending;
        CreatedByUserId = userId; CreatedByName = userName; CreatedAt = DateTime.UtcNow;
    }

    public Guid     Id              { get; private set; }
    public Guid     TenantId        { get; private set; }
    public string   ModuleKey       { get; private set; } = string.Empty;
    public int      Credits         { get; private set; }
    public decimal  UnitPrice       { get; private set; }
    public decimal  DiscountPercent { get; private set; }
    public decimal  NetAmount       { get; private set; }
    public decimal  VatAmount       { get; private set; }
    public decimal  TotalAmount     { get; private set; }
    public string   Currency        { get; private set; } = "USD";
    public PaymentProvider Provider { get; private set; }
    /// <summary>Stripe Checkout Session id / PayPal order id.</summary>
    public string?  ProviderRef     { get; private set; }
    public string?  ProviderPaymentId { get; private set; }
    public string   Status          { get; private set; } = CreditPurchaseStatus.Pending;
    public string?  Error           { get; private set; }
    public Guid?    CreatedByUserId { get; private set; }
    public string?  CreatedByName   { get; private set; }
    public DateTime CreatedAt       { get; private set; }
    public DateTime? PaidAt         { get; private set; }
    public DateTime? CreditedAt     { get; private set; }

    public void SetProviderRef(string reference) => ProviderRef = reference;
    public void MarkFailed(string error) { Status = CreditPurchaseStatus.Failed; Error = error.Length > 500 ? error[..500] : error; }
}

/// <summary>
/// One swap of credits between two modules. The two wallets live in different modules (and databases schemas), so a swap
/// cannot be one transaction: it moves through <c>pending → removed → done</c>, every step idempotent on this row's id,
/// and a step that fails after the first is undone or completed — credits are never left half-moved.
/// </summary>
public sealed class CreditSwap
{
    public const string Pending = "pending", Removed = "removed", Done = "done", Failed = "failed";

    private CreditSwap() { }

    public CreditSwap(Guid tenantId, string fromModule, string toModule, int fromCredits, int toCredits,
        decimal fromPrice, decimal toPrice, decimal feePercent, Guid? userId, string? userName)
    {
        Id = Guid.NewGuid(); TenantId = tenantId; FromModule = fromModule; ToModule = toModule; FromCredits = fromCredits; ToCredits = toCredits;
        FromPrice = fromPrice; ToPrice = toPrice; FeePercent = feePercent; Status = Pending;
        CreatedByUserId = userId; CreatedByName = userName; CreatedAt = DateTime.UtcNow;
    }

    public Guid     Id           { get; private set; }
    public Guid     TenantId     { get; private set; }
    public string   FromModule   { get; private set; } = string.Empty;
    public string   ToModule     { get; private set; } = string.Empty;
    /// <summary>Credits taken out of the source module.</summary>
    public int      FromCredits  { get; private set; }
    /// <summary>Credits added to the destination module.</summary>
    public int      ToCredits    { get; private set; }
    /// <summary>The prices used, kept so the swap can be explained later even if prices change.</summary>
    public decimal  FromPrice    { get; private set; }
    public decimal  ToPrice      { get; private set; }
    public decimal  FeePercent   { get; private set; }
    public string   Status       { get; private set; } = Pending;
    public string?  Error        { get; private set; }
    public Guid?    CreatedByUserId { get; private set; }
    public string?  CreatedByName   { get; private set; }
    public DateTime CreatedAt    { get; private set; }
    public DateTime? CompletedAt { get; private set; }

    public void MarkRemoved() => Status = Removed;
    public void MarkDone() { Status = Done; CompletedAt = DateTime.UtcNow; Error = null; }
    public void MarkFailed(string error) { Status = Failed; Error = error.Length > 500 ? error[..500] : error; CompletedAt = DateTime.UtcNow; }
}
