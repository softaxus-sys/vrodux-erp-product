namespace Softaxis.RealEstate.Domain.Entities;

public sealed class LeaseContract
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public string ContractNumber { get; private set; } = null!;
    public Guid PropertyId { get; private set; }
    public string PropertyName { get; private set; } = null!;
    public Guid UnitId { get; private set; }
    public string UnitNumber { get; private set; } = null!;
    public Guid TenantId { get; private set; }
    public string TenantName { get; private set; } = null!;
    public string StartDate { get; private set; } = null!;
    public string EndDate { get; private set; } = null!;
    public decimal AnnualRent { get; private set; }
    public int Cheques { get; private set; }
    public decimal SecurityDeposit { get; private set; }
    public string Status { get; private set; } = "active"; // active/expired/terminated/renewed
    public decimal TotalPaid { get; private set; }
    public string? EjariNumber { get; private set; }
    public string? Notes { get; private set; }

    /// <summary>monthly / quarterly / semi_annual / annual — drives how the schedule is cut.</summary>
    public string PaymentFrequency { get; private set; } = "annual";

    public List<RentInstallment> Installments { get; private set; } = [];

    public bool IsDeleted { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;

    // computed — not mapped
    public decimal Balance => AnnualRent - TotalPaid;

    private LeaseContract() { }

    public LeaseContract(Guid propertyId, string propertyName, Guid unitId, string unitNumber,
        Guid tenantId, string tenantName, string startDate, string endDate,
        decimal annualRent, int cheques, decimal securityDeposit, string? ejariNumber, string? notes,
        string paymentFrequency = "annual")
    {
        ContractNumber = $"LC-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..4].ToUpper()}";
        PropertyId = propertyId; PropertyName = propertyName; UnitId = unitId; UnitNumber = unitNumber;
        TenantId = tenantId; TenantName = tenantName; StartDate = startDate; EndDate = endDate;
        AnnualRent = annualRent; Cheques = cheques; SecurityDeposit = securityDeposit;
        EjariNumber = ejariNumber; Notes = notes;
        PaymentFrequency = NormalizeFrequency(paymentFrequency);
    }

    // Cheques is NOT a parameter: it is the installment count, owned by GenerateSchedule.
    // Letting an edit set it by hand would let it disagree with the actual schedule.
    public void Update(string startDate, string endDate, decimal annualRent,
        decimal securityDeposit, string? ejariNumber, string? notes, string? paymentFrequency)
    {
        StartDate = startDate; EndDate = endDate; AnnualRent = annualRent;
        SecurityDeposit = securityDeposit; EjariNumber = ejariNumber; Notes = notes;
        PaymentFrequency = NormalizeFrequency(paymentFrequency);
        UpdatedAt = DateTime.UtcNow;
    }

    // ── Schedule ─────────────────────────────────────────────────────────────

    public static int InstallmentsPerYear(string frequency) => NormalizeFrequency(frequency) switch
    {
        "monthly"     => 12,
        "quarterly"   => 4,
        "semi_annual" => 2,
        _             => 1,
    };

    public static string NormalizeFrequency(string? f)
    {
        var v = (f ?? string.Empty).Trim().ToLowerInvariant();
        return v is "monthly" or "quarterly" or "semi_annual" or "annual" ? v : "annual";
    }

    /// <summary>
    /// Cuts the rent into dated installments across the lease term.
    ///
    /// Rounds to 2dp and puts the remainder on the LAST installment, so the schedule sums to the
    /// rent exactly — a naive divide leaves 120,000/12 fine but 100,000/12 short by 0.04, which
    /// then shows as a permanent outstanding balance nobody can clear.
    ///
    /// Refuses to rebuild once any money has been recorded: regenerating would silently discard
    /// payments already taken against the old rows.
    /// </summary>
    public bool GenerateSchedule(bool replaceExisting = false)
    {
        var live = Installments.Where(i => !i.IsDeleted).ToList();
        if (live.Count > 0)
        {
            if (!replaceExisting) return false;
            if (live.Any(i => i.AmountPaid > 0 || i.Status == "waived")) return false;
            foreach (var i in live) i.Delete();
        }

        if (!DateTime.TryParse(StartDate, out var start)) return false;

        var perYear    = InstallmentsPerYear(PaymentFrequency);
        var monthStep  = 12 / perYear;
        var termMonths = TermMonths(start);
        var count      = Math.Max(1, (int)Math.Ceiling(termMonths / (double)monthStep));

        // AnnualRent is the rate for a YEAR; a term shorter or longer than 12 months owes pro rata.
        var total     = Math.Round(AnnualRent * (termMonths / 12m), 2, MidpointRounding.AwayFromZero);
        var each      = Math.Round(total / count, 2, MidpointRounding.AwayFromZero);
        var allocated = 0m;

        for (var n = 1; n <= count; n++)
        {
            var amount = n == count ? total - allocated : each;
            allocated += amount;

            Installments.Add(new RentInstallment(
                Id, n, start.AddMonths((n - 1) * monthStep).ToString("yyyy-MM-dd"), amount));
        }

        Cheques = count;
        UpdatedAt = DateTime.UtcNow;
        return true;
    }

    private int TermMonths(DateTime start)
    {
        if (!DateTime.TryParse(EndDate, out var end) || end <= start) return 12;
        var months = ((end.Year - start.Year) * 12) + end.Month - start.Month;
        if (end.Day >= start.Day) months += 1;      // 01 Jan → 31 Dec is a 12-month term, not 11
        return Math.Max(1, months);
    }

    /// <summary>
    /// Applies rent taken up front at signing, filling installments in order until it runs out.
    ///
    /// It cascades rather than paying only the first: an advance is very often "first and last
    /// month" or a full year's cheques handed over on day one, and splitting that by hand across
    /// twelve rows is exactly the kind of chore that gets skipped — leaving a tenant who has
    /// already paid being chased for it.
    ///
    /// Returns how much was actually applied, which is less than <paramref name="amount"/> only if
    /// the advance exceeds the whole schedule.
    /// </summary>
    public decimal ApplyAdvancePayment(decimal amount, string paidDate, string? method, string? reference)
    {
        if (amount <= 0) return 0m;

        var remaining = amount;

        foreach (var i in Installments.Where(x => !x.IsDeleted && !x.IsSettled)
                                      .OrderBy(x => x.InstallmentNumber))
        {
            if (remaining <= 0.005m) break;
            var take = Math.Min(remaining, i.Balance);
            i.RecordPayment(take, paidDate, method, reference, "Advance rent received at signing.");
            remaining -= take;
        }

        RecalculateTotals();
        return amount - remaining;
    }

    /// <summary>Total across the live schedule — what an advance can be measured against.</summary>
    public decimal ScheduledTotal =>
        Installments.Where(i => !i.IsDeleted).Sum(i => i.Amount);

    /// <summary>Single source of truth for TotalPaid once a schedule exists.</summary>
    public void RecalculateTotals()
    {
        var live = Installments.Where(i => !i.IsDeleted).ToList();
        if (live.Count == 0) return;
        TotalPaid = live.Sum(i => i.AmountPaid);
        UpdatedAt = DateTime.UtcNow;
    }

    public RentInstallment? NextDue(string today) =>
        Installments.Where(i => !i.IsDeleted && !i.IsSettled)
                    .OrderBy(i => i.DueDate, StringComparer.Ordinal)
                    .FirstOrDefault(i => string.CompareOrdinal(i.DueDate, today) >= 0);

    public void RecordPayment(decimal amount) { TotalPaid += amount; UpdatedAt = DateTime.UtcNow; }
    public void Terminate() { Status = "terminated"; UpdatedAt = DateTime.UtcNow; }
    public void Expire() { Status = "expired"; UpdatedAt = DateTime.UtcNow; }
    public void Renew() { Status = "renewed"; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}
