namespace Softaxis.LeadGen.Domain.Entities;

/// <summary>
/// One discovery run: "dental clinics in Dubai Marina and JLT". Finding businesses is free to the
/// workspace (and capped per day); the credits are spent when a prospect is revealed.
/// </summary>
public sealed class SearchJob
{
    private SearchJob() { }

    public SearchJob(string name, string countryCode, string? regionsJson, string? areasJson,
        string categoriesJson, string? keywords, int maxResults, Guid? userId, string? userName)
    {
        Id           = Guid.NewGuid();
        Name         = name.Trim();
        CountryCode  = countryCode.Trim().ToUpperInvariant();
        Regions      = regionsJson;
        Areas        = areasJson;
        Categories   = categoriesJson;
        Keywords     = Text.OrNull(keywords);
        MaxResults   = maxResults;
        CreatedByUserId = userId;
        CreatedByName   = userName;
    }

    public Guid      Id           { get; private set; }
    public string    Name         { get; private set; } = null!;
    public string    CountryCode  { get; private set; } = "AE";
    /// <summary>JSON array of region (emirate / state) names.</summary>
    public string?   Regions      { get; private set; }
    /// <summary>JSON array of area names inside those regions. Empty = the whole region.</summary>
    public string?   Areas        { get; private set; }
    /// <summary>JSON array of category keys.</summary>
    public string    Categories   { get; private set; } = "[]";
    public string?   Keywords     { get; private set; }
    public int       MaxResults   { get; private set; } = 100;

    public string    Status       { get; private set; } = SearchStatus.Queued;
    public string?   Error        { get; private set; }
    /// <summary>Businesses the run returned in total.</summary>
    public int       FoundCount   { get; private set; }
    /// <summary>Of those, how many were new to this workspace.</summary>
    public int       NewCount     { get; private set; }
    public int       DuplicateCount { get; private set; }
    /// <summary>Provider requests made. It is what the run cost us, so it is kept.</summary>
    public int       RequestsMade { get; private set; }
    public string?   Progress     { get; private set; }

    public Guid?     CreatedByUserId { get; private set; }
    public string?   CreatedByName   { get; private set; }
    public DateTime  CreatedAt    { get; private set; } = DateTime.UtcNow;
    public DateTime? StartedAt    { get; private set; }
    public DateTime? CompletedAt  { get; private set; }
    public bool      IsDeleted    { get; private set; }

    public void Start()
    {
        Status = SearchStatus.Running; StartedAt = DateTime.UtcNow; Error = null;
    }

    public void ReportProgress(string text, int requests) { Progress = text; RequestsMade = requests; }

    public void Complete(int found, int added, int duplicates, int requests)
    {
        Status = SearchStatus.Completed; CompletedAt = DateTime.UtcNow;
        FoundCount = found; NewCount = added; DuplicateCount = duplicates; RequestsMade = requests;
        Progress = null;
    }

    public void Fail(string error, int found, int added, int duplicates, int requests)
    {
        Status = SearchStatus.Failed; CompletedAt = DateTime.UtcNow; Error = error.Length > 500 ? error[..500] : error;
        FoundCount = found; NewCount = added; DuplicateCount = duplicates; RequestsMade = requests;
        Progress = null;
    }

    public void Cancel()
    {
        if (Status is SearchStatus.Completed or SearchStatus.Failed) return;
        Status = SearchStatus.Cancelled; CompletedAt = DateTime.UtcNow; Progress = null;
    }

    /// <summary>A queued or running job picked up again after a restart.</summary>
    public void Requeue() { Status = SearchStatus.Queued; Progress = null; }

    public void Delete() => IsDeleted = true;
}
