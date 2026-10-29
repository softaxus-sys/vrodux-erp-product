namespace Softaxis.Ecommerce.Domain.Entities;

// ═════════════════════════════════════════════════════════════════════════════
// The workspace's own online store (as opposed to Channels, which push to someone else's).
// Products are never copied: the store reads Inventory listings that are published online.
// ═════════════════════════════════════════════════════════════════════════════

public static class PaymentMethods
{
    public const string Cod    = "cod";
    public const string Bank   = "bank";
    public const string Stripe = "stripe";
    public const string PayPal = "paypal";

    public static readonly string[] All = [Cod, Bank, Stripe, PayPal];
}

public static class StoreOrderStatuses
{
    /// <summary>Card / PayPal order created, money not received yet. Stock is held; released if never paid.</summary>
    public const string AwaitingPayment = "awaiting_payment";
    /// <summary>Accepted. Ready to pack (paid, or cash on delivery / bank transfer).</summary>
    public const string Placed    = "placed";
    public const string Shipped   = "shipped";
    public const string Delivered = "delivered";
    public const string Cancelled = "cancelled";
}

public static class StorePaymentStatuses
{
    public const string Pending  = "pending";
    public const string Paid     = "paid";
    public const string Failed   = "failed";
    public const string Refunded = "refunded";
}

/// <summary>One per workspace. Slug and custom domain are unique across the platform: they are how a visitor finds the store.</summary>
public sealed class Store
{
    private Store() { }

    public Store(string name, string slug, string currencyCode)
    {
        Id = Guid.NewGuid();
        Name = name.Trim();
        Slug = slug;
        CurrencyCode = currencyCode;
        CreatedAt = DateTime.UtcNow;
    }

    public Guid     Id           { get; private set; }
    public string   Name         { get; set; } = "";
    /// <summary>Public address: <c>/shop/{slug}</c>, or <c>{slug}.&lt;store domain&gt;</c>.</summary>
    public string   Slug         { get; set; } = "";
    /// <summary>The shop's own domain, lower case, no scheme. Must be pointed at this platform by the owner.</summary>
    public string?  CustomDomain { get; set; }
    /// <summary>Customers can see the store only when this is on.</summary>
    public bool     IsPublished  { get; set; }
    public string   CurrencyCode { get; set; } = "USD";
    /// <summary>"en" or "ar" — the language of the storefront's own words (buttons, checkout).</summary>
    public string   Language     { get; set; } = "en";

    public string?  ContactEmail { get; set; }
    public string?  ContactPhone { get; set; }
    public string?  Address      { get; set; }
    /// <summary>Where a new-order email goes. Blank = the contact email.</summary>
    public string?  OrderNotifyEmail { get; set; }

    public Guid?    LogoAssetId    { get; set; }
    public Guid?    FaviconAssetId { get; set; }
    public string?  AnnouncementText { get; set; }
    public string?  SeoTitle         { get; set; }
    public string?  MetaDescription  { get; set; }

    /// <summary>Colours, fonts, shapes. See the storefront theme editor for the shape.</summary>
    public string   ThemeJson      { get; set; } = "{}";
    /// <summary>[{label, url}] — url is a path inside the store ("/collections/all") or an absolute link.</summary>
    public string   HeaderMenuJson { get; set; } = "[]";
    public string   FooterMenuJson { get; set; } = "[]";
    /// <summary>{instagram, facebook, x, tiktok, youtube, whatsapp}</summary>
    public string   SocialJson     { get; set; } = "{}";

    public decimal  TaxPercent      { get; set; }
    /// <summary>Listed prices already include the tax.</summary>
    public bool     PricesIncludeTax { get; set; } = true;
    public bool     AllowGuestCheckout { get; set; } = true;
    public bool     RequirePhone       { get; set; } = true;

    public bool     CodEnabled       { get; set; }
    public string?  CodInstructions  { get; set; }
    public bool     BankEnabled      { get; set; }
    public string?  BankDetails      { get; set; }

    public bool     StripeEnabled    { get; set; }
    public string?  StripeSecretEnc  { get; set; }
    public string?  StripeWebhookSecretEnc { get; set; }

    public bool     PayPalEnabled    { get; set; }
    public string?  PayPalClientId   { get; set; }
    public string?  PayPalSecretEnc  { get; set; }
    public bool     PayPalSandbox    { get; set; } = true;

    public DateTime  CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; set; }

    public void Touch() => UpdatedAt = DateTime.UtcNow;
}

/// <summary>A page built from sections. <c>home</c> is the front page; there is one.</summary>
public sealed class StorePage
{
    private StorePage() { }

    public StorePage(string slug, string title, string kind)
    {
        Id = Guid.NewGuid(); Slug = slug; Title = title.Trim(); Kind = kind; CreatedAt = DateTime.UtcNow;
    }

    public Guid     Id          { get; private set; }
    public string   Slug        { get; set; } = "";
    public string   Title       { get; set; } = "";
    /// <summary>home | page | policy</summary>
    public string   Kind        { get; set; } = "page";
    public bool     IsPublished { get; set; } = true;
    /// <summary>[{id, type, settings{...}}] — what the page builder edits.</summary>
    public string   SectionsJson { get; set; } = "[]";
    public string?  SeoTitle    { get; set; }
    public string?  MetaDescription { get; set; }
    public DateTime  CreatedAt  { get; private set; }
    public DateTime? UpdatedAt  { get; set; }
    public bool     IsDeleted   { get; set; }
    public void Touch() => UpdatedAt = DateTime.UtcNow;
}

/// <summary>An image or file the store uses (logo, banners, page pictures). Kept in the database; small by rule.</summary>
public sealed class StoreAsset
{
    private StoreAsset() { }
    public StoreAsset(string fileName, string contentType, byte[] data)
    {
        Id = Guid.NewGuid(); FileName = fileName; ContentType = contentType; Data = data; Size = data.Length; CreatedAt = DateTime.UtcNow;
    }
    public Guid     Id          { get; private set; }
    public string   FileName    { get; private set; } = "";
    public string   ContentType { get; private set; } = "";
    public byte[]   Data        { get; private set; } = [];
    public int      Size        { get; private set; }
    public DateTime CreatedAt   { get; private set; }
    public bool     IsDeleted   { get; set; }
}

/// <summary>A hand-picked or category-based group of listings.</summary>
public sealed class StoreCollection
{
    private StoreCollection() { }
    public StoreCollection(string slug, string name) { Id = Guid.NewGuid(); Slug = slug; Name = name.Trim(); CreatedAt = DateTime.UtcNow; }

    public Guid     Id          { get; private set; }
    public string   Slug        { get; set; } = "";
    public string   Name        { get; set; } = "";
    public string?  Description { get; set; }
    public Guid?    ImageAssetId { get; set; }
    /// <summary>Hand-picked Inventory listing ids (JSON array of guids). Used when <see cref="CategoryName"/> is blank.</summary>
    public string   TemplateIdsJson { get; set; } = "[]";
    /// <summary>When set, every published listing in this Inventory category belongs to the collection.</summary>
    public string?  CategoryName { get; set; }
    public bool     IsPublished { get; set; } = true;
    public int      SortOrder   { get; set; }
    public DateTime  CreatedAt  { get; private set; }
    public DateTime? UpdatedAt  { get; set; }
    public bool     IsDeleted   { get; set; }
    public void Touch() => UpdatedAt = DateTime.UtcNow;
}

/// <summary>Where the store delivers, and what that costs. The first zone that lists the customer's country wins.</summary>
public sealed class ShippingZone
{
    private ShippingZone() { }
    public ShippingZone(string name) { Id = Guid.NewGuid(); Name = name.Trim(); CreatedAt = DateTime.UtcNow; }

    public Guid     Id         { get; private set; }
    public string   Name       { get; set; } = "";
    /// <summary>JSON array of ISO country codes, or ["*"] for everywhere.</summary>
    public string   CountriesJson { get; set; } = "[\"*\"]";
    public decimal  FlatRate   { get; set; }
    /// <summary>Order subtotal at or above which delivery is free.</summary>
    public decimal? FreeOver   { get; set; }
    /// <summary>Smallest order the zone accepts.</summary>
    public decimal? MinOrder   { get; set; }
    public string?  EstimatedDays { get; set; }
    public bool     IsActive   { get; set; } = true;
    public int      SortOrder  { get; set; }
    public DateTime CreatedAt  { get; private set; }
    public bool     IsDeleted  { get; set; }
}

public static class DiscountKinds
{
    public const string Percent      = "percent";
    public const string Fixed        = "fixed";
    public const string FreeShipping = "free_shipping";
}

public sealed class DiscountCode
{
    private DiscountCode() { }
    public DiscountCode(string code, string kind, decimal value)
    {
        Id = Guid.NewGuid(); Code = code.Trim().ToUpperInvariant(); Kind = kind; Value = value; CreatedAt = DateTime.UtcNow;
    }

    public Guid      Id          { get; private set; }
    public string    Code        { get; set; } = "";
    public string    Kind        { get; set; } = DiscountKinds.Percent;
    public decimal   Value       { get; set; }
    public decimal?  MinSubtotal { get; set; }
    public int?      MaxUses     { get; set; }
    public int       UsedCount   { get; set; }
    public DateTime? StartsAt    { get; set; }
    public DateTime? EndsAt      { get; set; }
    public bool      IsActive    { get; set; } = true;
    public DateTime  CreatedAt   { get; private set; }
    public bool      IsDeleted   { get; set; }
}

/// <summary>A shopper's account. Not an Identity user: it consumes no plan seat and reaches nothing in the ERP.</summary>
public sealed class StoreCustomer
{
    private StoreCustomer() { }
    public StoreCustomer(string email, string passwordHash, string firstName, string lastName, string? phone)
    {
        Id = Guid.NewGuid(); Email = email.Trim().ToLowerInvariant(); PasswordHash = passwordHash;
        FirstName = firstName.Trim(); LastName = lastName.Trim(); Phone = phone?.Trim(); CreatedAt = DateTime.UtcNow;
    }

    public Guid     Id           { get; private set; }
    public string   Email        { get; private set; } = "";
    public string   PasswordHash { get; set; } = "";
    public string   FirstName    { get; set; } = "";
    public string   LastName     { get; set; } = "";
    public string?  Phone        { get; set; }
    public bool     AcceptsMarketing { get; set; }
    public string?  ResetTokenHash   { get; set; }
    public DateTime? ResetExpiresAt  { get; set; }
    public int      FailedAttempts   { get; set; }
    public DateTime? LockedUntil     { get; set; }
    public DateTime? LastSignInAt    { get; set; }
    public DateTime  CreatedAt   { get; private set; }
    public bool     IsDeleted    { get; set; }
    public string FullName => $"{FirstName} {LastName}".Trim();
}

public sealed class StoreCustomerAddress
{
    private StoreCustomerAddress() { }
    public StoreCustomerAddress(Guid customerId) { Id = Guid.NewGuid(); CustomerId = customerId; }

    public Guid    Id         { get; private set; }
    public Guid    CustomerId { get; private set; }
    public string  Name       { get; set; } = "";
    public string? Phone      { get; set; }
    public string  Line1      { get; set; } = "";
    public string? Line2      { get; set; }
    public string  City       { get; set; } = "";
    public string? Region     { get; set; }
    public string? PostalCode { get; set; }
    public string  Country    { get; set; } = "";
    public bool    IsDefault  { get; set; }
}

/// <summary>An order placed in the workspace's own store.</summary>
public sealed class StoreOrder
{
    private StoreOrder() { }

    public StoreOrder(int seq, string email, string currencyCode, string paymentMethod)
    {
        Id = Guid.NewGuid(); Seq = seq; Number = $"#{seq}"; Email = email.Trim().ToLowerInvariant();
        CurrencyCode = currencyCode; PaymentMethod = paymentMethod;
        // The order page is reachable by anyone holding this, so it must not be guessable.
        AccessToken = Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(16)).ToLowerInvariant();
        CreatedAt = DateTime.UtcNow;
    }

    public Guid     Id          { get; private set; }
    public int      Seq         { get; private set; }
    public string   Number      { get; private set; } = "";
    public string   AccessToken { get; private set; } = "";
    public Guid?    CustomerId  { get; set; }
    public string   Email       { get; private set; } = "";
    public string?  Phone       { get; set; }
    public string   CustomerName { get; set; } = "";

    public string  ShipName    { get; set; } = "";
    public string  ShipLine1   { get; set; } = "";
    public string? ShipLine2   { get; set; }
    public string  ShipCity    { get; set; } = "";
    public string? ShipRegion  { get; set; }
    public string? ShipPostal  { get; set; }
    public string  ShipCountry { get; set; } = "";

    public string?  ShippingMethod { get; set; }
    public decimal  Subtotal      { get; set; }
    public decimal  DiscountTotal { get; set; }
    public string?  DiscountCode  { get; set; }
    public decimal  ShippingTotal { get; set; }
    public decimal  TaxTotal      { get; set; }
    public decimal  Total         { get; set; }
    public string   CurrencyCode  { get; private set; } = "USD";

    public string   PaymentMethod { get; private set; } = PaymentMethods.Cod;
    public string   PaymentStatus { get; set; } = StorePaymentStatuses.Pending;
    public string   Status        { get; set; } = StoreOrderStatuses.Placed;
    public string?  StripeSessionId { get; set; }
    public string?  PayPalOrderId   { get; set; }
    public string?  PaymentReference { get; set; }
    public DateTime? PaidAt        { get; set; }
    /// <summary>An unpaid card order is cancelled and its stock released after this.</summary>
    public DateTime? ExpiresAt     { get; set; }

    public string?  TrackingCarrier { get; set; }
    public string?  TrackingNumber  { get; set; }
    public string?  TrackingUrl     { get; set; }
    public DateTime? ShippedAt   { get; set; }
    public DateTime? DeliveredAt { get; set; }
    public DateTime? CancelledAt { get; set; }
    public string?  CancelReason { get; set; }

    public string?  CustomerNote { get; set; }
    public string?  StaffNote    { get; set; }
    public bool     StockTaken   { get; set; }
    public bool     StockReturned { get; set; }
    public bool     MerchantNotified { get; set; }

    public DateTime  CreatedAt   { get; private set; }
    public DateTime? UpdatedAt   { get; set; }

    public List<StoreOrderLine>  Lines  { get; private set; } = [];
    public List<StoreOrderEvent> Events { get; private set; } = [];

    public bool IsOpen => Status is StoreOrderStatuses.AwaitingPayment or StoreOrderStatuses.Placed or StoreOrderStatuses.Shipped;

    public void AddEvent(string kind, string message, string? by = null) =>
        Events.Add(new StoreOrderEvent(Id, kind, message, by));

    public void Touch() => UpdatedAt = DateTime.UtcNow;
}

public sealed class StoreOrderLine
{
    private StoreOrderLine() { }
    public StoreOrderLine(Guid orderId, Guid productId, Guid? templateId, string title, string? variantName, string? sku,
        int quantity, decimal unitPrice, bool trackInventory)
    {
        Id = Guid.NewGuid(); OrderId = orderId; ProductId = productId; TemplateId = templateId; Title = title;
        VariantName = variantName; Sku = sku; Quantity = quantity; UnitPrice = unitPrice; TrackInventory = trackInventory;
    }

    public Guid     Id          { get; private set; }
    public Guid     OrderId     { get; private set; }
    /// <summary>The Inventory product (variant) bought.</summary>
    public Guid     ProductId   { get; private set; }
    public Guid?    TemplateId  { get; private set; }
    public string   Title       { get; private set; } = "";
    public string?  VariantName { get; private set; }
    public string?  Sku         { get; private set; }
    public int      Quantity    { get; private set; }
    public decimal  UnitPrice   { get; private set; }
    public bool     TrackInventory { get; private set; }
    /// <summary>Stock for this line has been taken from Inventory (and not yet returned).</summary>
    public bool     StockTaken  { get; set; }
    public decimal  LineTotal => UnitPrice * Quantity;
}

public sealed class StoreOrderEvent
{
    private StoreOrderEvent() { }
    public StoreOrderEvent(Guid orderId, string kind, string message, string? by)
    {
        Id = Guid.NewGuid(); OrderId = orderId; Kind = kind; Message = message.Length > 500 ? message[..500] : message; ByName = by; At = DateTime.UtcNow;
    }
    public Guid     Id      { get; private set; }
    public Guid     OrderId { get; private set; }
    public string   Kind    { get; private set; } = "";
    public string   Message { get; private set; } = "";
    public string?  ByName  { get; private set; }
    public DateTime At      { get; private set; }
}
