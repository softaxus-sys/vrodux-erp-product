using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.ProjectManagement.Application.Sprints.Dtos;

namespace Softaxis.ProjectManagement.Application.Sprints.Queries;

public sealed record GetSprintsQuery(Guid ProjectId) : IQuery<IReadOnlyList<SprintDto>>;
