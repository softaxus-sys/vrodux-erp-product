namespace Softaxis.Construction.Application.Boqs.Dtos;

public sealed record BoqItemDto(
    Guid Id, string ItemCode, string Description, string Unit,
    decimal Quantity, decimal UnitRate, decimal Amount,
    decimal CompletedQty, decimal CompletedAmt);

public sealed record BoqDto(
    Guid Id, string ProjectId, string ProjectName, string Status,
    string? ApprovedBy, string? ApprovedDate,
    decimal TotalValue, decimal CompletedValue,
    IReadOnlyList<BoqItemDto> Items);

public sealed record BoqsSummaryDto(
    int Total, int Draft, int Approved,
    decimal TotalValue, decimal CompletedValue, double CompletionPct);
