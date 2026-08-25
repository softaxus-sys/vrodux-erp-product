namespace Softaxis.HR.Domain.Entities;

public sealed class Employee
{
    private Employee() { }

    public Employee(
        string  firstName,
        string  lastName,
        string  email,
        string? phone,
        string? jobTitle,
        Guid?   departmentId,
        string? departmentName,
        string  employmentType,
        decimal basicSalary,
        string  joiningDate,
        Guid?   managerId,
        string? notes,
        string? avatarData = null)
    {
        Id             = Guid.NewGuid();
        EmployeeNumber = $"EMP-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..6].ToUpper()}";
        FirstName      = firstName.Trim();
        LastName       = lastName.Trim();
        Email          = email.Trim().ToLowerInvariant();
        Phone          = phone?.Trim();
        JobTitle       = jobTitle?.Trim();
        DepartmentId   = departmentId;
        DepartmentName = departmentName?.Trim();
        EmploymentType = employmentType;  // full-time | part-time | contract | intern
        BasicSalary    = basicSalary;
        JoiningDate    = joiningDate;
        Status         = "active";        // active | inactive | terminated
        ManagerId      = managerId;
        Notes          = notes?.Trim();
        AvatarData     = Normalize(avatarData);
        CreatedAt      = DateTime.UtcNow;
    }

    public Guid      Id             { get; private set; }
    public string    EmployeeNumber { get; private set; } = string.Empty;
    public string    FirstName      { get; private set; } = string.Empty;
    public string    LastName       { get; private set; } = string.Empty;
    public string    FullName       => $"{FirstName} {LastName}";
    public string    Email          { get; private set; } = string.Empty;
    public string?   Phone          { get; private set; }
    public string?   JobTitle       { get; private set; }
    public Guid?     DepartmentId   { get; private set; }
    public string?   DepartmentName { get; private set; }
    public string    EmploymentType { get; private set; } = "full-time";
    public decimal   BasicSalary    { get; private set; }
    public string    JoiningDate    { get; private set; } = string.Empty;
    public string?   TerminationDate { get; private set; }
    public string    Status         { get; private set; } = "active";
    public Guid?     ManagerId      { get; private set; }
    public string?   Notes          { get; private set; }
    /// <summary>
    /// The Identity login this employee signs in with, or null when they have none — labourers,
    /// drivers and retail staff commonly never log in, and a login also consumes a plan seat.
    ///
    /// <para>Set by explicit confirmation only. Email is used once, to <i>suggest</i> a candidate;
    /// the link itself is by id, so it survives an email change and can never silently merge two
    /// people who happen to share an address.</para>
    /// </summary>
    public Guid?     UserId         { get; private set; }

    /// <summary>Profile photo as a data URI (data:image/...;base64,...). Null = no photo.</summary>
    public string?   AvatarData     { get; private set; }

    // ── Personal / compliance ────────────────────────────────────────────
    public string?   Nationality      { get; private set; }
    public string?   EmiratesId       { get; private set; }
    public string?   PassportNumber   { get; private set; }
    /// <summary>yyyy-MM-dd, same string-date convention as JoiningDate.</summary>
    public string?   VisaExpiry       { get; private set; }
    public string?   ReportingTo      { get; private set; }

    // ── Bank / payroll ───────────────────────────────────────────────────
    public string?   BankAccount      { get; private set; }
    /// <summary>Required by the WPS SIF export, so it is stored on the employee.</summary>
    public string?   Iban             { get; private set; }

    /// <summary>
    /// The employee's MOHRE Person ID / labour card number — the "Employee Unique ID" in a WPS
    /// SIF file. Without it the salary file is rejected, so it is collected here rather than
    /// improvised at export time from the employee number, which is an internal reference MOHRE
    /// has never heard of.
    /// </summary>
    public string?   LabourCardNumber { get; private set; }

    /// <summary>
    /// Routing code of the bank or exchange house the salary is paid into ("Employee Agent ID" in
    /// the SIF). Not derivable from the IBAN — the IBAN carries a 3-digit bank code, while WPS
    /// wants the 9-digit routing code the agent publishes.
    /// </summary>
    public string?   BankRoutingCode  { get; private set; }
    public string?   MedicalInsurance { get; private set; }
    public DateTime  CreatedAt      { get; private set; }
    public DateTime? UpdatedAt      { get; private set; }
    public bool      IsDeleted      { get; private set; }

    public Department?              Department     { get; private set; }
    public ICollection<Leave>       Leaves         { get; private set; } = new List<Leave>();
    public ICollection<AttendanceLog> AttendanceLogs { get; private set; } = new List<AttendanceLog>();

    public void Update(
        string  firstName, string lastName, string email, string? phone,
        string? jobTitle, Guid? departmentId, string? departmentName,
        string  employmentType, decimal basicSalary, string joiningDate,
        Guid?   managerId, string? notes, string status, string? avatarData = null)
    {
        FirstName      = firstName.Trim();
        LastName       = lastName.Trim();
        Email          = email.Trim().ToLowerInvariant();
        Phone          = phone?.Trim();
        JobTitle       = jobTitle?.Trim();
        DepartmentId   = departmentId;
        DepartmentName = departmentName?.Trim();
        EmploymentType = employmentType;
        BasicSalary    = basicSalary;
        JoiningDate    = joiningDate;
        Status         = status;
        ManagerId      = managerId;
        Notes          = notes?.Trim();
        AvatarData     = Normalize(avatarData) ?? AvatarData;
        if (status == "terminated") TerminationDate = DateTime.UtcNow.ToString("yyyy-MM-dd");
        UpdatedAt      = DateTime.UtcNow;
    }

    /// <summary>
    /// Personal and compliance details. Kept out of the constructor so the required
    /// hiring fields stay readable — these are all optional and set alongside a create/update.
    /// </summary>
    public void SetPersonalDetails(
        string? nationality, string? emiratesId, string? passportNumber,
        string? visaExpiry, string? reportingTo)
    {
        Nationality    = Normalize(nationality);
        EmiratesId     = Normalize(emiratesId);
        PassportNumber = Normalize(passportNumber);
        VisaExpiry     = Normalize(visaExpiry);
        ReportingTo    = Normalize(reportingTo);
    }

    public void SetBankDetails(
        string? bankAccount, string? iban, string? medicalInsurance,
        string? labourCardNumber = null, string? bankRoutingCode = null)
    {
        BankAccount      = Normalize(bankAccount);
        Iban             = Normalize(iban)?.Replace(" ", "").ToUpperInvariant();
        MedicalInsurance = Normalize(medicalInsurance);
        LabourCardNumber = Digits(labourCardNumber);
        BankRoutingCode  = Digits(bankRoutingCode);
    }

    /// <summary>
    /// Strips separators from an identifier that is digits-only in the WPS file. Users paste these
    /// from MOHRE portals and bank letters with spaces and dashes, and a stray space is the
    /// difference between an accepted file and a rejected one.
    /// </summary>
    private static string? Digits(string? v)
    {
        if (string.IsNullOrWhiteSpace(v)) return null;
        var digits = new string(v.Where(char.IsDigit).ToArray());
        return digits.Length == 0 ? null : digits;
    }

    /// <summary>Blank/whitespace is treated as "not supplied" so an update never wipes an existing photo by accident.</summary>
    private static string? Normalize(string? v) => string.IsNullOrWhiteSpace(v) ? null : v.Trim();

    public void LinkUser(Guid userId)  { UserId = userId; UpdatedAt = DateTime.UtcNow; }
    public void UnlinkUser()           { UserId = null;   UpdatedAt = DateTime.UtcNow; }

    public void RemoveAvatar() { AvatarData = null; UpdatedAt = DateTime.UtcNow; }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}
