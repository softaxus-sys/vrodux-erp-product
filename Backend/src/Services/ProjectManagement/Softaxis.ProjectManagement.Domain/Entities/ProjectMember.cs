namespace Softaxis.ProjectManagement.Domain.Entities;

public sealed class ProjectMember
{
    private ProjectMember() { }

    public ProjectMember(Guid projectId, Guid userId, string userName, string? userEmail, string role)
    {
        Id        = Guid.NewGuid();
        ProjectId = projectId;
        UserId    = userId;
        UserName  = userName.Trim();
        UserEmail = userEmail?.Trim();
        Role      = role;
        CreatedAt = DateTime.UtcNow;
    }

    public Guid     Id        { get; private set; }
    public Guid     ProjectId { get; private set; }
    public Guid     UserId    { get; private set; }
    public string   UserName  { get; private set; } = string.Empty;
    public string?  UserEmail { get; private set; }
    public string   Role      { get; private set; } = "member"; // owner | member | viewer
    public DateTime CreatedAt { get; private set; }

    public Project? Project { get; private set; }

    public void ChangeRole(string role) => Role = role;
}
