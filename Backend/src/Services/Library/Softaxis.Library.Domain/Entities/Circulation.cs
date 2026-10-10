namespace Softaxis.Library.Domain.Entities;

/// <summary>
/// The borrowing rules for a class of member (Standard, Student, Staff…): how many items, for how
/// long, how often they can be renewed and what a late day costs.
/// </summary>
public sealed class MembershipType
{
    private MembershipType() { }

    public MembershipType(string name, int maxLoans, int loanDays, int maxRenewals, decimal finePerDay,
        int maxReservations, decimal annualFee)
    {
        Id = Guid.NewGuid();
        Set(name, maxLoans, loanDays, maxRenewals, finePerDay, maxReservations, annualFee);
    }

    public Guid      Id              { get; private set; }
    public string    Name            { get; private set; } = null!;
    public int       MaxLoans        { get; private set; }
    public int       LoanDays        { get; private set; }
    public int       MaxRenewals     { get; private set; }
    public decimal   FinePerDay      { get; private set; }
    public int       MaxReservations { get; private set; }
    public decimal   AnnualFee       { get; private set; }
    public bool      IsActive        { get; private set; } = true;
    public bool      IsDeleted       { get; private set; }
    public DateTime  CreatedAt       { get; private set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt       { get; private set; }

    public void Update(string name, int maxLoans, int loanDays, int maxRenewals, decimal finePerDay,
        int maxReservations, decimal annualFee, bool isActive)
    {
        Set(name, maxLoans, loanDays, maxRenewals, finePerDay, maxReservations, annualFee);
        IsActive  = isActive;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }

    private void Set(string name, int maxLoans, int loanDays, int maxRenewals, decimal finePerDay,
        int maxReservations, decimal annualFee)
    {
        Name            = name.Trim();
        MaxLoans        = maxLoans;
        LoanDays        = loanDays;
        MaxRenewals     = maxRenewals;
        FinePerDay      = finePerDay;
        MaxReservations = maxReservations;
        AnnualFee       = annualFee;
    }
}

public static class MemberStatus
{
    public const string Active    = "active";
    public const string Suspended = "suspended";
}

public sealed class Member
{
    private Member() { }

    public Member(string memberNumber, string fullName, Guid membershipTypeId, string joinedOn)
    {
        Id               = Guid.NewGuid();
        MemberNumber     = memberNumber.Trim();
        FullName         = fullName.Trim();
        MembershipTypeId = membershipTypeId;
        JoinedOn         = joinedOn;
    }

    public Guid      Id               { get; private set; }
    public string    MemberNumber     { get; private set; } = null!;
    public string    FullName         { get; private set; } = null!;
    public string?   Email            { get; private set; }
    public string?   Phone            { get; private set; }
    public string?   Address          { get; private set; }
    /// <summary>National ID, student ID or staff number — whatever the library checks at the desk.</summary>
    public string?   IdNumber         { get; private set; }
    public Guid      MembershipTypeId { get; private set; }
    public Guid?     HomeBranchId     { get; private set; }
    /// <summary>yyyy-MM-dd. Calendar days carry no time zone.</summary>
    public string    JoinedOn         { get; private set; } = null!;
    /// <summary>yyyy-MM-dd, or null for a membership that does not lapse.</summary>
    public string?   ExpiresOn        { get; private set; }
    public string    Status           { get; private set; } = MemberStatus.Active;
    public string?   Notes            { get; private set; }
    public bool      IsDeleted        { get; private set; }
    public DateTime  CreatedAt        { get; private set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt        { get; private set; }

    public void SetDetails(string memberNumber, string fullName, string? email, string? phone, string? address,
        string? idNumber, Guid membershipTypeId, Guid? homeBranchId, string? expiresOn, string? status, string? notes)
    {
        MemberNumber     = memberNumber.Trim();
        FullName         = fullName.Trim();
        Email            = Text.OrNull(email);
        Phone            = Text.OrNull(phone);
        Address          = Text.OrNull(address);
        IdNumber         = Text.OrNull(idNumber);
        MembershipTypeId = membershipTypeId;
        HomeBranchId     = homeBranchId;
        ExpiresOn        = Text.OrNull(expiresOn);
        Status           = status == MemberStatus.Suspended ? MemberStatus.Suspended : MemberStatus.Active;
        Notes            = Text.OrNull(notes);
        UpdatedAt        = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

public static class LoanStatus
{
    public const string Active   = "active";
    public const string Returned = "returned";
    public const string Lost     = "lost";
}

/// <summary>One copy out with one member. "Overdue" is never stored — it is the due date against today.</summary>
public sealed class Loan
{
    private Loan() { }

    public Loan(Guid copyId, Guid titleId, Guid memberId, Guid branchId, string issuedOn, string dueDate, string? issuedByName)
    {
        Id           = Guid.NewGuid();
        CopyId       = copyId;
        TitleId      = titleId;
        MemberId     = memberId;
        BranchId     = branchId;
        IssuedOn     = issuedOn;
        DueDate      = dueDate;
        IssuedByName = Text.OrNull(issuedByName);
    }

    public Guid     Id             { get; private set; }
    public Guid     CopyId         { get; private set; }
    public Guid     TitleId        { get; private set; }
    public Guid     MemberId       { get; private set; }
    /// <summary>Branch the item was issued at.</summary>
    public Guid     BranchId       { get; private set; }
    public string   IssuedOn       { get; private set; } = null!;
    public string   DueDate        { get; private set; } = null!;
    public string?  ReturnedOn     { get; private set; }
    public Guid?    ReturnBranchId { get; private set; }
    public int      RenewalCount   { get; private set; }
    public string   Status         { get; private set; } = LoanStatus.Active;
    public string?  IssuedByName   { get; private set; }
    public string?  Notes          { get; private set; }
    public DateTime CreatedAt      { get; private set; } = DateTime.UtcNow;

    public void Renew(string newDueDate) { DueDate = newDueDate; RenewalCount++; }

    public void Return(string returnedOn, Guid returnBranchId, string? notes)
    {
        ReturnedOn     = returnedOn;
        ReturnBranchId = returnBranchId;
        Status         = LoanStatus.Returned;
        if (Text.OrNull(notes) is { } n) Notes = n;
    }

    public void MarkLost(string on) { ReturnedOn = on; Status = LoanStatus.Lost; }
}

public static class ReservationStatus
{
    public const string Waiting   = "waiting";
    /// <summary>A copy is being held at the pickup branch.</summary>
    public const string Ready     = "ready";
    public const string Fulfilled = "fulfilled";
    public const string Cancelled = "cancelled";
}

/// <summary>A member's place in the queue for a title, collected at a chosen branch.</summary>
public sealed class Reservation
{
    private Reservation() { }

    public Reservation(Guid titleId, Guid memberId, Guid pickupBranchId, string reservedOn)
    {
        Id             = Guid.NewGuid();
        TitleId        = titleId;
        MemberId       = memberId;
        PickupBranchId = pickupBranchId;
        ReservedOn     = reservedOn;
    }

    public Guid     Id             { get; private set; }
    public Guid     TitleId        { get; private set; }
    public Guid     MemberId       { get; private set; }
    public Guid     PickupBranchId { get; private set; }
    public string   Status         { get; private set; } = ReservationStatus.Waiting;
    public Guid?    CopyId         { get; private set; }
    public string   ReservedOn     { get; private set; } = null!;
    public string?  ReadyOn        { get; private set; }
    /// <summary>Last day the held copy is kept aside.</summary>
    public string?  HoldUntil      { get; private set; }
    public DateTime CreatedAt      { get; private set; } = DateTime.UtcNow;

    public void MarkReady(Guid copyId, string on, string holdUntil)
    {
        CopyId    = copyId;
        ReadyOn   = on;
        HoldUntil = holdUntil;
        Status    = ReservationStatus.Ready;
    }

    public void Fulfil() => Status = ReservationStatus.Fulfilled;
    public void Cancel() => Status = ReservationStatus.Cancelled;
}

public static class FineStatus
{
    public const string Unpaid = "unpaid";
    public const string Paid   = "paid";
    public const string Waived = "waived";
}

public sealed class Fine
{
    private Fine() { }

    public Fine(Guid memberId, Guid? loanId, string type, decimal amount, string? title, string? reason, string createdOn)
    {
        Id        = Guid.NewGuid();
        MemberId  = memberId;
        LoanId    = loanId;
        Type      = type;
        Amount    = amount;
        Title     = Text.OrNull(title);
        Reason    = Text.OrNull(reason);
        CreatedOn = createdOn;
    }

    public Guid     Id            { get; private set; }
    public Guid     MemberId      { get; private set; }
    public Guid?    LoanId        { get; private set; }
    /// <summary>overdue | lost | damage | membership | other.</summary>
    public string   Type          { get; private set; } = null!;
    public decimal  Amount        { get; private set; }
    public decimal  AmountPaid    { get; private set; }
    public string   Status        { get; private set; } = FineStatus.Unpaid;
    /// <summary>The book the fine is about, as it was named at the time.</summary>
    public string?  Title         { get; private set; }
    public string?  Reason        { get; private set; }
    public string   CreatedOn     { get; private set; } = null!;
    public string?  SettledOn     { get; private set; }
    public string?  PaymentMethod { get; private set; }
    public DateTime CreatedAt     { get; private set; } = DateTime.UtcNow;

    public decimal Balance => Status == FineStatus.Unpaid ? Amount - AmountPaid : 0;

    public void Pay(decimal amount, string? method, string on)
    {
        AmountPaid   += amount;
        PaymentMethod = Text.OrNull(method) ?? PaymentMethod;
        if (AmountPaid >= Amount) { Status = FineStatus.Paid; SettledOn = on; }
    }

    public void Waive(string? reason, string on)
    {
        Status    = FineStatus.Waived;
        SettledOn = on;
        if (Text.OrNull(reason) is { } r) Reason = Reason is null ? r : $"{Reason} — waived: {r}";
    }
}
