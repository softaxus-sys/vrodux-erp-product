namespace Softaxis.Manufacturing.Application.ProductionOrders.Dtos;

public sealed record ProductionOrderSummaryDto(
    Guid Id, string OrderNumber, string BomNumber, Guid ProductId, string ProductName, string? ProductSku,
    decimal PlannedQuantity, decimal ProducedQuantity, decimal ScrappedQuantity, string Unit, string Status,
    string? WarehouseName, string? PlannedStartDate, string? DueDate, string? Reference,
    decimal MaterialCost, decimal LabourCost, decimal OverheadCost, decimal TotalCost, decimal UnitCost,
    string? ParentOrderNumber, bool IsPosted, DateTime CreatedAt, DateTime? CompletedAt);

public sealed record ProductionOrderComponentDto(
    Guid Id, Guid ProductId, string Name, string? Sku, decimal RequiredQuantity, decimal IssuedQuantity,
    decimal RemainingQuantity, string Unit, decimal UnitCost,
    // What the order can draw right now (its warehouse when Inventory tracks it reliably, else the
    // product total); null when the product can no longer be found.
    decimal? StockOnHand, int SortOrder);

public sealed record ProductionOrderOperationDto(
    Guid Id, int Sequence, string Name, string WorkCentreName, decimal PlannedMinutes,
    decimal ActualMinutes, bool IsDone, decimal LabourCost, decimal OverheadCost);

public sealed record ProductionOrderOutputDto(
    Guid Id, Guid ProductId, string Name, string? Sku, string Unit, decimal PlannedQuantity, decimal ReceivedQuantity);

/// <summary>One issue (positive) or return (negative) of a component, with its batch.</summary>
public sealed record MaterialIssueDto(Guid Id, string ProductName, decimal Quantity, string? BatchNumber, DateTime CreatedAt);

public sealed record SubOrderDto(Guid Id, string OrderNumber, string ProductName, decimal PlannedQuantity, string Unit, string Status);

public sealed record ProductionOrderDto(
    Guid Id, string OrderNumber, Guid BomId, string BomNumber, Guid ProductId, string ProductName,
    string? ProductSku, decimal PlannedQuantity, decimal ProducedQuantity, decimal ScrappedQuantity,
    string Unit, string Status, Guid? WarehouseId, string? WarehouseName, string? PlannedStartDate,
    string? DueDate, string? Reference, string? Notes, string? QualityNotes,
    decimal MaterialCost, decimal LabourCost, decimal OverheadCost, decimal TotalCost, decimal UnitCost,
    decimal ScrapCost, string? BatchNumber, string? ExpiryDate, string? RequisitionNumber,
    Guid? ParentOrderId, string? ParentOrderNumber,
    Guid? JournalEntryId, string? JournalEntryNumber,
    DateTime CreatedAt, DateTime? ReleasedAt, DateTime? StartedAt, DateTime? CompletedAt,
    IReadOnlyList<ProductionOrderComponentDto> Components,
    IReadOnlyList<ProductionOrderOperationDto> Operations,
    IReadOnlyList<ProductionOrderOutputDto> Outputs,
    IReadOnlyList<MaterialIssueDto> Issues,
    IReadOnlyList<SubOrderDto> SubOrders);

public sealed record ProductionSummaryDto(
    int Planned, int Released, int InProgress, int Completed, int Cancelled,
    int Overdue, int ActiveBoms, decimal CompletedMaterialCost);
