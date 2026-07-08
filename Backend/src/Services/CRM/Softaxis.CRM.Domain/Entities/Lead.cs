namespace Softaxis.CRM.Domain.Entities;

public sealed class Lead
{
    private Lead() { }
    public Lead(string firstName, string lastName, string title, string company, string industry,
        string email, string phone, string country, string city, string source, string priority,
        decimal estimatedValue, string assignedTo, string? notes,
        string? whatsApp = null, string? interestedIn = null, string? budget = null, string? message = null,
        Guid? assignedToUserId = null, string? purchaseTimeframe = null)
    {
        Id             = Guid.NewGuid();
        FirstName      = firstName.Trim(); LastName = lastName.Trim();
        Title          = title.Trim(); Company = company.Trim(); Industry = industry.Trim();
        Email          = email.Trim().ToLowerInvariant(); Phone = phone.Trim();
        Country        = country; City = city; Source = source; Priority = priority;
        Status         = "new"; Score = 0; EstimatedValue = estimatedValue;
        Currency       = "AED"; AssignedTo = assignedTo.Trim(); AssignedToUserId = assignedToUserId;
        CreatedDate    = DateTime.UtcNow.ToString("yyyy-MM-dd");
        Notes          = notes?.Trim(); Tags = [];
        WhatsApp       = Trim(whatsApp); InterestedIn = Trim(interestedIn);
        Budget         = Trim(budget);  Message = Trim(message);
        PurchaseTimeframe = Trim(purchaseTimeframe);
        CreatedAt      = DateTime.UtcNow;
    }

    private static string? Trim(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
    public Guid      Id              { get; private set; }
    public string    FirstName       { get; private set; } = string.Empty;
    public string    LastName        { get; private set; } = string.Empty;
    public string    FullName        => $"{FirstName} {LastName}";
    public string    Title           { get; private set; } = string.Empty;
    public string    Company         { get; private set; } = string.Empty;
    public string    Industry        { get; private set; } = string.Empty;
    public string    Email           { get; private set; } = string.Empty;
    public string    Phone           { get; private set; } = string.Empty;
    public string    Country         { get; private set; } = string.Empty;
    public string    City            { get; private set; } = string.Empty;
    public string    Source          { get; private set; } = string.Empty;
    public string    Status          { get; private set; } = "new";
    public string    Priority        { get; private set; } = "medium";
    public int       Score           { get; private set; }
    public decimal   EstimatedValue  { get; private set; }
    public string    Currency        { get; private set; } = "AED";
    /// <summary>Display name of the current owner (denormalized, kept for back-compat + list display).</summary>
    public string    AssignedTo      { get; private set; } = string.Empty;
    /// <summary>Identity user id of the current owner. Drives role-based "my assigned leads" scoping.
    /// Null = unassigned / legacy free-text-only assignment.</summary>
    public Guid?     AssignedToUserId { get; private set; }
    public string    CreatedDate     { get; private set; } = string.Empty;
    public string?   LastContactDate { get; private set; }
    public string?   NextFollowUp    { get; private set; }
    public string?   Notes           { get; private set; }
    public string?   ConvertedDealId { get; private set; }
    // Relational link to the account created on conversion (mirrors ConvertedDealId).
    public Guid?     ConvertedCustomerId { get; private set; }

    // ── Requirements (from a lead-gen form or entered manually) ──────────────
    public string?   WhatsApp        { get; private set; }
    public string?   InterestedIn    { get; private set; }
    public string?   Budget          { get; private set; }
    public string?   Message         { get; private set; }
    /// <summary>Free-text "when are you planning to buy/invest?" answer — drives the purchase-urgency
    /// score via <see cref="PurchaseUrgency"/>. Null when not captured.</summary>
    public string?   PurchaseTimeframe { get; private set; }

    // ── Marketing / attribution (denormalized from the capturing source) ─────
    public string?   Platform            { get; private set; }
    public string?   FormName            { get; private set; }
    public bool?     IsOrganic           { get; private set; }
    public string?   Campaign            { get; private set; }
    public string?   AdName              { get; private set; }
    public string?   AdSetName           { get; private set; }
    public string?   PlatformCreatedTime { get; private set; }
    /// <summary>Extra captured form fields (survey Q&amp;A / custom questions) as question → answer.</summary>
    public Dictionary<string, string>? CustomFields { get; private set; }

    public List<string> Tags         { get; private set; } = [];
    public bool      IsDeleted       { get; private set; }
    public DateTime  CreatedAt       { get; private set; }
    public DateTime? UpdatedAt       { get; private set; }
    public void UpdateStatus(string status) { Status = status; UpdatedAt = DateTime.UtcNow; }
    public void UpdateScore(int score) { Score = Math.Clamp(score, 0, 100); UpdatedAt = DateTime.UtcNow; }

    /// <summary>Recompute the automatic rule-based score from this lead's own signals plus its
    /// engagement (number of activities logged). The score is <b>computed, not free-form</b> — this
    /// overwrites any previous value. Called on create, edit, intake, and when activity is logged.
    /// See <see cref="LeadScoring"/> for the weighting.</summary>
    public void RecalculateScore(int activityCount = 0)
    {
        Score = LeadScoring.Calculate(
            Email, Phone, WhatsApp,
            Budget, InterestedIn, Message,
            Source, Priority, EstimatedValue,
            activityCount, PurchaseTimeframe);
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>When no explicit value was entered (EstimatedValue &lt;= 0), estimate it from the
    /// free-text <see cref="Budget"/> so inbound leads (Meta/import) still get a pipeline value.
    /// A manually entered value always wins (this is a no-op when EstimatedValue &gt; 0).</summary>
    public void DeriveEstimatedValueFromBudget()
    {
        if (EstimatedValue > 0) return;
        if (BudgetParser.Parse(Budget) is { } v && v > 0)
        {
            EstimatedValue = v;
            UpdatedAt = DateTime.UtcNow;
        }
    }
    public void Convert(string dealId, Guid? customerId = null) { Status = "converted"; ConvertedDealId = dealId; ConvertedCustomerId = customerId; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }

    /// <summary>Reassign the lead to a user (records the current owner on the entity; handoff history is
    /// written separately by the handler which knows the acting user).</summary>
    public void AssignTo(Guid? userId, string name)
    {
        AssignedToUserId = userId;
        AssignedTo = (name ?? string.Empty).Trim();
        UpdatedAt = DateTime.UtcNow;
    }

    public void Update(string firstName, string lastName, string title, string company, string industry,
        string email, string phone, string country, string city, string source, string priority,
        decimal estimatedValue, string assignedTo, int score, string? nextFollowUp, string? notes, List<string>? tags,
        string? whatsApp = null, string? interestedIn = null, string? budget = null, string? message = null,
        Guid? assignedToUserId = null, string? purchaseTimeframe = null)
    {
        FirstName = firstName.Trim(); LastName = lastName.Trim();
        Title = title.Trim(); Company = company.Trim(); Industry = industry.Trim();
        Email = email.Trim().ToLowerInvariant(); Phone = phone.Trim();
        Country = country; City = city; Source = source; Priority = priority;
        EstimatedValue = estimatedValue; AssignedTo = assignedTo.Trim(); AssignedToUserId = assignedToUserId;
        Score = Math.Clamp(score, 0, 100); NextFollowUp = nextFollowUp; Notes = notes?.Trim();
        WhatsApp = Trim(whatsApp); InterestedIn = Trim(interestedIn);
        Budget = Trim(budget); Message = Trim(message);
        PurchaseTimeframe = Trim(purchaseTimeframe);
        if (tags is not null) Tags = tags;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Populate the denormalized marketing/attribution fields captured from a lead source.</summary>
    public void SetMarketing(string? platform, string? formName, bool? isOrganic, string? campaign,
        string? adName, string? adSetName, string? platformCreatedTime, Dictionary<string, string>? customFields)
    {
        Platform = Trim(platform); FormName = Trim(formName); IsOrganic = isOrganic;
        Campaign = Trim(campaign); AdName = Trim(adName); AdSetName = Trim(adSetName);
        PlatformCreatedTime = Trim(platformCreatedTime);
        CustomFields = customFields is { Count: > 0 } ? customFields : null;
    }

    /// <summary>Set the lead-gen requirement fields (used by the intake pipeline).</summary>
    public void SetRequirements(string? whatsApp, string? interestedIn, string? budget, string? message,
        string? purchaseTimeframe = null)
    {
        WhatsApp = Trim(whatsApp); InterestedIn = Trim(interestedIn);
        Budget = Trim(budget); Message = Trim(message);
        PurchaseTimeframe = Trim(purchaseTimeframe);
    }
}
