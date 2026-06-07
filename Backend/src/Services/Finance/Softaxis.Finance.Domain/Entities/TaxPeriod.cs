namespace Softaxis.Finance.Domain.Entities;

public sealed class TaxPeriod
{
    private TaxPeriod() { }

    public TaxPeriod(string period, string fromDate, string toDate, string dueDate)
    {
        Id        = Guid.NewGuid();
        Period    = period;    // e.g. "Q1-2026"
        FromDate  = fromDate;
        ToDate    = toDate;
        DueDate   = dueDate;
        Status    = "open";   // open | filed | paid | overdue
        OutputVat = 0m;
        InputVat  = 0m;
        CreatedAt = DateTime.UtcNow;
    }

    public Guid      Id         { get; private set; }
    public string    Period     { get; private set; } = string.Empty;
    public string    FromDate   { get; private set; } = string.Empty;
    public string    ToDate     { get; private set; } = string.Empty;
    public string    Status     { get; private set; } = "open";
    public decimal   OutputVat  { get; private set; }
    public decimal   InputVat   { get; private set; }
    public decimal   NetVat     => OutputVat - InputVat;
    public string    DueDate    { get; private set; } = string.Empty;
    public string?   FiledDate  { get; private set; }
    public string?   PaidDate   { get; private set; }
    public decimal?  Penalty    { get; private set; }
    public DateTime  CreatedAt  { get; private set; }
    public DateTime? UpdatedAt  { get; private set; }

    public ICollection<TaxTransaction> Transactions { get; private set; } = new List<TaxTransaction>();

    public void UpdateAmounts(decimal outputVat, decimal inputVat)
    {
        OutputVat = outputVat;
        InputVat  = inputVat;
        UpdatedAt = DateTime.UtcNow;
    }

    public void File(string filedDate)
    {
        Status    = "filed";
        FiledDate = filedDate;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkPaid(string paidDate)
    {
        Status    = "paid";
        PaidDate  = paidDate;
        UpdatedAt = DateTime.UtcNow;
    }
}

public sealed class TaxTransaction
{
    private TaxTransaction() { }

    public TaxTransaction(Guid periodId, string date, string type,
        string reference, decimal amount, decimal vatAmount, decimal vatRate, string description)
    {
        Id          = Guid.NewGuid();
        PeriodId    = periodId;
        Date        = date;
        Type        = type;        // sale | purchase
        Reference   = reference;
        Amount      = amount;
        VatAmount   = vatAmount;
        VatRate     = vatRate;
        Description = description.Trim();
        CreatedAt   = DateTime.UtcNow;
    }

    public Guid      Id          { get; private set; }
    public Guid      PeriodId    { get; private set; }
    public string    Date        { get; private set; } = string.Empty;
    public string    Type        { get; private set; } = "sale";
    public string    Reference   { get; private set; } = string.Empty;
    public decimal   Amount      { get; private set; }
    public decimal   VatAmount   { get; private set; }
    public decimal   VatRate     { get; private set; }
    public string    Description { get; private set; } = string.Empty;
    public DateTime  CreatedAt   { get; private set; }

    public TaxPeriod? Period { get; private set; }
}
