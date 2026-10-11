using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Manufacturing.Application.Abstractions;
using Softaxis.Manufacturing.Application.Boms.Commands;
using Softaxis.Manufacturing.Application.Boms.Dtos;
using Softaxis.Manufacturing.Application.Boms.Queries;
using Softaxis.Manufacturing.Domain.Entities;
using Softaxis.Manufacturing.Infrastructure.Persistence;

namespace Softaxis.Manufacturing.Infrastructure.Handlers.Boms;

internal static class BomMappings
{
    public static BomSummaryDto ToSummary(BillOfMaterials b) => new(
        b.Id, b.BomNumber, b.Name, b.ProductId, b.ProductName, b.ProductSku, b.OutputQuantity, b.Unit,
        b.Status, b.Lines.Count, b.Operations.Count, b.MaterialCost, b.OperationCost, b.CostPerUnit, b.CreatedAt);

    public static BomDto ToDto(BillOfMaterials b) => new(
        b.Id, b.BomNumber, b.Name, b.ProductId, b.ProductName, b.ProductSku, b.OutputQuantity, b.Unit,
        b.Status, b.Notes, b.MaterialCost, b.OperationCost, b.CostPerUnit,
        b.Lines.OrderBy(l => l.SortOrder).Select(l => new BomLineDto(
            l.Id, l.ComponentProductId, l.ComponentName, l.ComponentSku, l.Quantity, l.Unit,
            l.ScrapPercent, l.UnitCost, l.EffectiveQuantity, l.LineCost, l.SortOrder)).ToList(),
        b.Operations.OrderBy(o => o.Sequence).Select(o => new BomOperationDto(
            o.Id, o.Sequence, o.Name, o.WorkCentreId, o.WorkCentreName, o.SetupMinutes,
            o.RunMinutesPerBatch, o.LabourRate, o.OverheadRate, o.BatchCost)).ToList(),
        b.ByProducts.OrderBy(x => x.ProductName).Select(x => new BomByProductDto(
            x.Id, x.ProductId, x.ProductName, x.ProductSku, x.Quantity, x.Unit)).ToList(),
        b.CreatedAt, b.UpdatedAt);
}

/// <summary>
/// Turns the submitted component list into BOM lines, reading each component's name, SKU, unit
/// and cost from Inventory so a BOM can never name a product that does not exist.
/// </summary>
internal static class BomLineBuilder
{
    public static async Task<Result<List<BomLine>>> BuildAsync(
        Guid bomId, Guid finishedProductId, IReadOnlyList<BomLineInput> inputs,
        IManufacturingStock stock, CancellationToken ct)
    {
        if (inputs.Any(i => i.ComponentProductId == finishedProductId))
            return Result.Failure<List<BomLine>>(Error.Custom("Bom.Conflict",
                "A product cannot be a component of itself."));

        if (inputs.GroupBy(i => i.ComponentProductId).Any(g => g.Count() > 1))
            return Result.Failure<List<BomLine>>(Error.Custom("Bom.Conflict",
                "The same component is listed more than once. Combine it into one line."));

        var lines = new List<BomLine>(inputs.Count);
        for (var i = 0; i < inputs.Count; i++)
        {
            var input = inputs[i];
            var item  = await stock.GetItemAsync(input.ComponentProductId, ct);
            if (item is null)
                return Result.Failure<List<BomLine>>(Error.Custom("Bom.Component.NotFound",
                    $"Component on line {i + 1} was not found in Inventory."));

            lines.Add(new BomLine(bomId, item.Id, item.Name, item.Sku, input.Quantity,
                string.IsNullOrWhiteSpace(input.Unit) ? item.Unit : input.Unit!,
                input.ScrapPercent, item.CostPrice, i));
        }
        return Result.Success(lines);
    }
}

/// <summary>
/// Turns the submitted routing into BOM operations, taking each step's rates from its work centre.
/// </summary>
internal static class BomOperationBuilder
{
    public static async Task<Result<List<BomOperation>>> BuildAsync(
        Guid bomId, IReadOnlyList<BomOperationInput>? inputs, ManufacturingDbContext db, CancellationToken ct)
    {
        var operations = new List<BomOperation>();
        if (inputs is null || inputs.Count == 0) return Result.Success(operations);

        var ids     = inputs.Select(i => i.WorkCentreId).Distinct().ToList();
        var centres = await db.WorkCentres.AsNoTracking()
            .Where(w => ids.Contains(w.Id) && !w.IsDeleted).ToDictionaryAsync(w => w.Id, ct);

        for (var i = 0; i < inputs.Count; i++)
        {
            var input = inputs[i];
            if (!centres.TryGetValue(input.WorkCentreId, out var centre))
                return Result.Failure<List<BomOperation>>(Error.Custom("Bom.WorkCentre.NotFound",
                    $"The work centre for operation {i + 1} was not found."));

            operations.Add(new BomOperation(bomId, (i + 1) * 10, input.Name, centre.Id, centre.Name,
                input.SetupMinutes, input.RunMinutesPerBatch, centre.LabourRatePerHour, centre.OverheadRatePerHour));
        }
        return Result.Success(operations);
    }
}

internal static class BomByProductBuilder
{
    public static async Task<Result<List<BomByProduct>>> BuildAsync(
        Guid bomId, Guid finishedProductId, IReadOnlyList<BomByProductInput>? inputs,
        IManufacturingStock stock, CancellationToken ct)
    {
        var result = new List<BomByProduct>();
        if (inputs is null) return Result.Success(result);

        foreach (var input in inputs.Where(i => i.Quantity > 0))
        {
            if (input.ProductId == finishedProductId)
                return Result.Failure<List<BomByProduct>>(Error.Custom("Bom.Conflict",
                    "The finished product cannot also be listed as a by-product."));
            if (result.Any(r => r.ProductId == input.ProductId)) continue;

            var item = await stock.GetItemAsync(input.ProductId, ct);
            if (item is null)
                return Result.Failure<List<BomByProduct>>(Error.Custom("Bom.ByProduct.NotFound",
                    "One of the by-products was not found in Inventory."));

            result.Add(new BomByProduct(bomId, item.Id, item.Name, item.Sku, input.Quantity, item.Unit));
        }
        return Result.Success(result);
    }
}

internal sealed class GetBomsHandler(ManufacturingDbContext db)
    : IQueryHandler<GetBomsQuery, IReadOnlyList<BomSummaryDto>>
{
    public async Task<Result<IReadOnlyList<BomSummaryDto>>> Handle(GetBomsQuery q, CancellationToken ct)
    {
        var query = db.Boms.AsNoTracking().Include(b => b.Lines).Include(b => b.Operations)
            .AsSplitQuery().Where(b => !b.IsDeleted);

        if (!string.IsNullOrWhiteSpace(q.Status))
            query = query.Where(b => b.Status == q.Status);

        if (q.ProductId is { } productId)
            query = query.Where(b => b.ProductId == productId);

        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            query = query.Where(b => b.Name.Contains(s) || b.ProductName.Contains(s) || b.BomNumber.Contains(s));
        }

        var boms = await query.OrderByDescending(b => b.CreatedAt).ToListAsync(ct);
        return Result.Success<IReadOnlyList<BomSummaryDto>>(boms.Select(BomMappings.ToSummary).ToList());
    }
}

internal sealed class GetBomByIdHandler(ManufacturingDbContext db) : IQueryHandler<GetBomByIdQuery, BomDto>
{
    public async Task<Result<BomDto>> Handle(GetBomByIdQuery q, CancellationToken ct)
    {
        var bom = await db.Boms.AsNoTracking().Include(b => b.Lines).Include(b => b.Operations)
            .Include(b => b.ByProducts).AsSplitQuery().FirstOrDefaultAsync(b => b.Id == q.Id && !b.IsDeleted, ct);

        return bom is null
            ? Result.Failure<BomDto>(Error.NotFoundById("Bom", q.Id))
            : Result.Success(BomMappings.ToDto(bom));
    }
}

internal sealed class CreateBomHandler(ManufacturingDbContext db, IManufacturingStock stock)
    : ICommandHandler<CreateBomCommand, BomDto>
{
    public async Task<Result<BomDto>> Handle(CreateBomCommand cmd, CancellationToken ct)
    {
        var product = await stock.GetItemAsync(cmd.ProductId, ct);
        if (product is null)
            return Result.Failure<BomDto>(Error.Custom("Bom.Product.NotFound",
                "The finished product was not found in Inventory."));

        var bom = new BillOfMaterials(cmd.Name, product.Id, product.Name, product.Sku, cmd.OutputQuantity,
            string.IsNullOrWhiteSpace(cmd.Unit) ? product.Unit : cmd.Unit!, cmd.Notes);

        var lines = await BomLineBuilder.BuildAsync(bom.Id, product.Id, cmd.Lines, stock, ct);
        if (lines.IsFailure) return Result.Failure<BomDto>(lines.Error);

        var operations = await BomOperationBuilder.BuildAsync(bom.Id, cmd.Operations, db, ct);
        if (operations.IsFailure) return Result.Failure<BomDto>(operations.Error);

        var byProducts = await BomByProductBuilder.BuildAsync(bom.Id, product.Id, cmd.ByProducts, stock, ct);
        if (byProducts.IsFailure) return Result.Failure<BomDto>(byProducts.Error);

        bom.ReplaceLines(lines.Value);
        bom.ReplaceOperations(operations.Value);
        bom.ReplaceByProducts(byProducts.Value);
        db.Boms.Add(bom);
        await db.SaveChangesAsync(ct);
        return Result.Success(BomMappings.ToDto(bom));
    }
}

internal sealed class UpdateBomHandler(ManufacturingDbContext db, IManufacturingStock stock)
    : ICommandHandler<UpdateBomCommand, BomDto>
{
    public async Task<Result<BomDto>> Handle(UpdateBomCommand cmd, CancellationToken ct)
    {
        var bom = await db.Boms.Include(b => b.Lines).Include(b => b.Operations).Include(b => b.ByProducts)
            .AsSplitQuery().FirstOrDefaultAsync(b => b.Id == cmd.Id && !b.IsDeleted, ct);
        if (bom is null) return Result.Failure<BomDto>(Error.NotFoundById("Bom", cmd.Id));

        var product = await stock.GetItemAsync(cmd.ProductId, ct);
        if (product is null)
            return Result.Failure<BomDto>(Error.Custom("Bom.Product.NotFound",
                "The finished product was not found in Inventory."));

        var lines = await BomLineBuilder.BuildAsync(bom.Id, product.Id, cmd.Lines, stock, ct);
        if (lines.IsFailure) return Result.Failure<BomDto>(lines.Error);

        bom.Update(cmd.Name, product.Id, product.Name, product.Sku, cmd.OutputQuantity,
            string.IsNullOrWhiteSpace(cmd.Unit) ? product.Unit : cmd.Unit!, cmd.Notes);

        // Lines are replaced wholesale. Orders already created hold their own copy of the
        // components, so this never changes work in progress.
        var operations = await BomOperationBuilder.BuildAsync(bom.Id, cmd.Operations, db, ct);
        if (operations.IsFailure) return Result.Failure<BomDto>(operations.Error);

        db.BomLines.RemoveRange(bom.Lines);
        bom.ReplaceLines(lines.Value);
        db.BomLines.AddRange(lines.Value);

        db.BomOperations.RemoveRange(bom.Operations);
        bom.ReplaceOperations(operations.Value);
        db.BomOperations.AddRange(operations.Value);

        var byProducts = await BomByProductBuilder.BuildAsync(bom.Id, product.Id, cmd.ByProducts, stock, ct);
        if (byProducts.IsFailure) return Result.Failure<BomDto>(byProducts.Error);
        db.BomByProducts.RemoveRange(bom.ByProducts);
        bom.ReplaceByProducts(byProducts.Value);
        db.BomByProducts.AddRange(byProducts.Value);

        await db.SaveChangesAsync(ct);
        return Result.Success(BomMappings.ToDto(bom));
    }
}

internal sealed class SetBomStatusHandler(ManufacturingDbContext db) : ICommandHandler<SetBomStatusCommand>
{
    public async Task<Result> Handle(SetBomStatusCommand cmd, CancellationToken ct)
    {
        if (!BomStatus.All.Contains(cmd.Status))
            return Result.Failure(Error.Custom("Bom.InvalidStatus", $"'{cmd.Status}' is not a BOM status."));

        var bom = await db.Boms.FirstOrDefaultAsync(b => b.Id == cmd.Id && !b.IsDeleted, ct);
        if (bom is null) return Result.Failure(Error.NotFoundById("Bom", cmd.Id));

        bom.SetStatus(cmd.Status);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class DeleteBomHandler(ManufacturingDbContext db) : ICommandHandler<DeleteBomCommand>
{
    private static readonly string[] OpenStatuses =
        [ProductionOrderStatus.Planned, ProductionOrderStatus.Released, ProductionOrderStatus.InProgress];

    public async Task<Result> Handle(DeleteBomCommand cmd, CancellationToken ct)
    {
        var bom = await db.Boms.FirstOrDefaultAsync(b => b.Id == cmd.Id && !b.IsDeleted, ct);
        if (bom is null) return Result.Failure(Error.NotFoundById("Bom", cmd.Id));

        var open = await db.ProductionOrders.CountAsync(
            o => o.BomId == cmd.Id && !o.IsDeleted && OpenStatuses.Contains(o.Status), ct);
        if (open > 0)
            return Result.Failure(Error.Custom("Bom.Conflict",
                $"{open} open production order(s) use this bill of materials. Complete or cancel them first, or archive the BOM instead."));

        bom.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
