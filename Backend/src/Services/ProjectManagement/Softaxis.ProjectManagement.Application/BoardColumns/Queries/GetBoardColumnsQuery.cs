using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.ProjectManagement.Application.BoardColumns.Dtos;

namespace Softaxis.ProjectManagement.Application.BoardColumns.Queries;

public sealed record GetBoardColumnsQuery(Guid ProjectId) : IQuery<IReadOnlyList<BoardColumnDto>>;
