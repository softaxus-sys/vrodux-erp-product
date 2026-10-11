using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Manufacturing.Application.Planning;

/// <summary>
/// One component across every open production order: what is still to be issued, what Inventory
/// holds, and the gap to buy or make.
/// </summary>
public sealed record MaterialRequirementDto(
    Guid ProductId, string Name, string? Sku, string Unit, decimal Required, decimal? OnHand,
    decimal Shortage, decimal UnitCost, int OpenOrders);

public sealed record GetMaterialRequirementsQuery : IQuery<IReadOnlyList<MaterialRequirementDto>>;

/// <summary>Completed production of one product over a period: output, scrap and what it cost.</summary>
public sealed record ProductionYieldDto(
    Guid ProductId, string ProductName, string Unit, int Orders, decimal Planned, decimal Produced,
    decimal Scrapped, decimal YieldPercent, decimal MaterialCost, decimal LabourCost,
    decimal OverheadCost, decimal AverageUnitCost, decimal ScrapCost);

/// <param name="From">Completed on or after this day (yyyy-MM-dd).</param>
/// <param name="To">Completed on or before this day (yyyy-MM-dd).</param>
public sealed record GetProductionYieldQuery(string? From = null, string? To = null)
    : IQuery<IReadOnlyList<ProductionYieldDto>>;

/// <summary>
/// Work in progress: what has been put into an order that is still open. The total across open
/// orders is the WIP figure an accountant needs at period end.
/// </summary>
public sealed record WipRowDto(
    Guid OrderId, string OrderNumber, string ProductName, string Status, decimal PlannedQuantity, string Unit,
    decimal MaterialCost, decimal LabourCost, decimal OverheadCost, decimal TotalCost, string? DueDate);

public sealed record GetWipQuery : IQuery<IReadOnlyList<WipRowDto>>;

/// <summary>
/// How much work is queued at a work centre, against what it can do in a day.
/// </summary>
/// <param name="DaysQueued">Remaining hours ÷ daily capacity: working days needed to clear the queue.</param>
/// <param name="LatePressure">True when the queue cannot be cleared before the earliest due date.</param>
public sealed record WorkCentreLoadDto(
    Guid WorkCentreId, string Name, int OpenOperations, int OpenOrders, decimal RemainingMinutes,
    decimal CapacityHoursPerDay, decimal DaysQueued, string? EarliestDueDate, bool LatePressure);

public sealed record GetWorkCentreLoadQuery : IQuery<IReadOnlyList<WorkCentreLoadDto>>;

/// <summary>One open operation in due-date order: the running list a supervisor works down.</summary>
public sealed record ScheduleRowDto(
    Guid OrderId, string OrderNumber, string ProductName, string OperationName, string WorkCentreName,
    decimal PlannedMinutes, string? PlannedStartDate, string? DueDate, string Status);

public sealed record GetScheduleQuery : IQuery<IReadOnlyList<ScheduleRowDto>>;
