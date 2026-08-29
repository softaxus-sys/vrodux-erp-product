using Softaxis.BuildingBlocks.Domain.Multitenancy;

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
        Currency       = TenantCurrency.Resolve(); AssignedTo = assignedTo.Trim(); AssignedToUserId = assignedToUserId;
        CreatedDate    = DateTime.UtcNow.ToString("yyyy-MM-dd");
        Notes          = notes?.Trim(); Tags = [];
        WhatsApp       = Trim(whatsApp); InterestedIn = Trim(interestedIn);
        Budget         = Trim(budget);  Message = Trim(message);
        PurchaseTimeframe = Trim(purchaseTimeframe);
        CreatedAt      = DateTime.UtcNow;
        LeadDate       = CreatedAt;
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
    public string    Currency        { get; private set; } = TenantCurrency.Resolve();
    /// <summary>Display name of the current owner (denormalized, kept for back-compat + list display).</summary>
    public string    AssignedTo      { get; private set; } = string.Empty;
    /// <summary>Identity user id of the current owner. Drives role-based "my assigned leads" scoping.
    /// Null = unassigned / legacy free-text-only assignment.</summary>
    public Guid?     AssignedToUserId { get; private set; }
    /// <summary>
    /// The team this record belongs to. Owners can sit in several teams, so ownership alone cannot
    /// say whose work this is — without it, every lead of every team the owner belongs to would see
    /// the record. Null = untagged: falls back to the owner-membership rule so legacy rows stay
    /// visible rather than vanishing from a team lead the day this shipped.
    /// </summary>
    public Guid?     TeamId          { get; private set; }
    /// <summary>
    /// When the lead actually arose, as a real date the database can sort and index.
    /// <para>
    /// Defaults to <c>CreatedAt</c> and is overwritten with the source platform's own enquiry time
    /// once that is known. It exists as a column rather than being derived per query because
    /// <c>PlatformCreatedTime</c> is a raw string from the source: ordering by it needs a per-row
    /// conversion that SQL cannot use an index for, and the list sorts on this by default over
    /// thousands of rows.
    /// </para>
    /// </summary>
    public DateTime  LeadDate        { get; private set; }
    public string    CreatedDate     { get; private set; } = string.Empty;
    public string?   LastContactDate { get; private set; }
    public string?   NextFollowUp    { get; private set; }
    public string?   Notes           { get; private set; }
    public string?   ConvertedDealId { get; private set; }
    // Relational link to the account created on conversion (mirrors ConvertedDealId).
    public Guid?     ConvertedCustomerId { get; private set; }
    /// <summary>When the lead was converted; null while unconverted. Paired with <see cref="CreatedAt"/>
    /// this gives time-to-convert, which the conversion + source-effectiveness reports are built on.</summary>
    public DateTime? ConvertedAt     { get; private set; }

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
        var newScore = LeadScoring.Calculate(
            Email, Phone, WhatsApp,
            Budget, InterestedIn, Message,
            Source, Priority, EstimatedValue,
            activityCount, PurchaseTimeframe);
        if (newScore == Score) return; // idempotent — don't churn UpdatedAt when nothing changed
        Score = newScore;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>When no explicit value was entered (EstimatedValue &lt;= 0), estimate it from the
    /// free-text <see cref="Budget"/> — falling back to a money amount mentioned in the interest or
    /// message — so inbound leads (Meta/import) still get a pipeline value. A manually entered value
    /// normally wins; pass <paramref name="overrideExisting"/> to force a re-derive (startup repair).</summary>
    public void DeriveEstimatedValueFromBudget(bool overrideExisting = false)
    {
        if (!overrideExisting && EstimatedValue > 0) return;
        var v = BudgetParser.Parse(Budget)
             ?? BudgetParser.ParseFromText(InterestedIn)
             ?? BudgetParser.ParseFromText(Message);
        if (v is > 0 && v.Value != EstimatedValue)
        {
            EstimatedValue = v.Value;
            UpdatedAt = DateTime.UtcNow;
        }
    }

    /// <summary>When no explicit purchase timeframe was captured, detect one from the lead's message
    /// or interest text ("looking to buy within 2 months", "ready ASAP") and store the normalized
    /// label — so imported/inbound leads still get an urgency tag. No-op if a timeframe is already set
    /// or nothing confident is found.</summary>
    public void DetectTimeframeFromText()
    {
        if (!string.IsNullOrWhiteSpace(PurchaseTimeframe)) return;
        PurchaseTimeframe = PurchaseUrgency.DetectTimeframeText(Message)
                         ?? PurchaseUrgency.DetectTimeframeText(InterestedIn);
    }

    /// <summary>Authoritative value re-derivation for the startup repair: for a lead that has a budget,
    /// the value should reflect the (trusted) budget or be 0 — this clears misleading legacy values
    /// (e.g. a static 50,000 guessed from a bare "50"). Leaves budget-less leads' values untouched so a
    /// manually entered value is preserved.</summary>
    public void RepairEstimatedValueFromBudget()
    {
        if (string.IsNullOrWhiteSpace(Budget)) return;
        var v = BudgetParser.Parse(Budget)
             ?? BudgetParser.ParseFromText(InterestedIn)
             ?? BudgetParser.ParseFromText(Message)
             ?? 0m;
        if (v != EstimatedValue)
        {
            EstimatedValue = v;
            UpdatedAt = DateTime.UtcNow;
        }
    }

    /// <summary>Additively promote requirement fields recovered from a lead's captured
    /// <see cref="CustomFields"/> (Form Responses). Only fills a field that is currently empty —
    /// never overwrites data already promoted at capture time.</summary>
    public void RecoverRequirements(string? whatsApp, string? interestedIn, string? budget,
        string? message, string? purchaseTimeframe)
    {
        WhatsApp          ??= Trim(whatsApp);
        InterestedIn      ??= Trim(interestedIn);
        Budget            ??= Trim(budget);
        Message           ??= Trim(message);
        PurchaseTimeframe ??= Trim(purchaseTimeframe);
    }
    public void Convert(string dealId, Guid? customerId = null)
    {
        Status = "converted"; ConvertedDealId = dealId; ConvertedCustomerId = customerId;
        ConvertedAt ??= DateTime.UtcNow;   // keep the original date if a lead is somehow re-converted
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Backfill hook for leads converted before <see cref="ConvertedAt"/> existed. Only ever
    /// fills a null on an already-converted lead.</summary>
    public void BackfillConvertedAt(DateTime convertedAt)
    {
        if (ConvertedAt is null && Status == "converted") ConvertedAt = convertedAt;
    }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }

    /// <summary>Reassign the lead to a user (records the current owner on the entity; handoff history is
    /// written separately by the handler which knows the acting user).</summary>
    public void AssignTo(Guid? userId, string name, Guid? teamId = null)
    {
        AssignedToUserId = userId;
        AssignedTo = (name ?? string.Empty).Trim();
        // Unassigning clears the team too — a record with no owner belongs to no team.
        TeamId = userId is null ? null : teamId;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Backfill hook: only ever fills an untagged record, never overwrites a real choice.</summary>
    public void BackfillTeam(Guid teamId) { if (TeamId is null) TeamId = teamId; }

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
        // Kept in step here rather than computed on read, so the sort column can never disagree
        // with the date the grid shows. An unparseable value leaves the CreatedAt default alone.
        if (PlatformCreatedTime is not null
            && DateTime.TryParse(PlatformCreatedTime, null,
                   System.Globalization.DateTimeStyles.AdjustToUniversal | System.Globalization.DateTimeStyles.AssumeUniversal,
                   out var platformDate))
            LeadDate = platformDate;
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
