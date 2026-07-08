namespace Softaxis.VisaServices.Domain.Entities;

/// <summary>
/// A person on a visa case. One case carries a primary applicant and optionally
/// dependents (spouse/child/parent). Scalar FK to the case (codebase convention —
/// no navigation properties).
/// </summary>
public sealed class Applicant
{
    private Applicant() { }

    public Applicant(Guid visaCaseId, string firstName, string lastName, string nationality,
        string passportNumber, string? passportExpiry, string? dateOfBirth,
        string? emiratesId, string? uidNumber, string relationship)
    {
        Id             = Guid.NewGuid();
        VisaCaseId     = visaCaseId;
        FirstName      = firstName.Trim();
        LastName       = lastName.Trim();
        Nationality    = nationality.Trim();
        PassportNumber = passportNumber.Trim().ToUpperInvariant();
        PassportExpiry = passportExpiry;
        DateOfBirth    = dateOfBirth;
        EmiratesId     = emiratesId?.Trim();
        UidNumber      = uidNumber?.Trim();
        Relationship   = string.IsNullOrWhiteSpace(relationship) ? "primary" : relationship;
        CreatedAt      = DateTime.UtcNow;
    }

    public Guid      Id             { get; private set; }
    public Guid      VisaCaseId     { get; private set; }
    public string    FirstName      { get; private set; } = string.Empty;
    public string    LastName       { get; private set; } = string.Empty;
    public string    FullName       => $"{FirstName} {LastName}".Trim();
    public string    Nationality    { get; private set; } = string.Empty;
    public string    PassportNumber { get; private set; } = string.Empty;
    public string?   PassportExpiry { get; private set; }
    public string?   DateOfBirth    { get; private set; }
    public string?   EmiratesId     { get; private set; }
    public string?   UidNumber      { get; private set; }
    // primary | spouse | child | parent | other
    public string    Relationship   { get; private set; } = "primary";
    public DateTime  CreatedAt      { get; private set; }
    public DateTime? UpdatedAt      { get; private set; }

    public void Update(string firstName, string lastName, string nationality, string passportNumber,
        string? passportExpiry, string? dateOfBirth, string? emiratesId, string? uidNumber, string relationship)
    {
        FirstName = firstName.Trim(); LastName = lastName.Trim(); Nationality = nationality.Trim();
        PassportNumber = passportNumber.Trim().ToUpperInvariant(); PassportExpiry = passportExpiry;
        DateOfBirth = dateOfBirth; EmiratesId = emiratesId?.Trim(); UidNumber = uidNumber?.Trim();
        Relationship = relationship; UpdatedAt = DateTime.UtcNow;
    }
}
