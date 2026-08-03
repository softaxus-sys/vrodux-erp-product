using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Orders.Dtos;

namespace Softaxis.Restaurant.Application.Orders.Commands;

/// <summary>One resolved slot selection — MenuItemId is the item actually being ordered for that
/// combo slot (must match the slot's own MenuItemId if it's a fixed slot, or belong to the slot's
/// CategoryId if it's a choose-one slot).</summary>
public sealed record ComboSelectionInput(Guid ComboItemId, Guid MenuItemId);

/// <summary>
/// POST /api/restaurant/orders/{id}/combo-items — orders a combo onto an existing order. Creates one
/// OrderItem per resolved slot, each priced proportionally so the group's sum equals the combo's fixed
/// Price, all tagged with a shared (new) ComboOrderItemId so KDS/receipts can group them as one line.
/// </summary>
public sealed record AddComboToOrderCommand(Guid OrderId, Guid ComboId, IReadOnlyList<ComboSelectionInput> Selections)
    : ICommand<OrderDto>;
