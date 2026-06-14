namespace Softaxis.Finance.Domain.Entities;

public sealed class Budget
{
    private Budget() { }

    public Budget(string name, string period, string? notes)
    {
        Id        = Guid.NewGuid();
        Name      = name.Trim();
        Period    = period;      // "yyyy-MM" or "yyyy" for annual
        Status    = "draft";     // lifecycle: draft → approved → active → closed
        Notes     = notes?.Trim();
        CreatedAt = DateTime.UtcNow;
    }

    public Guid      Id        { get; private set; }
    public string    Name      { get; private set; } = string.Empty;
    public string    Period    { get; private set; } = string.Empty;
    public string    Status    { get; private set; } = "draft";
    public string?   Notes     { get; private set; }
    public DateTime  CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }
    public bool      IsDeleted { get; private set; }

    public ICollection<BudgetLine> Lines { get; private set; } = new List<BudgetLine>();

    public decimal TotalBudgeted => Lines.Sum(l => l.BudgetedAmount);
    public decimal TotalActual   => Lines.Sum(l => l.ActualAmount);
    public decimal Variance      => TotalBudgeted - TotalActual;

    public void Update(string name, string period, string status, string? notes)
    {
        Name      = name.Trim();
        Period    = period;
        Status    = status;
        Notes     = notes?.Trim();
        UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }

    /// <summary>Valid lifecycle: draft → approved → active → closed. A closed budget can be reopened to active.</summary>
    public static readonly string[] Statuses = ["draft", "approved", "active", "closed"];

    public bool CanTransitionTo(string target) => (Status, target) switch
    {
        ("draft", "approved")    => true,
        ("approved", "active")   => true,
        ("approved", "draft")    => true,  // send back for edits
        ("active", "closed")     => true,
        ("closed", "active")     => true,  // reopen
        _ => false,
    };

    public void SetStatus(string status)
    {
        Status    = status;
        UpdatedAt = DateTime.UtcNow;
    }
}

public sealed class BudgetLine
{
    private BudgetLine() { }

    public BudgetLine(Guid budgetId, string category, string? accountName, decimal budgetedAmount)
    {
        Id              = Guid.NewGuid();
        BudgetId        = budgetId;
        Category        = category.Trim();
        AccountName     = accountName?.Trim();
        BudgetedAmount  = budgetedAmount;
        ActualAmount    = 0m;
    }

    public Guid    Id             { get; private set; }
    public Guid    BudgetId       { get; private set; }
    public string  Category       { get; private set; } = string.Empty;
    public string? AccountName    { get; private set; }
    public decimal BudgetedAmount { get; private set; }
    public decimal ActualAmount   { get; private set; }
    public decimal Variance       => BudgetedAmount - ActualAmount;

    public Budget? Budget { get; private set; }

    public void UpdateActual(decimal actual) { ActualAmount = actual; }
    public void Update(string category, string? accountName, decimal budgetedAmount)
    {
        Category      = category.Trim();
        AccountName   = accountName?.Trim();
        BudgetedAmount = budgetedAmount;
    }
}
