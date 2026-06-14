using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.ProjectManagement.Application.Labels.Dtos;

namespace Softaxis.ProjectManagement.Application.Labels.Queries;

public sealed record GetLabelsQuery(Guid ProjectId) : IQuery<IReadOnlyList<LabelDto>>;
