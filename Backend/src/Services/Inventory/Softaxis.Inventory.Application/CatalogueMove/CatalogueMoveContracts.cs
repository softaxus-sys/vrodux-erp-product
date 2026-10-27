using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Inventory.Application.CatalogueMove;

public sealed record SkuClashDto(Guid PosProductId, string PosName, string Value, Guid InventoryProductId, string InventoryName);

public sealed record MoveBranchDto(Guid BranchId, string Name, bool HasWarehouse, int Products, decimal Units);

public sealed record MoveCountsDto(
    int PosProducts,
    int AlreadyInInventory,
    int CategoriesUsed,
    int CategoriesToCreate,
    int ProductsWithBranchStock,
    int NegativeStock);

/// <summary>What a move would do, and whether it may go ahead. Reading this changes nothing.</summary>
public sealed record CatalogueMovePreviewDto(
    Guid     TenantId,
    string   TenantName,
    /// <summary>on_pos | on_inventory | empty — where this workspace's catalogue is today.</summary>
    string   State,
    bool     CanMove,
    IReadOnlyList<string> Blockers,
    IReadOnlyList<string> Warnings,
    MoveCountsDto Counts,
    decimal  HeadOfficeUnits,
    decimal  BranchUnits,
    bool     MainWarehouseWillBeCreated,
    IReadOnlyList<MoveBranchDto> Branches,
    IReadOnlyList<SkuClashDto> SkuClashes,
    IReadOnlyList<SkuClashDto> BarcodeClashes);

public sealed record CatalogueMoveRecordDto(
    DateTime MovedAt, string MovedBy, int ProductsMoved, int AlreadyThere,
    int CategoriesCreated, int WarehousesCreated, int StockBuckets);

public sealed record CatalogueMoveStatusDto(
    Guid TenantId, string TenantName, string State,
    int PosProducts, int InventoryProducts, CatalogueMoveRecordDto? LastMove);

public sealed record GetCatalogueMoveStatusQuery(Guid TenantId) : IQuery<CatalogueMoveStatusDto>;
public sealed record PreviewCatalogueMoveQuery(Guid TenantId) : IQuery<CatalogueMovePreviewDto>;

/// <param name="MovedBy">The super admin who ran it — kept on the record.</param>
public sealed record RunCatalogueMoveCommand(Guid TenantId, string MovedBy) : ICommand<CatalogueMoveRecordDto>;
