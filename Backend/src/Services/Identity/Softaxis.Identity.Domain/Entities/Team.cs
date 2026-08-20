namespace Softaxis.Identity.Domain.Entities;

/// <summary>
/// A group of user accounts with a designated lead — the middle rung of the
/// admin → team lead → team member hierarchy.
///
/// <para><b>Why this lives in Identity.</b> Teams group <i>login accounts</i>, which is what work
/// is assigned to (a CRM lead carries <c>AssignedToUserId</c>). HR's <c>Department</c> groups
/// <c>Employee</c> records, and an Employee has no <c>UserId</c> — there is no bridge from a
/// department to the accounts that own leads — so it cannot serve this purpose. Keeping teams
/// beside users also means Sales, Purchase, Projects and Visa can adopt the same hierarchy without
/// a second, parallel team model.</para>
///
/// <para><b>Tenancy</b> follows <see cref="Role"/>: an explicit nullable <c>TenantId</c> scoped in
/// the handlers, rather than the shadow-column global filter the business services use — Identity
/// deliberately opts out of that mechanism.</para>
/// </summary>
public sealed class Team
{
    private readonly List<TeamMember> _members = [];

    private Team() { }

    public Team(string name, string? description, Guid? teamLeadUserId, Guid? tenantId)
    {
        Id             = Guid.NewGuid();
        Name           = name.Trim();
        Description    = description?.Trim();
        TeamLeadUserId = teamLeadUserId;
        TenantId       = tenantId;
        IsActive       = true;
        CreatedAt      = DateTime.UtcNow;
    }

    public Guid      Id             { get; private set; }
    public string    Name           { get; private set; } = string.Empty;
    public string?   Description    { get; private set; }

    /// <summary>The lead. Nullable so a team can be created before its lead is picked.</summary>
    public Guid?     TeamLeadUserId { get; private set; }

    public Guid?     TenantId       { get; private set; }
    public bool      IsActive       { get; private set; }
    public bool      IsDeleted      { get; private set; }
    public DateTime  CreatedAt      { get; private set; }
    public DateTime? UpdatedAt      { get; private set; }

    public IReadOnlyCollection<TeamMember> Members => _members.AsReadOnly();

    public void Update(string name, string? description, Guid? teamLeadUserId, bool isActive)
    {
        Name           = name.Trim();
        Description    = description?.Trim();
        TeamLeadUserId = teamLeadUserId;
        IsActive       = isActive;
        UpdatedAt      = DateTime.UtcNow;
    }

    /// <summary>Idempotent — adding an existing member is a no-op rather than a duplicate row.</summary>
    public void AddMember(Guid userId)
    {
        if (_members.Any(m => m.UserId == userId)) return;
        _members.Add(new TeamMember(Id, userId));
        UpdatedAt = DateTime.UtcNow;
    }

    public void RemoveMember(Guid userId)
    {
        var existing = _members.FirstOrDefault(m => m.UserId == userId);
        if (existing is null) return;
        _members.Remove(existing);
        UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; IsActive = false; UpdatedAt = DateTime.UtcNow; }
}

/// <summary>Membership join row. The team lead is identified by <see cref="Team.TeamLeadUserId"/>, not by a flag here.</summary>
public sealed class TeamMember
{
    private TeamMember() { }

    public TeamMember(Guid teamId, Guid userId)
    {
        TeamId    = teamId;
        UserId    = userId;
        CreatedAt = DateTime.UtcNow;
    }

    public Guid     TeamId    { get; private set; }
    public Guid     UserId    { get; private set; }
    public DateTime CreatedAt { get; private set; }
}
