namespace Softaxis.Library.Domain.Entities;

/// <summary>One library location. Every copy sits at a branch, and every loan is issued at one.</summary>
public sealed class LibraryBranch
{
    private LibraryBranch() { }

    public LibraryBranch(string name, string? code, string? address, string? phone, string? email)
    {
        Id = Guid.NewGuid();
        Set(name, code, address, phone, email);
    }

    public Guid      Id        { get; private set; }
    public string    Name      { get; private set; } = null!;
    public string?   Code      { get; private set; }
    public string?   Address   { get; private set; }
    public string?   Phone     { get; private set; }
    public string?   Email     { get; private set; }
    public bool      IsActive  { get; private set; } = true;
    public bool      IsDeleted { get; private set; }
    public DateTime  CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; private set; }

    public void Update(string name, string? code, string? address, string? phone, string? email, bool isActive)
    {
        Set(name, code, address, phone, email);
        IsActive  = isActive;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }

    private void Set(string name, string? code, string? address, string? phone, string? email)
    {
        Name    = name.Trim();
        Code    = Text.OrNull(code);
        Address = Text.OrNull(address);
        Phone   = Text.OrNull(phone);
        Email   = Text.OrNull(email);
    }
}

/// <summary>
/// A catalogue record: the work itself, not a physical item. The physical items are its
/// <see cref="BookCopy"/> rows, which is what members borrow.
/// </summary>
public sealed class BookTitle
{
    private BookTitle() { }

    public BookTitle(string title) { Id = Guid.NewGuid(); Title = title.Trim(); }

    public Guid      Id              { get; private set; }
    public string    Title           { get; private set; } = null!;
    public string?   Subtitle        { get; private set; }
    public string    Authors         { get; private set; } = string.Empty;
    public string?   Isbn            { get; private set; }
    public string?   Publisher       { get; private set; }
    public int?      PublicationYear { get; private set; }
    public string?   Edition         { get; private set; }
    public string?   Language        { get; private set; }
    public string?   Category        { get; private set; }
    /// <summary>book | journal | magazine | dvd | audio | reference | other.</summary>
    public string    MaterialType    { get; private set; } = "book";
    public string?   Description     { get; private set; }
    /// <summary>Charged to the member when a copy is reported lost. Zero = no automatic charge.</summary>
    public decimal   ReplacementCost { get; private set; }
    public bool      IsDeleted       { get; private set; }
    public DateTime  CreatedAt       { get; private set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt       { get; private set; }

    public void SetDetails(string title, string? subtitle, string? authors, string? isbn, string? publisher,
        int? publicationYear, string? edition, string? language, string? category, string? materialType,
        string? description, decimal replacementCost)
    {
        Title           = title.Trim();
        Subtitle        = Text.OrNull(subtitle);
        Authors         = authors?.Trim() ?? string.Empty;
        Isbn            = Text.OrNull(isbn);
        Publisher       = Text.OrNull(publisher);
        PublicationYear = publicationYear;
        Edition         = Text.OrNull(edition);
        Language        = Text.OrNull(language);
        Category        = Text.OrNull(category);
        MaterialType    = Text.OrNull(materialType)?.ToLowerInvariant() ?? "book";
        Description     = Text.OrNull(description);
        ReplacementCost = replacementCost < 0 ? 0 : replacementCost;
        UpdatedAt       = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

public static class CopyStatus
{
    public const string Available = "available";
    public const string OnLoan    = "on_loan";
    /// <summary>Held on the shelf for a member whose reservation has come up.</summary>
    public const string Reserved  = "reserved";
    /// <summary>On its way to another branch.</summary>
    public const string InTransit = "in_transit";
    public const string Lost      = "lost";
    public const string Damaged   = "damaged";
    public const string Withdrawn = "withdrawn";

    /// <summary>Statuses a librarian may set by hand. The rest are set by circulation.</summary>
    public static readonly string[] Manual = [Available, Lost, Damaged, Withdrawn];
}

/// <summary>One physical item, identified by its barcode (accession number).</summary>
public sealed class BookCopy
{
    private BookCopy() { }

    public BookCopy(Guid titleId, Guid branchId, string barcode, string? shelfLocation, decimal price, string? acquiredOn)
    {
        Id            = Guid.NewGuid();
        TitleId       = titleId;
        BranchId      = branchId;
        Barcode       = barcode.Trim();
        ShelfLocation = Text.OrNull(shelfLocation);
        Price         = price < 0 ? 0 : price;
        AcquiredOn    = Text.OrNull(acquiredOn);
    }

    public Guid      Id                { get; private set; }
    public Guid      TitleId           { get; private set; }
    /// <summary>Where the copy is now (or, while in transit, where it left from).</summary>
    public Guid      BranchId          { get; private set; }
    public string    Barcode           { get; private set; } = null!;
    public string?   ShelfLocation     { get; private set; }
    public string    Condition         { get; private set; } = "good";
    public string    Status            { get; private set; } = CopyStatus.Available;
    public Guid?     TransitToBranchId { get; private set; }
    public string?   AcquiredOn        { get; private set; }
    public decimal   Price             { get; private set; }
    public string?   Notes             { get; private set; }
    public bool      IsDeleted         { get; private set; }
    public DateTime  CreatedAt         { get; private set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt         { get; private set; }

    public void Update(string barcode, string? shelfLocation, string? condition, decimal price, string? acquiredOn, string? notes)
    {
        Barcode       = barcode.Trim();
        ShelfLocation = Text.OrNull(shelfLocation);
        Condition     = Text.OrNull(condition)?.ToLowerInvariant() ?? "good";
        Price         = price < 0 ? 0 : price;
        AcquiredOn    = Text.OrNull(acquiredOn);
        Notes         = Text.OrNull(notes);
        UpdatedAt     = DateTime.UtcNow;
    }

    public void SetStatus(string status) { Status = status; UpdatedAt = DateTime.UtcNow; }

    public void Issue() => SetStatus(CopyStatus.OnLoan);

    /// <summary>Back on a shelf at <paramref name="branchId"/> — the branch it was handed in at.</summary>
    public void ShelveAt(Guid branchId, bool damaged = false)
    {
        BranchId          = branchId;
        TransitToBranchId = null;
        if (damaged) Condition = "damaged";
        SetStatus(damaged ? CopyStatus.Damaged : CopyStatus.Available);
    }

    public void HoldForReservation() => SetStatus(CopyStatus.Reserved);

    public void SendTo(Guid branchId)
    {
        TransitToBranchId = branchId;
        SetStatus(CopyStatus.InTransit);
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

internal static class Text
{
    public static string? OrNull(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
