using Softaxis.BuildingBlocks.Domain.Multitenancy;

namespace Softaxis.CRM.Domain.Entities;

public sealed class Deal
{
    private Deal() { }
    public Deal(string title, string company, decimal value, string stage, string priority,
        int probability, string expectedCloseDate, string assignedTo, string source,
        string industry, string description, string? forecastCategory = null, Guid? customerId = null,
        Guid? assignedToUserId = null)
    {
        Id               = Guid.NewGuid();
        Title            = title.Trim(); Company = company.Trim();
        CustomerId       = customerId;
        Value            = value; Currency = TenantCurrency.Resolve(); Stage = stage; Priority = priority;
        Probability      = probability; ExpectedCloseDate = expectedCloseDate;
        CreatedDate      = DateTime.UtcNow.ToString("yyyy-MM-dd");
        AssignedTo       = assignedTo.Trim(); AssignedToUserId = assignedToUserId; Source = source;
        Industry         = industry; Description = description.Trim();
        ForecastCategory = Normalize(forecastCategory) ?? DeriveForecastCategory(stage, probability);
        Tags             = []; CreatedAt = DateTime.UtcNow;
        StampClosedAt();   // a deal can be created directly in a closed stage (e.g. logging a past win)
    }
    public Guid      Id               { get; private set; }
    public string    Title            { get; private set; } = string.Empty;
    public string    Company          { get; private set; } = string.Empty;
    // Relational link to the account (CrmCustomer). Null = unlinked / free-text company.
    public Guid?     CustomerId       { get; private set; }
    public decimal   Value            { get; private set; }
    /// <summary>
    /// What the deal ACTUALLY closed at, when that differs from the quoted <see cref="Value"/> —
    /// a discount agreed at signing, a reduced scope. Null while the deal is open; defaulted to
    /// <see cref="Value"/> when it is won, so the common case needs no extra typing.
    /// <para>Kept here rather than as a hand-typed total on the account: this records WHICH deal
    /// closed at a different number, and every account and report total then follows from it.</para>
    /// </summary>
    public decimal?  ClosedValue      { get; private set; }
    public string    Currency         { get; private set; } = TenantCurrency.Resolve();
    public string    Stage            { get; private set; } = "lead";
    public string    Priority         { get; private set; } = "medium";
    public int       Probability      { get; private set; }
    public string    ExpectedCloseDate{ get; private set; } = string.Empty;
    public string    CreatedDate      { get; private set; } = string.Empty;
    public string    AssignedTo       { get; private set; } = string.Empty;
    /// <summary>Owning user. Drives the assigned-only / my-team visibility tiers; null = unassigned.</summary>
    public Guid?     AssignedToUserId { get; private set; }
    /// <summary>Owning team — see Lead.TeamId. Null = untagged, falls back to the membership rule.</summary>
    public Guid?     TeamId           { get; private set; }
    public string    Source           { get; private set; } = string.Empty;
    public string    Industry         { get; private set; } = string.Empty;
    public string    Description      { get; private set; } = string.Empty;
    public string?   NextAction       { get; private set; }
    public string?   NextActionDate   { get; private set; }
    // Forecasting: pipeline | best_case | commit | closed | omitted
    public string    ForecastCategory { get; private set; } = "pipeline";
    public string?   LossReason       { get; private set; }
    /// <summary>When the opportunity actually reached a terminal stage (won/lost); null while open.
    /// Every time-based sales report keys off this — <see cref="ExpectedCloseDate"/> is a forecast,
    /// not an outcome, so it can never answer "what did we close in July?".</summary>
    public DateTime? ClosedAt         { get; private set; }
    public List<string> Tags          { get; private set; } = [];
    // Contact stored as JSON
    public string    ContactJson      { get; private set; } = "{}";
    public bool      IsDeleted        { get; private set; }
    public DateTime  CreatedAt        { get; private set; }
    public DateTime? UpdatedAt        { get; private set; }
    /// <summary>Set the owning user (and the denormalized display name). Mirrors Lead.AssignTo.</summary>
    public void AssignTo(Guid? userId, string name, Guid? teamId = null)
    {
        AssignedToUserId = userId;
        AssignedTo = (name ?? string.Empty).Trim();
        TeamId = userId is null ? null : teamId;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Backfill hook: only ever fills an untagged record.</summary>
    public void BackfillTeam(Guid teamId) { if (TeamId is null) TeamId = teamId; }

    public void MoveStage(string stage, int probability, string? forecastCategory = null, string? lossReason = null)
    {
        Stage = stage; Probability = probability;
        ForecastCategory = Normalize(forecastCategory) ?? DeriveForecastCategory(stage, probability);
        if (stage == "lost") LossReason = lossReason?.Trim();
        else if (stage != "lost") LossReason = null;
        StampClosedAt();
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Stages the opportunity can no longer move forward from.</summary>
    public static bool IsClosedStage(string stage) => stage is "won" or "lost";

    /// <summary>Stamps <see cref="ClosedAt"/> the first time the deal enters a closed stage and clears it
    /// if the deal is reopened. Re-saving an already-closed deal keeps the original close date, so an
    /// edit to a won deal never silently moves it into a different reporting period.</summary>
    private void StampClosedAt()
    {
        if (IsClosedStage(Stage)) ClosedAt ??= DateTime.UtcNow;
        else ClosedAt = null;

        // A won deal always carries a closed value, defaulting to what was quoted — so revenue is
        // never silently zero for a workspace that has not started filling the field in.
        if (Stage == "won") ClosedValue ??= Value;
        // Reopened, or lost: there is no closed amount any more. Leaving a stale one behind would
        // keep an abandoned deal contributing to the account's revenue.
        else ClosedValue = null;
    }

    /// <summary>
    /// Record what the deal actually closed at.
    /// <para>Null means "leave it as it is", NOT "clear it": every existing caller of Update and
    /// MoveStage passes no closed value, and treating that as a reset would wipe a figure the user
    /// typed the moment anyone edited the deal for an unrelated reason. To go back to the quoted
    /// amount, send that amount. Ignored on a deal that is not won — there is no revenue to state.</para>
    /// </summary>
    public void SetClosedValue(decimal? closedValue)
    {
        if (Stage != "won" || closedValue is not { } amount) return;
        ClosedValue = amount;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Backfill hook for rows created before <see cref="ClosedAt"/> existed. Only ever fills a
    /// null on an already-closed deal; never overwrites a genuine close date.</summary>
    public void BackfillClosedAt(DateTime closedAt)
    {
        if (ClosedAt is null && IsClosedStage(Stage)) ClosedAt = closedAt;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }

    public void Update(string title, string company, decimal value, string stage, string priority,
        int probability, string expectedCloseDate, string assignedTo, string source, string industry,
        string description, string? nextAction, string? nextActionDate, List<string>? tags,
        string? forecastCategory = null, Guid? customerId = null, Guid? assignedToUserId = null)
    {
        Title = title.Trim(); Company = company.Trim(); Value = value;
        CustomerId = customerId;
        Stage = stage; Priority = priority; Probability = probability;
        ExpectedCloseDate = expectedCloseDate; AssignedTo = assignedTo.Trim();
        AssignedToUserId = assignedToUserId;
        Source = source; Industry = industry; Description = description.Trim();
        NextAction = nextAction; NextActionDate = nextActionDate;
        ForecastCategory = Normalize(forecastCategory) ?? DeriveForecastCategory(stage, probability);
        if (stage != "lost") LossReason = null;
        if (tags is not null) Tags = tags;
        // Update() can change Stage too, so it must keep ClosedAt consistent — otherwise a deal closed
        // via the edit form (rather than the board) would never get a close date.
        StampClosedAt();
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetNextAction(string? action, string? date) { NextAction = action; NextActionDate = date; UpdatedAt = DateTime.UtcNow; }

    // Weighted (expected) value used for forecasting rollups.
    public decimal WeightedValue => Math.Round(Value * Probability / 100m, 2);

    /// <summary>The number that counts as money: the closed value where one was recorded, else the
    /// quoted value. Every revenue figure reads this, never <see cref="Value"/> directly.</summary>
    public decimal RealizedValue => ClosedValue ?? Value;

    private static readonly HashSet<string> ValidForecast =
        new(StringComparer.OrdinalIgnoreCase) { "pipeline", "best_case", "commit", "closed", "omitted" };

    private static string? Normalize(string? category)
    {
        if (string.IsNullOrWhiteSpace(category)) return null;
        var c = category.Trim().ToLowerInvariant();
        return ValidForecast.Contains(c) ? c : null;
    }

    // Salesforce-style default: derive the forecast bucket from stage + probability.
    public static string DeriveForecastCategory(string stage, int probability) => stage switch
    {
        "won"  => "closed",
        "lost" => "omitted",
        _      => probability >= 80 ? "commit" : probability >= 50 ? "best_case" : "pipeline",
    };
}
