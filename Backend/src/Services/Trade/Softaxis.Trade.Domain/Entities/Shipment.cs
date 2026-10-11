namespace Softaxis.Trade.Domain.Entities;

public static class ShipmentDirection { public const string Import = "import", Export = "export"; }

public static class ShipmentMode { public static readonly string[] All = ["sea", "air", "road", "rail", "courier"]; }

public static class ShipmentStatus
{
    public const string Booked = "booked", InTransit = "in_transit", Arrived = "arrived",
        Customs = "customs", Cleared = "cleared", Delivered = "delivered", Closed = "closed",
        Cancelled = "cancelled";

    /// <summary>The normal journey, in order. A shipment only moves forward through it.</summary>
    public static readonly string[] Journey = [Booked, InTransit, Arrived, Customs, Cleared, Delivered, Closed];

    public static bool IsOpen(string status) => status is not (Delivered or Closed or Cancelled);

    /// <summary>Whether <paramref name="to"/> is a legal next status from <paramref name="from"/>.</summary>
    public static bool CanMove(string from, string to)
    {
        if (from == to || from is Closed or Cancelled) return false;
        if (to == Cancelled) return from is Booked or InTransit or Arrived or Customs;   // not once cleared or delivered
        var a = Array.IndexOf(Journey, from);
        var b = Array.IndexOf(Journey, to);
        return a >= 0 && b > a;
    }
}

/// <summary>
/// One consignment, inbound or outbound: what is moving, how, between which ports, under which
/// terms. The goods are in <see cref="Items"/>, the boxes in <see cref="Containers"/>, what it costs
/// in <see cref="Costs"/> (which become the landed cost) and what is paid or received against it in
/// <see cref="Payments"/>. Documents hang off it separately because they carry file content.
/// </summary>
public sealed class Shipment
{
    private readonly List<ShipmentItem>      _items      = [];
    private readonly List<ShipmentContainer> _containers = [];
    private readonly List<ShipmentMilestone> _milestones = [];
    private readonly List<ShipmentCost>      _costs      = [];
    private readonly List<ShipmentPayment>   _payments   = [];

    private Shipment() { }

    public Shipment(string direction)
    {
        Id             = Guid.NewGuid();
        Direction      = direction;
        ShipmentNumber = $"SH-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..6].ToUpperInvariant()}";
    }

    public Guid      Id             { get; private set; }
    public string    ShipmentNumber { get; private set; } = null!;
    public string    Direction      { get; private set; } = ShipmentDirection.Import;
    public string    Status         { get; private set; } = ShipmentStatus.Booked;
    public string    Mode           { get; private set; } = "sea";

    /// <summary>The overseas supplier (import) or buyer (export).</summary>
    public Guid?     PartnerId      { get; private set; }
    public Guid?     ForwarderId    { get; private set; }
    public Guid?     AgentId        { get; private set; }

    /// <summary>The purchase or sales order this shipment fulfils. Free text; no other module is required.</summary>
    public string?   OrderReference { get; private set; }

    /// <summary>Optional link to a Purchase ("purchase") or Sales ("sales") order. The number lives in OrderReference.</summary>
    public string?   LinkedOrderType { get; private set; }
    public Guid?     LinkedOrderId   { get; private set; }
    public string?   Incoterm       { get; private set; }
    public string?   BlNumber       { get; private set; }
    public string?   CarrierName    { get; private set; }
    public string?   VesselOrFlight { get; private set; }

    public string?   OriginCountry      { get; private set; }
    public string?   OriginPort         { get; private set; }
    public string?   DestinationCountry { get; private set; }
    public string?   DestinationPort    { get; private set; }

    public DateOnly? Etd            { get; private set; }
    public DateOnly? Eta            { get; private set; }
    public DateOnly? DepartedOn     { get; private set; }
    public DateOnly? ArrivedOn      { get; private set; }
    public DateOnly? ClearedOn      { get; private set; }
    public DateOnly? DeliveredOn    { get; private set; }

    /// <summary>Days the carrier allows at the port before demurrage starts (counted from arrival).</summary>
    public int?      FreeDays       { get; private set; }

    /// <summary>Currency the goods are invoiced in, and its rate into the workspace currency.</summary>
    public string    Currency       { get; private set; } = "USD";
    public decimal   ExchangeRate   { get; private set; } = 1m;

    public string?   Notes          { get; private set; }
    public bool      IsDeleted      { get; private set; }
    public DateTime  CreatedAt      { get; private set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt      { get; private set; }

    public IReadOnlyList<ShipmentItem>      Items      => _items;
    public IReadOnlyList<ShipmentContainer> Containers => _containers;
    public IReadOnlyList<ShipmentMilestone> Milestones => _milestones;
    public IReadOnlyList<ShipmentCost>      Costs      => _costs;
    public IReadOnlyList<ShipmentPayment>   Payments   => _payments;

    /// <summary>Value of the goods in the invoice currency.</summary>
    public decimal GoodsValue => _items.Sum(i => i.LineValue);

    public void SetDetails(string mode, Guid? partnerId, Guid? forwarderId, Guid? agentId, string? orderReference,
        string? incoterm, string? blNumber, string? carrierName, string? vesselOrFlight,
        string? originCountry, string? originPort, string? destinationCountry, string? destinationPort,
        DateOnly? etd, DateOnly? eta, int? freeDays, string currency, decimal exchangeRate, string? notes,
        string? linkedOrderType = null, Guid? linkedOrderId = null)
    {
        Mode               = mode;
        PartnerId          = partnerId;
        ForwarderId        = forwarderId;
        AgentId            = agentId;
        OrderReference     = Text.OrNull(orderReference);
        // A link needs both halves; a half-filled one is dropped rather than kept as a dangling id.
        LinkedOrderType    = linkedOrderId is null ? null : Text.OrNull(linkedOrderType);
        LinkedOrderId      = LinkedOrderType is null ? null : linkedOrderId;
        Incoterm           = Text.OrNull(incoterm)?.ToUpperInvariant();
        BlNumber           = Text.OrNull(blNumber);
        CarrierName        = Text.OrNull(carrierName);
        VesselOrFlight     = Text.OrNull(vesselOrFlight);
        OriginCountry      = Text.OrNull(originCountry);
        OriginPort         = Text.OrNull(originPort);
        DestinationCountry = Text.OrNull(destinationCountry);
        DestinationPort    = Text.OrNull(destinationPort);
        Etd                = etd;
        Eta                = eta;
        FreeDays           = freeDays;
        Currency           = currency.Trim().ToUpperInvariant();
        ExchangeRate       = exchangeRate;
        Notes              = Text.OrNull(notes);
        UpdatedAt          = DateTime.UtcNow;
    }

    public void ReplaceItems(IEnumerable<ShipmentItem> items)
    {
        _items.Clear();
        var n = 0;
        foreach (var i in items) { i.SetPosition(++n); _items.Add(i); }
        UpdatedAt = DateTime.UtcNow;
    }

    public void ReplaceContainers(IEnumerable<ShipmentContainer> containers)
    {
        _containers.Clear();
        _containers.AddRange(containers);
        UpdatedAt = DateTime.UtcNow;
    }

    public void RemoveCost(ShipmentCost cost)    { _costs.Remove(cost); UpdatedAt = DateTime.UtcNow; }
    public void RemovePayment(ShipmentPayment p) { _payments.Remove(p); UpdatedAt = DateTime.UtcNow; }

    /// <summary>Moves to a later status and records the date it happened on.</summary>
    public bool MoveTo(string status, DateOnly on, string? note, string? by)
    {
        if (!ShipmentStatus.CanMove(Status, status)) return false;

        Status = status;
        switch (status)
        {
            case ShipmentStatus.InTransit: DepartedOn  = on; break;
            case ShipmentStatus.Arrived:   ArrivedOn   = on; break;
            case ShipmentStatus.Cleared:   ClearedOn   = on; break;
            case ShipmentStatus.Delivered: DeliveredOn = on; break;
        }
        _milestones.Add(new ShipmentMilestone(status, on, note, by));
        UpdatedAt = DateTime.UtcNow;
        return true;
    }

    public void LogCreated(DateOnly on, string? by) => _milestones.Add(new ShipmentMilestone(ShipmentStatus.Booked, on, null, by));

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }

    /// <summary>
    /// The last day the cargo may sit at the port before demurrage starts: arrival + free days.
    /// Null when it has not arrived or the carrier gave no free days.
    /// </summary>
    public DateOnly? FreeTimeEnds => ArrivedOn is { } a && FreeDays is { } d ? a.AddDays(d) : null;
}

public sealed class ShipmentItem
{
    private ShipmentItem() { }

    public ShipmentItem(string description, string? hsCode, string? originCountry, decimal quantity, string unit,
        decimal unitPrice, decimal? weightKg, decimal? volumeCbm, int? packages, Guid? productId, string? sku)
    {
        Id            = Guid.NewGuid();
        Description   = description.Trim();
        HsCode        = Text.OrNull(hsCode);
        OriginCountry = Text.OrNull(originCountry);
        Quantity      = quantity;
        Unit          = string.IsNullOrWhiteSpace(unit) ? "pcs" : unit.Trim();
        UnitPrice     = unitPrice;
        WeightKg      = weightKg;
        VolumeCbm     = volumeCbm;
        Packages      = packages;
        ProductId     = productId;
        Sku           = Text.OrNull(sku);
    }

    public Guid     Id            { get; private set; }
    public Guid     ShipmentId    { get; private set; }
    public int      Position      { get; private set; }
    public string   Description   { get; private set; } = null!;
    public string?  HsCode        { get; private set; }
    public string?  OriginCountry { get; private set; }
    public decimal  Quantity      { get; private set; }
    public string   Unit          { get; private set; } = "pcs";
    public decimal  UnitPrice     { get; private set; }

    /// <summary>Total weight of this line, not per unit. Used to share costs by weight.</summary>
    public decimal? WeightKg      { get; private set; }
    public decimal? VolumeCbm     { get; private set; }
    public int?     Packages      { get; private set; }

    /// <summary>Optional link to an Inventory product. Never required, never checked here.</summary>
    public Guid?    ProductId     { get; private set; }
    public string?  Sku           { get; private set; }

    public decimal  LineValue     => Math.Round(Quantity * UnitPrice, 2);

    internal void SetPosition(int n) => Position = n;
}

public sealed class ShipmentContainer
{
    private ShipmentContainer() { }

    public ShipmentContainer(string number, string? type, string? sealNumber, decimal? grossWeightKg)
    {
        Id            = Guid.NewGuid();
        Number        = number.Trim().ToUpperInvariant();
        Type          = Text.OrNull(type);
        SealNumber    = Text.OrNull(sealNumber);
        GrossWeightKg = grossWeightKg;
    }

    public Guid     Id            { get; private set; }
    public Guid     ShipmentId    { get; private set; }
    public string   Number        { get; private set; } = null!;
    public string?  Type          { get; private set; }
    public string?  SealNumber    { get; private set; }
    public decimal? GrossWeightKg { get; private set; }
}

/// <summary>One line of the shipment's history: a status reached, when, and who recorded it.</summary>
public sealed class ShipmentMilestone
{
    private ShipmentMilestone() { }

    public ShipmentMilestone(string status, DateOnly on, string? note, string? by)
    {
        Id         = Guid.NewGuid();
        Status     = status;
        OccurredOn = on;
        Note       = Text.OrNull(note);
        RecordedBy = Text.OrNull(by);
    }

    public Guid      Id         { get; private set; }
    public Guid      ShipmentId { get; private set; }
    public string    Status     { get; private set; } = null!;
    public DateOnly  OccurredOn { get; private set; }
    public string?   Note       { get; private set; }
    public string?   RecordedBy { get; private set; }
    public DateTime  RecordedAt { get; private set; } = DateTime.UtcNow;
}
