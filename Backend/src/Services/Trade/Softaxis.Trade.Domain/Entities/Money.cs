namespace Softaxis.Trade.Domain.Entities;

public static class CostType
{
    public const string Freight = "freight", Insurance = "insurance", CustomsDuty = "customs_duty",
        Clearing = "clearing", PortCharges = "port_charges", InlandTransport = "inland_transport",
        Demurrage = "demurrage", Inspection = "inspection", Other = "other";

    public static readonly string[] All =
        [Freight, Insurance, CustomsDuty, Clearing, PortCharges, InlandTransport, Demurrage, Inspection, Other];
}

/// <summary>How a cost is spread across the lines of a shipment.</summary>
public static class AllocationBasis
{
    public const string Value = "value", Weight = "weight", Volume = "volume", Quantity = "quantity";
    public static readonly string[] All = [Value, Weight, Volume, Quantity];
}

/// <summary>
/// A cost of getting the goods here (or there): freight, duty, clearing and so on. Amounts are in
/// the workspace currency — the one the books are kept in — so landed cost needs no conversion.
/// </summary>
public sealed class ShipmentCost
{
    private ShipmentCost() { }

    public ShipmentCost(Guid shipmentId, string type, string? description, decimal amount, string basis, string? vendorName,
        string? invoiceReference, DateOnly? paidOn)
    {
        Id = Guid.NewGuid();
        ShipmentId = shipmentId;
        Set(type, description, amount, basis, vendorName, invoiceReference, paidOn);
    }

    public Guid      Id               { get; private set; }
    public Guid      ShipmentId       { get; private set; }
    public string    Type             { get; private set; } = CostType.Other;
    public string?   Description      { get; private set; }
    public decimal   Amount           { get; private set; }
    public string    Basis            { get; private set; } = AllocationBasis.Value;
    public string?   VendorName       { get; private set; }
    public string?   InvoiceReference { get; private set; }
    public DateOnly? PaidOn           { get; private set; }
    public DateTime  CreatedAt        { get; private set; } = DateTime.UtcNow;

    public void Update(string type, string? description, decimal amount, string basis, string? vendorName,
        string? invoiceReference, DateOnly? paidOn) => Set(type, description, amount, basis, vendorName, invoiceReference, paidOn);

    private void Set(string type, string? description, decimal amount, string basis, string? vendorName,
        string? invoiceReference, DateOnly? paidOn)
    {
        Type             = type;
        Description      = Text.OrNull(description);
        Amount           = amount;
        Basis            = basis;
        VendorName       = Text.OrNull(vendorName);
        InvoiceReference = Text.OrNull(invoiceReference);
        PaidOn           = paidOn;
    }
}

public static class PaymentKind
{
    public const string Advance = "advance", Balance = "balance", LetterOfCredit = "lc", Transfer = "tt", Other = "other";
    public static readonly string[] All = [Advance, Balance, LetterOfCredit, Transfer, Other];
}

public static class PaymentStatus
{
    public const string Pending = "pending", Paid = "paid";
}

/// <summary>
/// Money for the goods themselves. On an import it is what we pay the supplier; on an export it is
/// what the buyer pays us. Amounts are in the shipment's invoice currency. A letter of credit
/// carries its number, issuing bank and expiry.
/// </summary>
public sealed class ShipmentPayment
{
    private ShipmentPayment() { }

    public ShipmentPayment(Guid shipmentId, string kind, decimal amount, DateOnly? dueDate, DateOnly? paidOn, string? reference,
        string? lcNumber, string? bankName, DateOnly? lcExpiry, string? notes)
    {
        Id = Guid.NewGuid();
        ShipmentId = shipmentId;
        Set(kind, amount, dueDate, paidOn, reference, lcNumber, bankName, lcExpiry, notes);
    }

    public Guid      Id         { get; private set; }
    public Guid      ShipmentId { get; private set; }
    public string    Kind       { get; private set; } = PaymentKind.Other;
    public decimal   Amount     { get; private set; }
    public DateOnly? DueDate    { get; private set; }
    public DateOnly? PaidOn     { get; private set; }
    public string    Status     { get; private set; } = PaymentStatus.Pending;
    public string?   Reference  { get; private set; }
    public string?   LcNumber   { get; private set; }
    public string?   BankName   { get; private set; }
    public DateOnly? LcExpiry   { get; private set; }
    public string?   Notes      { get; private set; }
    public DateTime  CreatedAt  { get; private set; } = DateTime.UtcNow;

    public void Update(string kind, decimal amount, DateOnly? dueDate, DateOnly? paidOn, string? reference,
        string? lcNumber, string? bankName, DateOnly? lcExpiry, string? notes) =>
        Set(kind, amount, dueDate, paidOn, reference, lcNumber, bankName, lcExpiry, notes);

    private void Set(string kind, decimal amount, DateOnly? dueDate, DateOnly? paidOn, string? reference,
        string? lcNumber, string? bankName, DateOnly? lcExpiry, string? notes)
    {
        Kind      = kind;
        Amount    = amount;
        DueDate   = dueDate;
        PaidOn    = paidOn;
        // A payment with a paid date IS paid; one without is pending. The date is the single source of truth.
        Status    = paidOn is null ? PaymentStatus.Pending : PaymentStatus.Paid;
        Reference = Text.OrNull(reference);
        LcNumber  = Text.OrNull(lcNumber);
        BankName  = Text.OrNull(bankName);
        LcExpiry  = lcExpiry;
        Notes     = Text.OrNull(notes);
    }
}
