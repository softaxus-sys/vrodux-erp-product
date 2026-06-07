using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Application.Abstractions;
using Softaxis.Inventory.Application.DTOs;

namespace Softaxis.Inventory.Application.Products.Queries.GetProductById;

public sealed class GetProductByIdQueryHandler(IProductReadService readService)
    : IQueryHandler<GetProductByIdQuery, ProductDto>
{
    public async Task<Result<ProductDto>> Handle(GetProductByIdQuery query, CancellationToken ct)
    {
        var dto = await readService.GetByIdAsync(query.Id, ct);

        return dto is null
            ? Result.Failure<ProductDto>(Error.Custom("Product.NotFound", $"Product '{query.Id}' not found."))
            : Result.Success(dto);
    }
}
