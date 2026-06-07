namespace Softaxis.CRM.Domain.Entities;

// ── Education pack ───────────────────────────────────────────────────────────
// Lead → Admission Inquiry → Application → Enrollment → Student Lifecycle.
// Students/guardians extend CRM leads/customers. Lives in the `education` schema.

/// <summary>An admission application/inquiry originating from a CRM lead.</summary>
public sealed class Admission
{
    private Admission() { }
    public Admission(Guid? leadId, string applicantName, string program, string intakeTerm,
        string? guardianName, string? phone, string? email, string? notes)
    {
        Id = Guid.NewGuid();
        AdmissionNumber = $"ADM-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..5].ToUpper()}";
        LeadId = leadId; ApplicantName = applicantName.Trim(); Program = program.Trim(); IntakeTerm = intakeTerm.Trim();
        GuardianName = guardianName?.Trim(); Phone = phone?.Trim(); Email = email?.Trim().ToLowerInvariant();
        Notes = notes?.Trim(); Status = "inquiry"; AppliedDate = DateTime.UtcNow.ToString("yyyy-MM-dd"); CreatedAt = DateTime.UtcNow;
    }
    public Guid     Id              { get; private set; }
    public string   AdmissionNumber { get; private set; } = string.Empty;
    public Guid?    LeadId          { get; private set; }
    public Guid?    StudentId       { get; private set; }
    public string   ApplicantName   { get; private set; } = string.Empty;
    public string   Program         { get; private set; } = string.Empty;
    public string   IntakeTerm      { get; private set; } = string.Empty;
    public string?  GuardianName    { get; private set; }
    public string?  Phone           { get; private set; }
    public string?  Email           { get; private set; }
    public string   Status          { get; private set; } = "inquiry"; // inquiry | applied | offer | accepted | rejected
    public string   AppliedDate     { get; private set; } = string.Empty;
    public string?  Notes           { get; private set; }
    public bool     IsDeleted       { get; private set; }
    public DateTime CreatedAt       { get; private set; }
    public DateTime UpdatedAt       { get; private set; } = DateTime.UtcNow;

    public void SetStatus(string s) { Status = s; UpdatedAt = DateTime.UtcNow; }
    public void LinkStudent(Guid studentId) { StudentId = studentId; Status = "accepted"; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

/// <summary>An enrolled student record (extends a CRM customer/guardian).</summary>
public sealed class Student
{
    private Student() { }
    public Student(Guid? customerId, string fullName, string gender, string program,
        string? guardianName, string? phone, string? email, string? notes)
    {
        Id = Guid.NewGuid();
        StudentNumber = $"STU-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..5].ToUpper()}";
        CustomerId = customerId; FullName = fullName.Trim(); Gender = gender; Program = program.Trim();
        GuardianName = guardianName?.Trim(); Phone = phone?.Trim(); Email = email?.Trim().ToLowerInvariant();
        Notes = notes?.Trim(); Status = "enrolled"; EnrolledDate = DateTime.UtcNow.ToString("yyyy-MM-dd"); CreatedAt = DateTime.UtcNow;
    }
    public Guid     Id            { get; private set; }
    public string   StudentNumber { get; private set; } = string.Empty;
    public Guid?    CustomerId    { get; private set; }
    public string   FullName      { get; private set; } = string.Empty;
    public string   Gender        { get; private set; } = string.Empty;
    public string   Program       { get; private set; } = string.Empty;
    public string?  GuardianName  { get; private set; }
    public string?  Phone         { get; private set; }
    public string?  Email         { get; private set; }
    public string   Status        { get; private set; } = "enrolled"; // enrolled | graduated | inactive
    public string   EnrolledDate  { get; private set; } = string.Empty;
    public string?  Notes         { get; private set; }
    public bool     IsDeleted     { get; private set; }
    public DateTime CreatedAt     { get; private set; }
    public DateTime UpdatedAt     { get; private set; } = DateTime.UtcNow;

    public void Update(string fullName, string gender, string program, string? guardianName, string? phone, string? email, string status, string? notes)
    {
        FullName = fullName.Trim(); Gender = gender; Program = program.Trim(); GuardianName = guardianName?.Trim();
        Phone = phone?.Trim(); Email = email?.Trim().ToLowerInvariant(); Status = status; Notes = notes?.Trim(); UpdatedAt = DateTime.UtcNow;
    }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

/// <summary>A student's enrollment in a course/term with fee tracking.</summary>
public sealed class Enrollment
{
    private Enrollment() { }
    public Enrollment(Guid studentId, string studentName, string course, string term, decimal feeTotal, string? notes)
    {
        Id = Guid.NewGuid();
        EnrollmentNumber = $"ENR-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..5].ToUpper()}";
        StudentId = studentId; StudentName = studentName.Trim(); Course = course.Trim(); Term = term.Trim();
        FeeTotal = feeTotal; FeePaid = 0; Notes = notes?.Trim(); Status = "active";
        EnrollDate = DateTime.UtcNow.ToString("yyyy-MM-dd"); CreatedAt = DateTime.UtcNow;
    }
    public Guid     Id               { get; private set; }
    public string   EnrollmentNumber { get; private set; } = string.Empty;
    public Guid     StudentId        { get; private set; }
    public string   StudentName      { get; private set; } = string.Empty;
    public string   Course           { get; private set; } = string.Empty;
    public string   Term             { get; private set; } = string.Empty;
    public decimal  FeeTotal         { get; private set; }
    public decimal  FeePaid          { get; private set; }
    public string   Status           { get; private set; } = "active"; // active | completed | withdrawn
    public string   EnrollDate       { get; private set; } = string.Empty;
    public string?  Notes            { get; private set; }
    public bool     IsDeleted        { get; private set; }
    public DateTime CreatedAt        { get; private set; }
    public DateTime UpdatedAt        { get; private set; } = DateTime.UtcNow;

    public decimal FeeBalance => Math.Max(0, FeeTotal - FeePaid);

    public void RecordPayment(decimal amount) { FeePaid = Math.Min(FeeTotal, FeePaid + Math.Abs(amount)); UpdatedAt = DateTime.UtcNow; }
    public void SetStatus(string s) { Status = s; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}
