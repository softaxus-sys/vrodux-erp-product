using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Trade.Application.InTransit;

/// <summary>One open shipment carrying this product.</summary>
public sealed record InTransitShipmentDto(
    Guid ShipmentId, string ShipmentNumber, string Direction, string Status, decimal Quantity, DateOnly? Eta);

/// <summary>
/// What is on its way, by product. <c>Incoming</c> is quantity on open imports (not yet delivered),
/// <c>Outgoing</c> on open exports. A line with no Inventory product is grouped by its description,
/// so cargo is still counted before anyone has linked it to a product.
/// </summary>
public sealed record InTransitProductDto(
    Guid? ProductId, string? Sku, string Description, string Unit, decimal Incoming, decimal Outgoing, int Shipments,
    DateOnly? NextEta, bool Delayed, IReadOnlyList<InTransitShipmentDto> Lines);

/// <param name="ProductId">Only this product (the Inventory product screen asks this way).</param>
/// <param name="Today">The caller's own calendar day, for "delayed".</param>
public sealed record GetInTransitQuery(Guid? ProductId, string? Search, DateOnly? Today)
    : IQuery<IReadOnlyList<InTransitProductDto>>;
