using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.ProjectManagement.Application.Comments.Dtos;

namespace Softaxis.ProjectManagement.Application.Comments.Queries;

public sealed record GetCommentsQuery(Guid IssueId) : IQuery<IReadOnlyList<CommentDto>>;
