namespace Softaxis.HR.Domain.Entities;

/// <summary>
/// The employer identifiers a UAE WPS salary file must carry.
///
/// <para>None of this could be improvised. A SIF is matched by MOHRE against the establishment's
/// own record, so the Employer Unique ID is the company's MOHRE establishment number and the
/// routing code is issued by the bank or exchange house acting as the WPS agent. The previous
/// export wrote the literals "MOB" and "COMPANY" in these positions, which no bank would accept.</para>
/// </summary>
public sealed class WpsConfiguration
{
    private WpsConfiguration() { }

    public WpsConfiguration(string employerUniqueId, string employerBankRoutingCode)
    {
        Id                      = Guid.NewGuid();
        EmployerUniqueId        = Digits(employerUniqueId);
        EmployerBankRoutingCode = Digits(employerBankRoutingCode);
        CreatedAt               = DateTime.UtcNow;
    }

    public Guid   Id { get; private set; }

    /// <summary>MOHRE establishment number — 13 digits.</summary>
    public string EmployerUniqueId        { get; private set; } = string.Empty;

    /// <summary>Routing code of the WPS agent bank the salaries are funded from — 9 digits.</summary>
    public string EmployerBankRoutingCode { get; private set; } = string.Empty;

    /// <summary>
    /// Incremented on every generated file. A resubmission for the same salary month must not
    /// reuse a filename the agent has already processed, and the sequence is what distinguishes
    /// them.
    /// </summary>
    public int    FileSequence { get; private set; }

    public DateTime  CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }
    public bool      IsDeleted { get; private set; }

    public void Update(string employerUniqueId, string employerBankRoutingCode)
    {
        EmployerUniqueId        = Digits(employerUniqueId);
        EmployerBankRoutingCode = Digits(employerBankRoutingCode);
        UpdatedAt               = DateTime.UtcNow;
    }

    public int NextSequence()
    {
        FileSequence = FileSequence >= 99 ? 1 : FileSequence + 1;
        UpdatedAt    = DateTime.UtcNow;
        return FileSequence;
    }

    public bool IsComplete =>
        EmployerUniqueId.Length > 0 && EmployerBankRoutingCode.Length > 0;

    private static string Digits(string? v) =>
        string.IsNullOrWhiteSpace(v) ? string.Empty : new string(v.Where(char.IsDigit).ToArray());
}
