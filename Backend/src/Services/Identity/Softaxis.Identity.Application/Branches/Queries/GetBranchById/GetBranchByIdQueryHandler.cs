using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.Branches.Queries.GetBranchById;

public sealed class GetBranchByIdQueryHandler(IBranchRepository branchRepo)
    : IQueryHandler<GetBranchByIdQuery, BranchDto>
{
    public async Task<Result<BranchDto>> Handle(GetBranchByIdQuery query, CancellationToken ct)
    {
        var b = await branchRepo.GetByIdAsync(query.Id, ct);
        if (b is null) return Result.Failure<BranchDto>(Error.NotFoundById("Branch", query.Id));

        return Result.Success(new BranchDto(
            b.Id, b.Code, b.Name, b.Type, b.City, b.Country, b.Flag,
            b.Address, b.Phone, b.Email, b.Manager, b.Staff,
            b.Status, b.Currency, b.Timezone, b.OpenedDate,
            b.CreatedAt, b.UpdatedAt));
    }
}
