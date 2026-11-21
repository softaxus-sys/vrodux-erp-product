using System.Text.Json;

namespace Softaxis.Finance.Domain.Entities;

/// <summary>
/// One share of an invoice's income that is to be put aside (e.g. "Charity 5%"). Stored on the
/// invoice and on the recurring template as JSON, so each document carries exactly what applied to it.
/// </summary>
public sealed record SetAsideDef(string Name, string Kind, decimal Value)
{
    public const string Percent = "percent";
    public const string Fixed   = "fixed";

    [System.Text.Json.Serialization.JsonIgnore]
    public bool IsValid => !string.IsNullOrWhiteSpace(Name) && Value > 0
        && (Kind == Percent ? Value <= 100 : Kind == Fixed);

    public static SetAsideDef Clean(SetAsideDef d) => new(
        d.Name.Trim(),
        string.Equals(d.Kind?.Trim(), Fixed, StringComparison.OrdinalIgnoreCase) ? Fixed : Percent,
        Math.Round(d.Value, 4));

    /// <summary>The amount for this share of one payment. Percent is of the amount BEFORE VAT
    /// (VAT is not income); fixed is the stated sum, spread across payments in proportion.</summary>
    public decimal AmountFor(decimal subTotal, decimal share) =>
        Math.Round((Kind == Percent ? subTotal * Value / 100m : Value) * share, 2, MidpointRounding.AwayFromZero);

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static string? Serialise(IEnumerable<SetAsideDef>? defs)
    {
        var list = (defs ?? []).Select(Clean).Where(d => d.IsValid).Take(10).ToList();
        return list.Count == 0 ? null : JsonSerializer.Serialize(list, Json);
    }

    public static IReadOnlyList<SetAsideDef> Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try { return JsonSerializer.Deserialize<List<SetAsideDef>>(json, Json) ?? []; }
        catch (JsonException) { return []; }
    }
}

/// <summary>A workspace's standing rule, e.g. "Charity — 5% of every invoice". Optional: a workspace
/// with no rules is completely unaffected by set-asides.</summary>
public sealed class SetAsideRule
{
    private SetAsideRule() { }

    public SetAsideRule(string name, string kind, decimal value, bool autoApply)
    {
        Id        = Guid.NewGuid();
        CreatedAt = DateTime.UtcNow;
        Update(name, kind, value, autoApply, true);
    }

    public Guid     Id         { get; private set; }
    public string   Name       { get; private set; } = string.Empty;
    public string   Kind       { get; private set; } = SetAsideDef.Percent;
    public decimal  Value      { get; private set; }
    /// <summary>Applied to every new invoice and every invoice a recurring template generates.</summary>
    public bool     AutoApply  { get; private set; } = true;
    public bool     IsActive   { get; private set; } = true;
    public DateTime CreatedAt  { get; private set; }
    public DateTime? UpdatedAt { get; private set; }
    public bool     IsDeleted  { get; private set; }

    public void Update(string name, string kind, decimal value, bool autoApply, bool isActive)
    {
        Name      = name.Trim();
        Kind      = string.Equals(kind?.Trim(), SetAsideDef.Fixed, StringComparison.OrdinalIgnoreCase)
                    ? SetAsideDef.Fixed : SetAsideDef.Percent;
        Value     = Math.Round(value, 4);
        AutoApply = autoApply;
        IsActive  = isActive;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }

    public SetAsideDef ToDef() => new(Name, Kind, Value);
}

/// <summary>
/// An amount owed to a set-aside (e.g. charity) because an invoice was paid. One row per rule per
/// payment, so a part-paid invoice owes in proportion. Unpaid until a payout covers it.
/// </summary>
public sealed class SetAsideEntry
{
    private SetAsideEntry() { }

    public SetAsideEntry(Guid eventId, string sourceKey, Guid invoiceId, string invoiceNumber, string name,
        decimal amount, decimal ledgerAmount, decimal baseLedgerAmount, string currencyCode, string accruedOn, Guid? journalEntryId)
    {
        Id               = Guid.NewGuid();
        EventId          = eventId;
        SourceKey        = sourceKey;
        InvoiceId        = invoiceId;
        InvoiceNumber    = invoiceNumber;
        Name             = name;
        Amount           = amount;
        LedgerAmount     = ledgerAmount;
        BaseLedgerAmount = baseLedgerAmount;
        CurrencyCode     = currencyCode;
        AccruedOn        = accruedOn;
        JournalEntryId   = journalEntryId;
        CreatedAt        = DateTime.UtcNow;
    }

    public Guid     Id               { get; private set; }
    /// <summary>Groups the rows created by one payment (one per rule).</summary>
    public Guid     EventId          { get; private set; }
    /// <summary>What caused it: "inv:{id}" (marked paid) or "rv:{voucherId}" (receipt voucher).</summary>
    public string   SourceKey        { get; private set; } = string.Empty;
    public Guid     InvoiceId        { get; private set; }
    public string   InvoiceNumber    { get; private set; } = string.Empty;
    public string   Name             { get; private set; } = string.Empty;
    /// <summary>In the invoice's currency.</summary>
    public decimal  Amount           { get; private set; }
    /// <summary>In the workspace currency — what the books and the dashboard use.</summary>
    public decimal  LedgerAmount     { get; private set; }
    /// <summary>The income this payment covered (before VAT), workspace currency. Used for "% of income".</summary>
    public decimal  BaseLedgerAmount { get; private set; }
    public string   CurrencyCode     { get; private set; } = string.Empty;
    public string   AccruedOn        { get; private set; } = string.Empty;
    public Guid?    JournalEntryId   { get; private set; }
    public Guid?    PayoutId         { get; private set; }
    public DateTime CreatedAt        { get; private set; }
    public bool     IsDeleted        { get; private set; }

    public bool IsPaid => PayoutId.HasValue;

    public void MarkPaid(Guid payoutId) => PayoutId = payoutId;
    public void Unpay() => PayoutId = null;
    public void Remove() => IsDeleted = true;
}

/// <summary>A payment of set-aside money out of the business (e.g. the monthly charity transfer).</summary>
public sealed class SetAsidePayout
{
    private SetAsidePayout() { }

    public SetAsidePayout(string paidOn, string fromAccountNumber, decimal total, string? reference, string? notes, Guid? journalEntryId)
    {
        Id                = Guid.NewGuid();
        PaidOn            = paidOn;
        FromAccountNumber = fromAccountNumber;
        Total             = total;
        Reference         = string.IsNullOrWhiteSpace(reference) ? null : reference.Trim();
        Notes             = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        JournalEntryId    = journalEntryId;
        CreatedAt         = DateTime.UtcNow;
    }

    public Guid     Id                { get; private set; }
    public string   PaidOn            { get; private set; } = string.Empty;
    public string   FromAccountNumber { get; private set; } = string.Empty;
    public decimal  Total             { get; private set; }
    public string?  Reference         { get; private set; }
    public string?  Notes             { get; private set; }
    public Guid?    JournalEntryId    { get; private set; }
    public DateTime CreatedAt         { get; private set; }
}

/// <summary>One row per workspace: remembers which month the reminder last went out for.</summary>
public sealed class SetAsideState
{
    private SetAsideState() { }
    public SetAsideState(string _) { Id = Guid.NewGuid(); }

    public Guid    Id                 { get; private set; }
    /// <summary>yyyy-MM of the last monthly reminder.</summary>
    public string? LastReminderMonth  { get; private set; }

    public void RecordReminder(string month) => LastReminderMonth = month;
}
