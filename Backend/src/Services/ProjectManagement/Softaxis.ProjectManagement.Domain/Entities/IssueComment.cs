namespace Softaxis.ProjectManagement.Domain.Entities;

public sealed class IssueComment
{
    private IssueComment() { }

    public IssueComment(Guid issueId, string authorName, string body)
    {
        Id         = Guid.NewGuid();
        IssueId    = issueId;
        AuthorName = authorName.Trim();
        Body       = body.Trim();
        CreatedAt  = DateTime.UtcNow;
    }

    public Guid     Id         { get; private set; }
    public Guid     IssueId    { get; private set; }
    public string   AuthorName { get; private set; } = string.Empty;
    public string   Body       { get; private set; } = string.Empty;
    public DateTime  CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }
    public bool      IsDeleted { get; private set; }

    public Issue? Issue { get; private set; }

    public void Edit(string body)
    {
        Body      = body.Trim();
        UpdatedAt = DateTime.UtcNow;
    }
}
