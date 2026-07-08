namespace Softaxis.VisaServices.Domain.Entities;

/// <summary>
/// Reference data: a visa product the consultancy processes (employment new/renewal,
/// family residence, visit 30/60, golden visa…). GLOBAL — excluded from tenant isolation
/// (same pattern as Finance's Currency/ExchangeRate) and seeded idempotently at startup.
/// Carries the default document checklist that is copied onto each new case.
/// </summary>
public sealed class VisaType
{
    private VisaType() { }

    public VisaType(string code, string name, string category, string channel,
        decimal defaultGovtFee, decimal defaultServiceFee, int processingDays,
        IEnumerable<string> requiredDocuments)
    {
        Id                 = Guid.NewGuid();
        Code               = code.Trim().ToLowerInvariant();
        Name               = name.Trim();
        Category           = category;
        Channel            = channel;
        DefaultGovtFee     = defaultGovtFee;
        DefaultServiceFee  = defaultServiceFee;
        ProcessingDays     = processingDays;
        RequiredDocuments  = requiredDocuments.ToList();
        IsActive           = true;
        CreatedAt          = DateTime.UtcNow;
    }

    public Guid    Id       { get; private set; }
    // Stable key used by the seeder for idempotent upserts (e.g. "employment-new").
    public string  Code     { get; private set; } = string.Empty;
    public string  Name     { get; private set; } = string.Empty;
    // employment | family | visit | golden | student | freelance | other
    public string  Category { get; private set; } = "other";
    // Default submission channel: manual | gdrfa | icp | mohre
    public string  Channel  { get; private set; } = "manual";
    public decimal DefaultGovtFee    { get; private set; }
    public decimal DefaultServiceFee { get; private set; }
    public int     ProcessingDays    { get; private set; }
    // Document checklist template, copied onto each new case as CaseDocument rows.
    public List<string> RequiredDocuments { get; private set; } = [];
    public bool     IsActive  { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    public void Update(string name, string category, string channel, decimal defaultGovtFee,
        decimal defaultServiceFee, int processingDays, IEnumerable<string> requiredDocuments)
    {
        Name = name.Trim(); Category = category; Channel = channel;
        DefaultGovtFee = defaultGovtFee; DefaultServiceFee = defaultServiceFee;
        ProcessingDays = processingDays; RequiredDocuments = requiredDocuments.ToList();
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetActive(bool active) { IsActive = active; UpdatedAt = DateTime.UtcNow; }
}
