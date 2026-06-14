namespace Softaxis.ProjectManagement.Domain.Entities;

public sealed class IssueLabel
{
    private IssueLabel() { }

    public IssueLabel(Guid issueId, Guid labelId)
    {
        Id      = Guid.NewGuid();
        IssueId = issueId;
        LabelId = labelId;
    }

    public Guid Id      { get; private set; }
    public Guid IssueId { get; private set; }
    public Guid LabelId { get; private set; }

    public Issue? Issue { get; private set; }
    public Label? Label { get; private set; }
}
