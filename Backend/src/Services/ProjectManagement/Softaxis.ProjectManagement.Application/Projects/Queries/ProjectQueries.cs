using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.ProjectManagement.Application.Projects.Dtos;

namespace Softaxis.ProjectManagement.Application.Projects.Queries;

/// <summary>Returns all projects with issue counts by board-column category.</summary>
public sealed record GetProjectsQuery : IQuery<IReadOnlyList<ProjectSummaryDto>>;

public sealed record GetProjectByIdQuery(Guid Id) : IQuery<ProjectDto>;
