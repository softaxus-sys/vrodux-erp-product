using Softaxis.BuildingBlocks.Domain.Events;
using Softaxis.POS.Domain.Enums;

namespace Softaxis.POS.Domain.Events;

public sealed record TransactionCompletedEvent(
    Guid            TransactionId,
    Guid            SessionId,
    Guid            CashierId,
    Guid?           CustomerId,
    decimal         TotalAmount,
    TransactionType Type) : DomainEvent;

public sealed record TransactionVoidedEvent(
    Guid    TransactionId,
    Guid    SessionId,
    Guid    RequestedBy,
    decimal Amount) : DomainEvent;

public sealed record TransactionRefundedEvent(
    Guid    OriginalTransactionId,
    Guid    RefundTransactionId,
    decimal RefundAmount) : DomainEvent;
