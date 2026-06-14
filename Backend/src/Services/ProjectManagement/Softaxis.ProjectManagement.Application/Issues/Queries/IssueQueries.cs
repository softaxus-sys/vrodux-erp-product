using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.ProjectManagement.Application.Issues.Dtos;

namespace Softaxis.ProjectManagement.Application.Issues.Queries;

public sealed record GetIssuesQuery(
    Guid ProjectId, Guid? SprintId = null, Guid? BoardColumnId = null, string? Type = null,
    string? AssigneeName = null, string? Search = null) : IQuery<IReadOnlyList<IssueSummaryDto>>;

public sealed record GetIssueByIdQuery(Guid Id) : IQuery<IssueDto>;
