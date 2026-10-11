using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Trade.Application.Dashboard;

public sealed record StatusCountDto(string Status, int Count);

/// <summary>One thing that needs attention, with the shipment it belongs to.</summary>
public sealed record AttentionDto(
    string Kind, Guid ShipmentId, string ShipmentNumber, string Direction, string Label, DateOnly? Date, int? Days);

public sealed record TradeDashboardDto(
    int OpenImports, int OpenExports, int ArrivingSoon, int Delayed, int AtCustoms,
    decimal OpenGoodsValue, decimal PaymentsDue, int PaymentsOverdue, int DocumentsExpiring, int DocumentsExpired,
    IReadOnlyList<StatusCountDto> ByStatus,
    IReadOnlyList<AttentionDto> Attention,
    IReadOnlyList<Shipments.ShipmentSummaryDto> Recent,
    bool CanSeePayments);

/// <param name="Today">The caller's own calendar day; the server's clock is UTC.</param>
public sealed record GetTradeDashboardQuery(DateOnly? Today) : IQuery<TradeDashboardDto>;
