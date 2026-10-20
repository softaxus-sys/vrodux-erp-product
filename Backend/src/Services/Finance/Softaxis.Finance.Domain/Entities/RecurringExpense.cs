namespace Softaxis.Finance.Domain.Entities;

/// <summary>
/// A template for a cost that repeats on a schedule — a storage subscription, rent, an insurance
/// premium. The daily job (and a manual trigger) materialises a real <see cref="Expense"/> whenever
/// <see cref="NextRunDate"/> is due.
///
/// <para><see cref="AutoPost"/> decides what happens to that expense. Off (the default) it is
/// created <c>pending</c> and goes through the normal approve → pay workflow. On, it is approved,
/// marked paid and posted to the ledger with nobody reviewing it — right for a fixed subscription,
/// wrong for a bill whose amount varies.</para>
/// </summary>
public sealed class RecurringExpense
{
    private RecurringExpense() { }

    public RecurringExpense(
        string templateName, string category, decimal amount, string? vendor,
        string? paymentMethod, string frequency, DateTime startDate, DateTime? endDate,
        bool autoPost, string? reference, string? notes)
    {
        Id            = Guid.NewGuid();
        TemplateName  = templateName.Trim();
        Category      = category.Trim();
        Amount        = amount;
        Vendor        = Clean(vendor);
        PaymentMethod = Clean(paymentMethod) ?? "bank";
        Frequency     = frequency;          // weekly | monthly | quarterly | yearly
        StartDate     = startDate.Date;
        EndDate       = endDate?.Date;
        NextRunDate   = startDate.Date;
        AnchorDay     = startDate.Day;
        AutoPost      = autoPost;
        Reference     = Clean(reference);
        Notes         = Clean(notes);
        IsActive      = true;
        CreatedAt     = DateTime.UtcNow;
    }

    public Guid      Id                { get; private set; }
    public string    TemplateName      { get; private set; } = string.Empty;
    public string    Category          { get; private set; } = string.Empty;
    public decimal   Amount            { get; private set; }
    public string?   Vendor            { get; private set; }
    /// <summary>cash | bank | card | cheque — decides which ledger account the payment credits.</summary>
    public string    PaymentMethod     { get; private set; } = "bank";
    public string    Frequency         { get; private set; } = "monthly";
    public DateTime  StartDate         { get; private set; }
    public DateTime? EndDate           { get; private set; }
    public DateTime  NextRunDate       { get; private set; }

    /// <summary>Day of the month the schedule is pinned to. Without it a template starting on the
    /// 31st would slide to the 28th after February and stay there for good.</summary>
    public int       AnchorDay         { get; private set; }

    /// <summary>The ledger account each generated expense debits (the cost). Null = chosen from the category.</summary>
    public Guid?     ExpenseAccountId  { get; private set; }
    /// <summary>The ledger account each generated expense credits (where the money comes from).
    /// Null = cash or the main bank account, from the payment method.</summary>
    public Guid?     PaymentAccountId  { get; private set; }

    public bool      AutoPost          { get; private set; }
    public string?   Reference         { get; private set; }
    public string?   Notes             { get; private set; }
    public bool      IsActive          { get; private set; }
    public DateTime? LastGeneratedDate { get; private set; }
    public int       GeneratedCount    { get; private set; }
    public DateTime  CreatedAt         { get; private set; }
    public DateTime? UpdatedAt         { get; private set; }
    public bool      IsDeleted         { get; private set; }

    public bool IsDue(DateTime asOf) =>
        IsActive && !IsDeleted && NextRunDate.Date <= asOf.Date
        && (EndDate is null || NextRunDate.Date <= EndDate.Value.Date);

    public static DateTime ComputeNext(DateTime from, string frequency, int anchorDay)
    {
        var months = frequency.ToLowerInvariant() switch
        {
            "weekly"    => 0,
            "quarterly" => 3,
            "yearly"    => 12,
            _           => 1,   // monthly default
        };
        if (months == 0) return from.AddDays(7);

        var target = new DateTime(from.Year, from.Month, 1).AddMonths(months);
        var day    = Math.Min(Math.Clamp(anchorDay, 1, 31), DateTime.DaysInMonth(target.Year, target.Month));
        return new DateTime(target.Year, target.Month, day);
    }

    /// <summary>Advance the schedule after an expense was generated for the current run date.</summary>
    public void AdvanceAfterGeneration()
    {
        LastGeneratedDate = NextRunDate;
        GeneratedCount++;
        NextRunDate = ComputeNext(NextRunDate, Frequency, AnchorDay);
        if (EndDate is not null && NextRunDate.Date > EndDate.Value.Date) IsActive = false;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Update(
        string templateName, string category, decimal amount, string? vendor,
        string? paymentMethod, string frequency, DateTime? nextRunDate, DateTime? endDate,
        bool autoPost, string? reference, string? notes)
    {
        TemplateName  = templateName.Trim();
        Category      = category.Trim();
        Amount        = amount;
        Vendor        = Clean(vendor);
        PaymentMethod = Clean(paymentMethod) ?? "bank";
        Frequency     = frequency;
        EndDate       = endDate?.Date;
        AutoPost      = autoPost;
        Reference     = Clean(reference);
        Notes         = Clean(notes);

        // Moving the next run re-pins the schedule: someone changing "the 1st" to "the 15th" means
        // every later month too, not just the next one.
        if (nextRunDate is { } next && next.Date != NextRunDate.Date)
        {
            NextRunDate = next.Date;
            AnchorDay   = next.Day;
        }

        UpdatedAt = DateTime.UtcNow;
    }

    public void SetPostingAccounts(Guid? expenseAccountId, Guid? paymentAccountId)
    {
        ExpenseAccountId = expenseAccountId;
        PaymentAccountId = paymentAccountId;
        UpdatedAt        = DateTime.UtcNow;
    }

    public void Pause()  { IsActive = false; UpdatedAt = DateTime.UtcNow; }
    public void Resume() { IsActive = true;  UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; IsActive = false; UpdatedAt = DateTime.UtcNow; }

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
