using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Construction.Application.Projects.Dtos;

namespace Softaxis.Construction.Application.Projects.Queries;

public sealed record GetProjectsQuery : IQuery<IReadOnlyList<ProjectDto>>;

public sealed record GetProjectByIdQuery(Guid Id) : IQuery<ProjectDto>;

public sealed record GetProjectsSummaryQuery : IQuery<ProjectsSummaryDto>;
