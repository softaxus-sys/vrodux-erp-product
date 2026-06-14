namespace Softaxis.Finance.Domain.Entities;

/// <summary>An accounting period (calendar month) that can be closed to prevent further postings.</summary>
public sealed class FiscalPeriod
{
    private FiscalPeriod() { }

    public FiscalPeriod(string periodCode)
    {
        Id         = Guid.NewGuid();
        PeriodCode = periodCode.Trim(); // "yyyy-MM"
        Status     = "open";
        CreatedAt  = DateTime.UtcNow;
    }

    public Guid      Id             { get; private set; }
    public string    PeriodCode     { get; private set; } = string.Empty; // "yyyy-MM"
    public string    Status         { get; private set; } = "open";       // "open" | "closed"
    public string?   ClosedByName   { get; private set; }
    public DateTime? ClosedAt       { get; private set; }
    public DateTime  CreatedAt      { get; private set; }
    public DateTime? UpdatedAt      { get; private set; }

    public void Close(string? closedByName)
    {
        if (Status == "closed")
            throw new InvalidOperationException($"Period {PeriodCode} is already closed.");

        Status       = "closed";
        ClosedByName = closedByName;
        ClosedAt     = DateTime.UtcNow;
        UpdatedAt    = DateTime.UtcNow;
    }

    public void Reopen()
    {
        if (Status == "open")
            throw new InvalidOperationException($"Period {PeriodCode} is already open.");

        Status       = "open";
        ClosedByName = null;
        ClosedAt     = null;
        UpdatedAt    = DateTime.UtcNow;
    }
}
