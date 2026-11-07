using MediatR;
using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Ecommerce.Application.Shop;
using Softaxis.Ecommerce.Infrastructure.Persistence;
using Softaxis.Ecommerce.Infrastructure.Services.Shop;
using Softaxis.Inventory.Application.ProductTemplates;

namespace Softaxis.Ecommerce.Infrastructure.Handlers.Shop;

internal sealed class GetShopImageHandler(ShopGate gate, ISender sender) : IQueryHandler<GetShopImageQuery, ShopFileDto>
{
    public async Task<Result<ShopFileDto>> Handle(GetShopImageQuery q, CancellationToken ct)
    {
        var door = await gate.OpenAsync(q.Slug, ct);
        if (door.IsFailure) return Result.Failure<ShopFileDto>(door.Error);
        door.Value.Enter();

        var template = await sender.Send(new GetProductTemplateByIdQuery(q.TemplateId), ct);
        if (template.IsFailure || !template.Value.PublishedOnline || !template.Value.IsActive) return Result.Failure<ShopFileDto>(ShopErrors.NoProduct);

        var file = await sender.Send(new GetTemplateImageQuery(q.TemplateId, q.ImageId), ct);
        return file.IsFailure ? Result.Failure<ShopFileDto>(ShopErrors.NoProduct) : Result.Success(new ShopFileDto(file.Value.Data, file.Value.ContentType));
    }
}

internal sealed class GetShopAssetHandler(ShopGate gate, EcommerceDbContext db) : IQueryHandler<GetShopAssetQuery, ShopFileDto>
{
    public async Task<Result<ShopFileDto>> Handle(GetShopAssetQuery q, CancellationToken ct)
    {
        // Logo and banners belong to the storefront, so they are shown even before the store is opened (the owner previews it).
        var door = await gate.OpenAsync(q.Slug, ct, requirePublished: false);
        if (door.IsFailure) return Result.Failure<ShopFileDto>(door.Error);
        door.Value.Enter();

        var a = await db.Assets.AsNoTracking().Where(x => x.Id == q.AssetId && !x.IsDeleted).Select(x => new { x.Data, x.ContentType }).FirstOrDefaultAsync(ct);
        return a is null ? Result.Failure<ShopFileDto>(ShopErrors.NoProduct) : Result.Success(new ShopFileDto(a.Data, a.ContentType));
    }
}
