namespace Softaxis.Finance.Domain.Entities;

public sealed class BankAccount
{
    private BankAccount() { }

    public BankAccount(string accountName, string bankName, string accountNumber,
        string iban, string currency, string accountType)
    {
        Id               = Guid.NewGuid();
        AccountName      = accountName.Trim();
        BankName         = bankName.Trim();
        AccountNumber    = accountNumber.Trim();
        Iban             = iban.Trim().ToUpperInvariant();
        Currency         = currency.Trim().ToUpperInvariant();
        AccountType      = accountType; // current | savings
        Status           = "active";
        Balance          = 0m;
        AvailableBalance = 0m;
        LastSynced       = DateTime.UtcNow;
        CreatedAt        = DateTime.UtcNow;
    }

    public Guid      Id               { get; private set; }
    public string    AccountName      { get; private set; } = string.Empty;
    public string    BankName         { get; private set; } = string.Empty;
    public string    AccountNumber    { get; private set; } = string.Empty;
    public string    Iban             { get; private set; } = string.Empty;
    public string    Currency         { get; private set; } = "AED";
    public decimal   Balance          { get; private set; }
    public decimal   AvailableBalance { get; private set; }
    public string    Status           { get; private set; } = "active";
    public string    AccountType      { get; private set; } = "current";
    public DateTime  LastSynced       { get; private set; }
    public DateTime  CreatedAt        { get; private set; }
    public DateTime? UpdatedAt        { get; private set; }
    public bool      IsDeleted        { get; private set; }

    public ICollection<BankTransaction> Transactions { get; private set; } = new List<BankTransaction>();

    public void UpdateBalance(decimal balance, decimal available)
    {
        Balance          = balance;
        AvailableBalance = available;
        LastSynced       = DateTime.UtcNow;
        UpdatedAt        = DateTime.UtcNow;
    }

    public void SetStatus(string status) { Status = status; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

public sealed class BankTransaction
{
    private BankTransaction() { }

    public BankTransaction(Guid accountId, string date, string description,
        string reference, decimal amount, string type, string category)
    {
        Id          = Guid.NewGuid();
        AccountId   = accountId;
        Date        = date;
        Description = description.Trim();
        Reference   = reference.Trim();
        Amount      = Math.Abs(amount);
        Type        = type;    // credit | debit
        Category    = category;
        Reconciled  = false;
        Balance     = 0m;
        CreatedAt   = DateTime.UtcNow;
    }

    public Guid      Id          { get; private set; }
    public Guid      AccountId   { get; private set; }
    public string    Date        { get; private set; } = string.Empty;
    public string    Description { get; private set; } = string.Empty;
    public string    Reference   { get; private set; } = string.Empty;
    public decimal   Amount      { get; private set; }
    public string    Type        { get; private set; } = "debit";
    public string    Category    { get; private set; } = string.Empty;
    public bool      Reconciled  { get; private set; }
    public decimal   Balance     { get; private set; }
    public DateTime  CreatedAt   { get; private set; }

    public BankAccount? Account { get; private set; }

    public void Reconcile() { Reconciled = true; }
    public void SetBalance(decimal balance) { Balance = balance; }
}
