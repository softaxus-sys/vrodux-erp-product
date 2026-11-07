namespace Softaxis.Ecommerce.Domain.Entities;

public static class ChannelKinds
{
    public const string Shopify = "shopify";
}

public static class ChannelStatuses
{
    /// <summary>Credentials accepted at the last contact.</summary>
    public const string Connected = "connected";
    /// <summary>The last attempt failed. Retried automatically unless the cause is permanent (credentials refused).</summary>
    public const string Error = "error";
    /// <summary>Switched off by the user: nothing is pushed or imported.</summary>
    public const string Paused = "paused";
}

public static class ListingStatuses
{
    public const string Pending = "pending";
    /// <summary>Visible in the store.</summary>
    public const string Live    = "live";
    /// <summary>Exists in the store but hidden (unpublished).</summary>
    public const string Draft   = "draft";
    public const string Error   = "error";
}

public static class OrderStatuses
{
    /// <summary>Imported and stock taken for every line that could be matched.</summary>
    public const string Imported  = "imported";
    /// <summary>Imported, but at least one line matches no Inventory product, so its stock was not touched.</summary>
    public const string Unmatched = "unmatched";
    /// <summary>Cancelled in the store; stock put back.</summary>
    public const string Cancelled = "cancelled";
}

/// <summary>One connected online store (a Shopify shop today; WooCommerce later).</summary>
public sealed class SalesChannel
{
    private SalesChannel() { }

    public SalesChannel(string kind, string name, string shopDomain, string encryptedToken)
    {
        Id             = Guid.NewGuid();
        Kind           = kind;
        Name           = name.Trim();
        ShopDomain     = shopDomain.Trim().ToLowerInvariant();
        EncryptedToken = encryptedToken;
        Status         = ChannelStatuses.Connected;
        CreatedAt      = DateTime.UtcNow;
    }

    public Guid      Id             { get; private set; }
    public string    Kind           { get; private set; } = ChannelKinds.Shopify;
    public string    Name           { get; private set; } = "";
    public string    ShopDomain     { get; private set; } = "";

    /// <summary>The access token, encrypted at rest. Never returned by any query.</summary>
    public string    EncryptedToken { get; private set; } = "";

    public string    Status         { get; private set; } = ChannelStatuses.Connected;

    /// <summary>The store location whose stock level we set (Shopify keeps stock per location).</summary>
    public string?   ExternalLocationId { get; private set; }
    public string?   LocationName       { get; private set; }

    public string?   CurrencyCode   { get; private set; }

    /// <summary>Push Inventory stock quantities to the store.</summary>
    public bool      SyncStock      { get; private set; } = true;
    /// <summary>Push title, description, photos, prices and variants when they change in Inventory.</summary>
    public bool      SyncContent    { get; private set; } = true;
    /// <summary>Bring the store's orders in and take their stock out of Inventory.</summary>
    public bool      ImportOrders   { get; private set; } = true;

    public DateTime? LastSyncAt     { get; private set; }
    /// <summary>The newest order change already imported; the next import asks for anything after it.</summary>
    public DateTime? OrdersCursor   { get; private set; }
    public string?   LastError      { get; private set; }
    public int       ConsecutiveFailures { get; private set; }

    public DateTime  CreatedAt      { get; private set; }
    public DateTime? UpdatedAt      { get; private set; }
    public bool      IsDeleted      { get; private set; }

    public bool IsActive => Status != ChannelStatuses.Paused && !IsDeleted;

    public void Rename(string name) { Name = name.Trim(); Touch(); }

    public void Configure(bool syncStock, bool syncContent, bool importOrders)
    {
        SyncStock = syncStock; SyncContent = syncContent; ImportOrders = importOrders; Touch();
    }

    public void SetLocation(string? id, string? name) { ExternalLocationId = id; LocationName = name; Touch(); }
    public void SetCurrency(string? code) { CurrencyCode = code; Touch(); }

    public void ReplaceToken(string encrypted)
    {
        EncryptedToken = encrypted; Status = ChannelStatuses.Connected; LastError = null; ConsecutiveFailures = 0; Touch();
    }

    public void Pause()  { Status = ChannelStatuses.Paused; Touch(); }
    public void Resume() { Status = ChannelStatuses.Connected; LastError = null; ConsecutiveFailures = 0; Touch(); }

    public void RecordSuccess(DateTime now)
    {
        LastSyncAt = now; LastError = null; ConsecutiveFailures = 0;
        if (Status == ChannelStatuses.Error) Status = ChannelStatuses.Connected;
        Touch();
    }

    public void RecordFailure(string message)
    {
        LastError = message.Length > 1000 ? message[..1000] : message;
        ConsecutiveFailures++;
        if (Status != ChannelStatuses.Paused) Status = ChannelStatuses.Error;
        Touch();
    }

    public void AdvanceOrdersCursor(DateTime to) { if (OrdersCursor is null || to > OrdersCursor) OrdersCursor = to; }

    public void Delete() { IsDeleted = true; Touch(); }

    private void Touch() => UpdatedAt = DateTime.UtcNow;
}

/// <summary>An Inventory listing (template) published to one channel, and what the store knows it as.</summary>
public sealed class ChannelListing
{
    private ChannelListing() { }

    public ChannelListing(Guid channelId, Guid templateId, string templateName)
    {
        Id           = Guid.NewGuid();
        ChannelId    = channelId;
        TemplateId   = templateId;
        TemplateName = templateName;
        Status       = ListingStatuses.Pending;
        CreatedAt    = DateTime.UtcNow;
    }

    public Guid      Id                { get; private set; }
    public Guid      ChannelId         { get; private set; }
    public Guid      TemplateId        { get; private set; }
    public string    TemplateName      { get; private set; } = "";
    public string?   ExternalProductId { get; private set; }
    public string?   ExternalHandle    { get; private set; }
    public string    Status            { get; private set; } = ListingStatuses.Pending;

    /// <summary>Fingerprint of everything pushed except stock; a different one means the store is out of date.</summary>
    public string?   ContentHash       { get; private set; }

    /// <summary>Fingerprint of the photo set last uploaded; photos are only re-uploaded when it changes.</summary>
    public string?   ImagesHash        { get; private set; }

    /// <summary>Fingerprint of the content the store last REFUSED; the automatic sync does not retry the same content.</summary>
    public string?   FailedHash        { get; private set; }

    public string?   LastError         { get; private set; }
    public DateTime? LastSyncedAt      { get; private set; }
    public DateTime  CreatedAt         { get; private set; }
    public DateTime? UpdatedAt         { get; private set; }
    public bool      IsDeleted         { get; private set; }

    public List<ChannelListingVariant> Variants { get; private set; } = [];

    public void MarkSynced(string externalProductId, string? handle, string status, string contentHash, string imagesHash, string templateName)
    {
        ImagesHash = imagesHash;
        ExternalProductId = externalProductId; ExternalHandle = handle; Status = status;
        ContentHash = contentHash; TemplateName = templateName; LastError = null; FailedHash = null; LastSyncedAt = DateTime.UtcNow; UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>The store's product is gone (deleted there): forget it so the next push creates it again.</summary>
    public void ForgetStoreProduct()
    {
        ExternalProductId = null; ExternalHandle = null; ContentHash = null; ImagesHash = null; UpdatedAt = DateTime.UtcNow;
    }

    public void SetStatus(string status) { Status = status; UpdatedAt = DateTime.UtcNow; }

    public void MarkFailed(string message, string attemptedHash)
    {
        Status = ListingStatuses.Error;
        FailedHash = attemptedHash;
        LastError = message.Length > 1000 ? message[..1000] : message;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

/// <summary>One Inventory variant product and its counterpart in the store.</summary>
public sealed class ChannelListingVariant
{
    private ChannelListingVariant() { }

    public ChannelListingVariant(Guid listingId, Guid productId, string externalVariantId, string? externalInventoryItemId, string? sku)
    {
        Id = Guid.NewGuid(); ListingId = listingId; ProductId = productId;
        ExternalVariantId = externalVariantId; ExternalInventoryItemId = externalInventoryItemId; Sku = sku;
    }

    public Guid    Id                      { get; private set; }
    public Guid    ListingId               { get; private set; }
    /// <summary>The Inventory product (the variant) this row stands for.</summary>
    public Guid    ProductId               { get; private set; }
    public string  ExternalVariantId       { get; private set; } = "";
    public string? ExternalInventoryItemId { get; private set; }
    public string? Sku                     { get; private set; }

    /// <summary>The quantity last set in the store; null until one has been pushed. Compared with Inventory's to know what changed.</summary>
    public int?    LastPushedQuantity      { get; private set; }

    public void Update(string externalVariantId, string? externalInventoryItemId, string? sku)
    {
        ExternalVariantId = externalVariantId; ExternalInventoryItemId = externalInventoryItemId; Sku = sku;
    }

    public void RecordPushed(int quantity) => LastPushedQuantity = quantity;

    /// <summary>The store's own count moved by this much (an order it took); our record of what it holds moves with it.</summary>
    public void ShiftPushed(int delta) { if (LastPushedQuantity is { } q) LastPushedQuantity = q + delta; }
    public void ForgetPushed() => LastPushedQuantity = null;
}

/// <summary>An order placed in a channel's store, brought into Inventory's books.</summary>
public sealed class ChannelOrder
{
    private ChannelOrder() { }

    public ChannelOrder(Guid channelId, string externalId, string orderNumber)
    {
        Id = Guid.NewGuid(); ChannelId = channelId; ExternalId = externalId; OrderNumber = orderNumber;
        Status = OrderStatuses.Imported; ImportedAt = DateTime.UtcNow;
    }

    public Guid      Id             { get; private set; }
    public Guid      ChannelId      { get; private set; }
    public string    ExternalId     { get; private set; } = "";
    public string    OrderNumber    { get; private set; } = "";
    public string    Status         { get; private set; } = OrderStatuses.Imported;
    public string?   CustomerName   { get; private set; }
    public string?   Email          { get; private set; }
    public string?   FinancialStatus   { get; private set; }
    public string?   FulfillmentStatus { get; private set; }
    public decimal   Total          { get; private set; }
    public string?   CurrencyCode   { get; private set; }
    public DateTime  PlacedAt       { get; private set; }
    public DateTime  ImportedAt     { get; private set; }
    public DateTime? UpdatedAt      { get; private set; }
    public string?   Note           { get; private set; }
    public bool      IsDeleted      { get; private set; }

    public List<ChannelOrderLine> Lines { get; private set; } = [];

    public void SetDetails(string? customer, string? email, string? financial, string? fulfillment,
        decimal total, string? currency, DateTime placedAt)
    {
        CustomerName = customer; Email = email; FinancialStatus = financial; FulfillmentStatus = fulfillment;
        Total = total; CurrencyCode = currency; PlacedAt = placedAt; UpdatedAt = DateTime.UtcNow;
    }

    public void SetStatus(string status, string? note = null) { Status = status; Note = note; UpdatedAt = DateTime.UtcNow; }
}

public sealed class ChannelOrderLine
{
    private ChannelOrderLine() { }

    public ChannelOrderLine(Guid orderId, string title, string? sku, string? externalVariantId, decimal quantity, decimal unitPrice, Guid? productId)
    {
        Id = Guid.NewGuid(); OrderId = orderId; Title = title; Sku = sku; ExternalVariantId = externalVariantId;
        Quantity = quantity; UnitPrice = unitPrice; ProductId = productId;
    }

    public Guid     Id                { get; private set; }
    public Guid     OrderId           { get; private set; }
    public string   Title             { get; private set; } = "";
    public string?  Sku               { get; private set; }
    public string?  ExternalVariantId { get; private set; }
    public decimal  Quantity          { get; private set; }
    public decimal  UnitPrice         { get; private set; }
    /// <summary>The Inventory product this line was matched to; null when nothing matched.</summary>
    public Guid?    ProductId         { get; private set; }

    /// <summary>Stock has been taken out of Inventory for this line. Guards against taking it twice.</summary>
    public bool     StockTaken        { get; private set; }
    /// <summary>Stock was put back (the order was cancelled).</summary>
    public bool     StockReturned     { get; private set; }

    public void Match(Guid productId) => ProductId = productId;
    public void MarkTaken()    => StockTaken = true;
    public void MarkReturned() => StockReturned = true;
}
