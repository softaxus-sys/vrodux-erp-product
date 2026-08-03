using Softaxis.Restaurant.Application.Orders.Dtos;
using Softaxis.Restaurant.Domain.Entities;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Orders;

internal static class OrderMappings
{
    public static OrderDto ToDto(Order o) => new(
        o.Id, o.OrderNumber, o.TableId, o.TableNumber, o.Waiter, o.Covers,
        o.Status, o.OrderType, o.OrderChannel, o.SubTotal, o.TaxAmount, o.DiscountAmount, o.Total,
        o.AmountPaid, o.TipAmount, o.Outstanding, o.PaymentMethod, o.Notes, o.CreatedAt,
        o.CurrentCourse,
        o.Items.Where(i => !i.IsDeleted).Select(i => new OrderItemDto(
            i.Id, i.MenuItemId, i.ItemName, i.Quantity, i.UnitPrice,
            i.LineTotal, i.Modifiers, i.Status, i.CourseNumber, i.ComboOrderItemId,
            i.SelectedModifiers.Select(m => new OrderItemModifierDto(m.Id, m.Name, m.PriceDelta)).ToList())).ToList(),
        o.Payments.OrderBy(p => p.CreatedAt).Select(p => new OrderPaymentDto(
            p.Id, p.Method, p.Amount, p.Reference, p.CreatedAt)).ToList(),
        o.BranchId, o.SessionId, o.CashierId,
        o.Discounts.OrderBy(d => d.CreatedAt).Select(d => new OrderDiscountDto(
            d.Id, d.Type, d.Amount, d.Reason, d.AppliedByUserId, d.ApprovedByUserId,
            d.IsVoided, d.VoidedByUserId, d.VoidReason, d.VoidedAt, d.CreatedAt)).ToList(),
        o.VoidLogs.OrderBy(v => v.CreatedAt).Select(v => new OrderVoidLogDto(
            v.Id, v.OrderItemId, v.Reason, v.VoidedByUserId, v.CreatedAt)).ToList(),
        o.Refunds.OrderBy(r => r.CreatedAt).Select(r => new OrderRefundDto(
            r.Id, r.Amount, r.Reason, r.Method, r.RefundedByUserId, r.CreatedAt)).ToList(),
        o.ParentOrderId, [], // Splits populated separately by GetOrderByIdHandler (needs a sibling query this mapper can't do)
        o.CustomerId);
}
