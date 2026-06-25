using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.ProjectManagement.Application.Issues.Dtos;
using Softaxis.ProjectManagement.Application.Issues.Queries;
using Softaxis.ProjectManagement.Domain.Entities;
using Softaxis.ProjectManagement.Infrastructure.Persistence;
using Softaxis.ProjectManagement.Infrastructure.Services;

namespace Softaxis.ProjectManagement.Infrastructure.Handlers.Issues;

internal sealed class GetIssueByIdHandler(ProjectManagementDbContext db, IProjectAccessGuard accessGuard)
    : IQueryHandler<GetIssueByIdQuery, IssueDto>
{
    public async Task<Result<IssueDto>> Handle(GetIssueByIdQuery query, CancellationToken ct)
    {
        var dto = await IssueMappings.LoadDtoAsync(db, query.Id, ct);
        if (dto is null || !await accessGuard.CanAccessAsync(dto.ProjectId, ct))
            return Result.Failure<IssueDto>(Error.NotFoundById(nameof(Issue), query.Id));

        return Result.Success(dto);
    }
}
