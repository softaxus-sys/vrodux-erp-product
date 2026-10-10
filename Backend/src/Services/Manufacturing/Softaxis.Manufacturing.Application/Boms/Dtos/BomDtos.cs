namespace Softaxis.Manufacturing.Application.Boms.Dtos;

public sealed record BomSummaryDto(
    Guid Id, string BomNumber, string Name, Guid ProductId, string ProductName, string? ProductSku,
    decimal OutputQuantity, string Unit, string Status, int LineCount, int OperationCount,
    decimal MaterialCost, decimal OperationCost, decimal CostPerUnit, DateTime CreatedAt);

public sealed record BomLineDto(
    Guid Id, Guid ComponentProductId, string ComponentName, string? ComponentSku,
    decimal Quantity, string Unit, decimal ScrapPercent, decimal UnitCost,
    decimal EffectiveQuantity, decimal LineCost, int SortOrder);

public sealed record BomOperationDto(
    Guid Id, int Sequence, string Name, Guid WorkCentreId, string WorkCentreName,
    decimal SetupMinutes, decimal RunMinutesPerBatch, decimal LabourRate, decimal OverheadRate,
    decimal BatchCost);

public sealed record BomByProductDto(Guid Id, Guid ProductId, string ProductName, string? ProductSku, decimal Quantity, string Unit);

public sealed record BomDto(
    Guid Id, string BomNumber, string Name, Guid ProductId, string ProductName, string? ProductSku,
    decimal OutputQuantity, string Unit, string Status, string? Notes,
    decimal MaterialCost, decimal OperationCost, decimal CostPerUnit,
    IReadOnlyList<BomLineDto> Lines, IReadOnlyList<BomOperationDto> Operations,
    IReadOnlyList<BomByProductDto> ByProducts,
    DateTime CreatedAt, DateTime? UpdatedAt);
