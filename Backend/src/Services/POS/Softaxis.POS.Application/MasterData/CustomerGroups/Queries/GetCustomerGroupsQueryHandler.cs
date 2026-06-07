using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.MasterData.CustomerGroups.Queries;

public sealed record GetCustomerGroupsQuery : IQuery<List<CustomerGroupDto>>;

public sealed class GetCustomerGroupsQueryHandler(ICustomerGroupRepository repo)
    : IQueryHandler<GetCustomerGroupsQuery, List<CustomerGroupDto>>
{
    public async Task<Result<List<CustomerGroupDto>>> Handle(GetCustomerGroupsQuery q, CancellationToken ct)
    {
        var items = await repo.GetAllAsync(ct);
        var dtos  = items.Select(g => new CustomerGroupDto(
            g.Id, g.Name, g.Code, g.DiscountPercent, g.MinPurchase,
            g.Description, g.IsDefault, g.IsActive, g.IsSystem,
            g.CreatedAt, g.UpdatedAt)).ToList();
        return Result.Success(dtos);
    }
}
