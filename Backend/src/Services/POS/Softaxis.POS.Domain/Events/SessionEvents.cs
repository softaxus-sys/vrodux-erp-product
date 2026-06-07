using Softaxis.BuildingBlocks.Domain.Events;

namespace Softaxis.POS.Domain.Events;

public sealed record SessionOpenedEvent(
    Guid   SessionId,
    Guid   CashierId,
    string RegisterId) : DomainEvent;

public sealed record SessionClosedEvent(
    Guid    SessionId,
    Guid    CashierId,
    decimal TotalSales,
    decimal TotalRefunds,
    decimal CashVariance) : DomainEvent;
