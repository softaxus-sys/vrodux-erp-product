namespace Softaxis.Trade.Domain.Entities;

public static class PartyKind
{
    public const string Supplier = "supplier", Buyer = "buyer", Forwarder = "forwarder",
        ClearingAgent = "clearing_agent", Carrier = "carrier", Bank = "bank", Other = "other";

    public static readonly string[] All = [Supplier, Buyer, Forwarder, ClearingAgent, Carrier, Bank, Other];
}

/// <summary>
/// Anyone a shipment involves: the overseas supplier or buyer, the forwarder, the clearing agent,
/// the carrier, the bank issuing a letter of credit. Kept inside Trade so the module works without
/// CRM, Purchase or Sales — those can be linked later, never required.
/// </summary>
public sealed class TradeParty
{
    private TradeParty() { }

    public TradeParty(string kind, string name, string? country, string? contactName, string? email,
        string? phone, string? address, string? taxNumber, string? notes)
    {
        Id = Guid.NewGuid();
        Set(kind, name, country, contactName, email, phone, address, taxNumber, notes);
    }

    public Guid      Id          { get; private set; }
    public string    Kind        { get; private set; } = PartyKind.Other;
    public string    Name        { get; private set; } = null!;
    public string?   Country     { get; private set; }
    public string?   ContactName { get; private set; }
    public string?   Email       { get; private set; }
    public string?   Phone       { get; private set; }
    public string?   Address     { get; private set; }
    public string?   TaxNumber   { get; private set; }
    public string?   Notes       { get; private set; }
    public bool      IsActive    { get; private set; } = true;
    public bool      IsDeleted   { get; private set; }
    public DateTime  CreatedAt   { get; private set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt   { get; private set; }

    public void Update(string kind, string name, string? country, string? contactName, string? email,
        string? phone, string? address, string? taxNumber, string? notes, bool isActive)
    {
        Set(kind, name, country, contactName, email, phone, address, taxNumber, notes);
        IsActive  = isActive;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }

    private void Set(string kind, string name, string? country, string? contactName, string? email,
        string? phone, string? address, string? taxNumber, string? notes)
    {
        Kind        = kind;
        Name        = name.Trim();
        Country     = Text.OrNull(country);
        ContactName = Text.OrNull(contactName);
        Email       = Text.OrNull(email);
        Phone       = Text.OrNull(phone);
        Address     = Text.OrNull(address);
        TaxNumber   = Text.OrNull(taxNumber);
        Notes       = Text.OrNull(notes);
    }
}

internal static class Text
{
    public static string? OrNull(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
