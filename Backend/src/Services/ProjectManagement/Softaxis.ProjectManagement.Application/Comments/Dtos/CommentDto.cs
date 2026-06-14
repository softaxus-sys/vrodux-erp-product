namespace Softaxis.ProjectManagement.Application.Comments.Dtos;

public sealed record CommentDto(Guid Id, Guid IssueId, string AuthorName, string Body, DateTime CreatedAt, DateTime? UpdatedAt);
