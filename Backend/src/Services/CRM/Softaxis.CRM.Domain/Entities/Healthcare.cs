namespace Softaxis.CRM.Domain.Entities;

// ── Healthcare pack ──────────────────────────────────────────────────────────
// Lead → Patient Registration → Appointment → Treatment → Follow-up.
// Patients extend CRM customers (CustomerId/LeadId links); appointments reuse the
// activity concept. Lives in the `healthcare` schema within the CRM service.

public sealed class Patient
{
    private Patient() { }
    public Patient(Guid? leadId, Guid? customerId, string fullName, string gender, string? dateOfBirth,
        string phone, string? email, string? bloodGroup, string? assignedDoctor, string? notes)
    {
        Id = Guid.NewGuid();
        PatientNumber = $"PT-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..5].ToUpper()}";
        LeadId = leadId; CustomerId = customerId; FullName = fullName.Trim(); Gender = gender;
        DateOfBirth = dateOfBirth; Phone = phone.Trim(); Email = email?.Trim().ToLowerInvariant();
        BloodGroup = bloodGroup; AssignedDoctor = assignedDoctor?.Trim(); Notes = notes?.Trim();
        Status = "active"; RegisteredDate = DateTime.UtcNow.ToString("yyyy-MM-dd"); CreatedAt = DateTime.UtcNow;
    }
    public Guid     Id             { get; private set; }
    public string   PatientNumber  { get; private set; } = string.Empty;
    public Guid?    LeadId         { get; private set; }
    public Guid?    CustomerId     { get; private set; }
    public string   FullName       { get; private set; } = string.Empty;
    public string   Gender         { get; private set; } = string.Empty;
    public string?  DateOfBirth    { get; private set; }
    public string   Phone          { get; private set; } = string.Empty;
    public string?  Email          { get; private set; }
    public string?  BloodGroup     { get; private set; }
    public string?  AssignedDoctor { get; private set; }
    public string   Status         { get; private set; } = "active"; // active | inactive
    public string   RegisteredDate { get; private set; } = string.Empty;
    public string?  Notes          { get; private set; }
    public bool     IsDeleted      { get; private set; }
    public DateTime CreatedAt      { get; private set; }
    public DateTime UpdatedAt      { get; private set; } = DateTime.UtcNow;

    public void Update(string fullName, string gender, string? dateOfBirth, string phone, string? email, string? bloodGroup, string? assignedDoctor, string status, string? notes)
    {
        FullName = fullName.Trim(); Gender = gender; DateOfBirth = dateOfBirth; Phone = phone.Trim();
        Email = email?.Trim().ToLowerInvariant(); BloodGroup = bloodGroup; AssignedDoctor = assignedDoctor?.Trim();
        Status = status; Notes = notes?.Trim(); UpdatedAt = DateTime.UtcNow;
    }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

public sealed class Appointment
{
    private Appointment() { }
    public Appointment(Guid patientId, string patientName, string doctor, string? department,
        string scheduledAt, string? reason, string? notes)
    {
        Id = Guid.NewGuid();
        AppointmentNumber = $"APT-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..5].ToUpper()}";
        PatientId = patientId; PatientName = patientName.Trim(); Doctor = doctor.Trim();
        Department = department?.Trim(); ScheduledAt = scheduledAt; Reason = reason?.Trim(); Notes = notes?.Trim();
        Status = "scheduled"; CreatedAt = DateTime.UtcNow;
    }
    public Guid     Id                { get; private set; }
    public string   AppointmentNumber { get; private set; } = string.Empty;
    public Guid     PatientId         { get; private set; }
    public string   PatientName       { get; private set; } = string.Empty;
    public string   Doctor            { get; private set; } = string.Empty;
    public string?  Department        { get; private set; }
    public string   ScheduledAt       { get; private set; } = string.Empty;
    public string   Status            { get; private set; } = "scheduled"; // scheduled | completed | cancelled | no_show
    public string?  Reason            { get; private set; }
    public string?  Notes             { get; private set; }
    public bool     IsDeleted         { get; private set; }
    public DateTime CreatedAt         { get; private set; }
    public DateTime UpdatedAt         { get; private set; } = DateTime.UtcNow;

    public void SetStatus(string s) { Status = s; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

public sealed class TreatmentPlan
{
    private TreatmentPlan() { }
    public TreatmentPlan(Guid patientId, string patientName, string diagnosis, string plan, string doctor,
        string startDate, string? followUpDate, string? notes)
    {
        Id = Guid.NewGuid();
        PatientId = patientId; PatientName = patientName.Trim(); Diagnosis = diagnosis.Trim();
        Plan = plan.Trim(); Doctor = doctor.Trim(); StartDate = startDate; FollowUpDate = followUpDate;
        Notes = notes?.Trim(); Status = "active"; CreatedAt = DateTime.UtcNow;
    }
    public Guid     Id           { get; private set; }
    public Guid     PatientId    { get; private set; }
    public string   PatientName  { get; private set; } = string.Empty;
    public string   Diagnosis    { get; private set; } = string.Empty;
    public string   Plan         { get; private set; } = string.Empty;
    public string   Doctor       { get; private set; } = string.Empty;
    public string   StartDate    { get; private set; } = string.Empty;
    public string?  FollowUpDate { get; private set; }
    public string   Status       { get; private set; } = "active"; // active | completed | on_hold
    public string?  Notes        { get; private set; }
    public bool     IsDeleted    { get; private set; }
    public DateTime CreatedAt    { get; private set; }
    public DateTime UpdatedAt    { get; private set; } = DateTime.UtcNow;

    public void SetStatus(string s) { Status = s; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}
