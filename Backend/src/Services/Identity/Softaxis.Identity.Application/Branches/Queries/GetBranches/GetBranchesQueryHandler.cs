using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.Branches.Queries.GetBranches;

public sealed class GetBranchesQueryHandler(IBranchRepository branchRepo)
    : IQueryHandler<GetBranchesQuery, PagedResult<BranchDto>>
{
    public async Task<Result<PagedResult<BranchDto>>> Handle(GetBranchesQuery query, CancellationToken ct)
    {
        var paged = await branchRepo.GetPagedAsync(query.Page, query.PageSize, query.Status, ct);

        var dtos = paged.Items.Select(b => new BranchDto(
            b.Id, b.Code, b.Name, b.Type, b.City, b.Country, b.Flag,
            b.Address, b.Phone, b.Email, b.Manager, b.Staff,
            b.Status, b.Currency, b.Timezone, b.OpenedDate,
            b.CreatedAt, b.UpdatedAt)).ToList();

        return Result.Success(PagedResult<BranchDto>.Create(dtos, paged.TotalCount, paged.Page, paged.PageSize));
    }
}
