namespace Softaxis.Restaurant.Application.Orders.Dtos;

public sealed record OrderItemModifierDto(Guid Id, string Name, decimal PriceDelta);

public sealed record OrderItemDto(
    Guid Id,
    Guid MenuItemId,
    string ItemName,
    int Quantity,
    decimal UnitPrice,
    decimal LineTotal,
    string? Modifiers,
    string Status,
    int CourseNumber,
    Guid? ComboOrderItemId,
    IReadOnlyList<OrderItemModifierDto> SelectedModifiers);

public sealed record OrderPaymentDto(
    Guid Id,
    string Method,
    decimal Amount,
    string? Reference,
    DateTime CreatedAt);

public sealed record OrderDiscountDto(
    Guid Id,
    string Type,
    decimal Amount,
    string Reason,
    Guid AppliedByUserId,
    Guid? ApprovedByUserId,
    bool IsVoided,
    Guid? VoidedByUserId,
    string? VoidReason,
    DateTime? VoidedAt,
    DateTime CreatedAt);

public sealed record OrderVoidLogDto(
    Guid Id,
    Guid? OrderItemId,
    string Reason,
    Guid VoidedByUserId,
    DateTime CreatedAt);

public sealed record OrderRefundDto(
    Guid Id,
    decimal Amount,
    string Reason,
    string Method,
    Guid RefundedByUserId,
    DateTime CreatedAt);

/// <summary>Lightweight summary of one split-bill child — enough for the parent's overview panel
/// without a separate fetch per split.</summary>
public sealed record OrderSplitSummaryDto(
    Guid Id,
    string OrderNumber,
    string Status,
    decimal Total,
    decimal AmountPaid,
    decimal Outstanding);

public sealed record OrderDto(
    Guid Id,
    string OrderNumber,
    Guid TableId,
    string TableNumber,
    string Waiter,
    int Covers,
    string Status,
    string OrderType,
    string OrderChannel,
    decimal SubTotal,
    decimal TaxAmount,
    decimal DiscountAmount,
    decimal Total,
    decimal AmountPaid,
    decimal TipAmount,
    decimal Outstanding,
    string? PaymentMethod,
    string? Notes,
    DateTime CreatedAt,
    int CurrentCourse,
    IReadOnlyList<OrderItemDto> Items,
    IReadOnlyList<OrderPaymentDto> Payments,
    Guid? BranchId,
    Guid? SessionId,
    Guid? CashierId,
    IReadOnlyList<OrderDiscountDto> Discounts,
    IReadOnlyList<OrderVoidLogDto> VoidLogs,
    IReadOnlyList<OrderRefundDto> Refunds,
    Guid? ParentOrderId,
    IReadOnlyList<OrderSplitSummaryDto> Splits,
    Guid? CustomerId);

public sealed record OrdersSummaryDto(
    int Total,
    int Open,
    int Sent,
    int Ready,
    int Served,
    int Paid,
    int Cancelled,
    int Split,
    int Held,
    int TodayOrders,
    decimal TodayRevenue,
    decimal TotalRevenue,
    decimal TotalTips);

/// <summary>Small projection for the simple state-transition endpoints (send/ready/serve/cancel).</summary>
public sealed record OrderStatusDto(Guid Id, string Status);

public sealed record OrderLineInput(
    Guid MenuItemId, int Quantity, string? Modifiers, IReadOnlyList<Guid>? SelectedModifierIds = null,
    int? CourseNumber = null);

/// <summary>One bucket in a bill split — the existing OrderItem ids that should move onto this
/// group's new child order. Every non-deleted item on the order must appear in exactly one group.</summary>
public sealed record SplitGroupInput(IReadOnlyList<Guid> ItemIds);
