using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Restaurant.API.Authorization;
using Softaxis.Restaurant.API.Controllers.Common;
using Softaxis.Restaurant.Application.Orders.Commands;
using Softaxis.Restaurant.Application.Orders.Dtos;
using Softaxis.Restaurant.Application.Orders.Queries;

namespace Softaxis.Restaurant.API.Controllers;

[ApiController][Route("api/restaurant/orders")][Authorize]
public sealed class OrdersController(ISender sender) : RestaurantControllerBase
{
    /// <summary>GET /api/restaurant/orders/summary</summary>
    [HttpGet("summary")]
    [RequirePermission("restaurant.orders.view")]
    public async Task<IActionResult> GetSummary(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetOrdersSummaryQuery(), ct));

    /// <summary>GET /api/restaurant/orders?status=</summary>
    [HttpGet]
    [RequirePermission("restaurant.orders.view")]
    public async Task<IActionResult> GetAll([FromQuery] string? status, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetOrdersQuery(status), ct));

    /// <summary>GET /api/restaurant/orders/{id}</summary>
    [HttpGet("{id:guid}")]
    [RequirePermission("restaurant.orders.view")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetOrderByIdQuery(id), ct));

    /// <summary>POST /api/restaurant/orders</summary>
    [HttpPost]
    [RequirePermission("restaurant.orders.create")]
    public async Task<IActionResult> Create([FromBody] CreateOrderReq req, CancellationToken ct)
    {
        var cmd = new CreateOrderCommand(req.TableId, req.Waiter, req.Covers, req.OrderType, req.Notes,
            req.Items.Select(i => new OrderLineInput(i.MenuItemId, i.Quantity, i.Modifiers, i.SelectedModifierIds, i.CourseNumber)).ToList(),
            req.BranchId, req.SessionId, req.CustomerId);
        var result = await sender.Send(cmd, ct);
        return CreatedOrError(result, nameof(GetById), result.IsSuccess ? new { id = result.Value.Id } : null!);
    }

    /// <summary>POST /api/restaurant/orders/{id}/items</summary>
    [HttpPost("{id:guid}/items")]
    [RequirePermission("restaurant.orders.edit")]
    public async Task<IActionResult> AddItems(Guid id, [FromBody] AddItemsReq req, CancellationToken ct)
    {
        var cmd = new AddOrderItemsCommand(id,
            req.Items.Select(i => new OrderLineInput(i.MenuItemId, i.Quantity, i.Modifiers, i.SelectedModifierIds, i.CourseNumber)).ToList());
        return OkOrError(await sender.Send(cmd, ct));
    }

    /// <summary>POST /api/restaurant/orders/{id}/combo-items — orders a combo, fanning out into its resolved component items.</summary>
    [HttpPost("{id:guid}/combo-items")]
    [RequirePermission("restaurant.orders.edit")]
    public async Task<IActionResult> AddCombo(Guid id, [FromBody] AddComboReq req, CancellationToken ct) =>
        OkOrError(await sender.Send(new AddComboToOrderCommand(id, req.ComboId,
            req.Selections.Select(s => new ComboSelectionInput(s.ComboItemId, s.MenuItemId)).ToList()), ct));

    /// <summary>PATCH /api/restaurant/orders/{id}/fire-next-course — releases the next course to the kitchen.</summary>
    [HttpPatch("{id:guid}/fire-next-course")]
    [RequirePermission("restaurant.orders.edit")]
    public async Task<IActionResult> FireNextCourse(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new FireNextCourseCommand(id), ct));

    /// <summary>POST /api/restaurant/orders/{id}/send-receipt — emails or WhatsApps a digital receipt.</summary>
    [HttpPost("{id:guid}/send-receipt")]
    [RequirePermission("restaurant.orders.edit")]
    public async Task<IActionResult> SendReceipt(Guid id, [FromBody] SendReceiptReq req, CancellationToken ct) =>
        OkOrError(await sender.Send(new SendReceiptCommand(id, req.Channel, req.RecipientAddress), ct));

    /// <summary>POST /api/restaurant/orders/{id}/items/{itemId}/void — audited (reason required).</summary>
    [HttpPost("{id:guid}/items/{itemId:guid}/void")]
    [RequirePermission("restaurant.orders.void")]
    public async Task<IActionResult> VoidItem(Guid id, Guid itemId, [FromBody] ReasonReq req, CancellationToken ct) =>
        OkOrError(await sender.Send(new VoidOrderItemCommand(id, itemId, req.Reason), ct));

    /// <summary>PATCH /api/restaurant/orders/{id}/discount — audited (reason required).</summary>
    [HttpPatch("{id:guid}/discount")]
    [RequirePermission("restaurant.orders.discount")]
    public async Task<IActionResult> ApplyDiscount(Guid id, [FromBody] DiscountReq req, CancellationToken ct) =>
        OkOrError(await sender.Send(new ApplyOrderDiscountCommand(id, req.Type, req.Amount, req.Reason), ct));

    /// <summary>POST /api/restaurant/orders/{id}/discount/remove — audited (reason required).</summary>
    [HttpPost("{id:guid}/discount/remove")]
    [RequirePermission("restaurant.orders.discount")]
    public async Task<IActionResult> RemoveDiscount(Guid id, [FromBody] ReasonReq req, CancellationToken ct) =>
        OkOrError(await sender.Send(new RemoveOrderDiscountCommand(id, req.Reason), ct));

    /// <summary>PATCH /api/restaurant/orders/{id}/send</summary>
    [HttpPatch("{id:guid}/send")]
    [RequirePermission("restaurant.orders.edit")]
    public async Task<IActionResult> SendToKitchen(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new SendOrderToKitchenCommand(id), ct));

    /// <summary>PATCH /api/restaurant/orders/{id}/ready</summary>
    [HttpPatch("{id:guid}/ready")]
    [RequirePermission("restaurant.orders.edit")]
    public async Task<IActionResult> MarkReady(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new MarkOrderReadyCommand(id), ct));

    /// <summary>PATCH /api/restaurant/orders/{id}/serve</summary>
    [HttpPatch("{id:guid}/serve")]
    [RequirePermission("restaurant.orders.edit")]
    public async Task<IActionResult> Serve(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new ServeOrderCommand(id), ct));

    /// <summary>PATCH /api/restaurant/orders/{id}/pay</summary>
    [HttpPatch("{id:guid}/pay")]
    [RequirePermission("restaurant.orders.edit")]
    public async Task<IActionResult> Pay(Guid id, [FromBody] PayReq req, CancellationToken ct) =>
        OkOrError(await sender.Send(new PayOrderCommand(id, req.Method), ct));

    /// <summary>
    /// POST /api/restaurant/orders/{id}/payments — supports split-tender (multiple methods) and
    /// split-bill (multiple guest payments).
    /// </summary>
    [HttpPost("{id:guid}/payments")]
    [RequirePermission("restaurant.orders.edit")]
    public async Task<IActionResult> AddPayment(Guid id, [FromBody] AddPaymentReq req, CancellationToken ct) =>
        OkOrError(await sender.Send(new AddOrderPaymentCommand(id, req.Method, req.Amount, req.Reference), ct));

    /// <summary>PATCH /api/restaurant/orders/{id}/tip — sets (or replaces) the tip amount.</summary>
    [HttpPatch("{id:guid}/tip")]
    [RequirePermission("restaurant.orders.edit")]
    public async Task<IActionResult> SetTip(Guid id, [FromBody] TipReq req, CancellationToken ct) =>
        OkOrError(await sender.Send(new SetOrderTipCommand(id, req.Amount), ct));

    /// <summary>PATCH /api/restaurant/orders/{id}/customer — links (or unlinks) a POS customer.</summary>
    [HttpPatch("{id:guid}/customer")]
    [RequirePermission("restaurant.orders.edit")]
    public async Task<IActionResult> SetCustomer(Guid id, [FromBody] SetCustomerReq req, CancellationToken ct) =>
        OkOrError(await sender.Send(new SetOrderCustomerCommand(id, req.CustomerId), ct));

    /// <summary>PATCH /api/restaurant/orders/{id}/hold — parks an open order aside without losing its items.</summary>
    [HttpPatch("{id:guid}/hold")]
    [RequirePermission("restaurant.orders.edit")]
    public async Task<IActionResult> Hold(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new HoldOrderCommand(id), ct));

    /// <summary>PATCH /api/restaurant/orders/{id}/recall — resumes a held order.</summary>
    [HttpPatch("{id:guid}/recall")]
    [RequirePermission("restaurant.orders.edit")]
    public async Task<IActionResult> Recall(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new RecallOrderCommand(id), ct));

    /// <summary>PATCH /api/restaurant/orders/{id}/cancel — voids the whole order, audited (reason required).</summary>
    [HttpPatch("{id:guid}/cancel")]
    [RequirePermission("restaurant.orders.void")]
    public async Task<IActionResult> Cancel(Guid id, [FromBody] ReasonReq req, CancellationToken ct) =>
        OkOrError(await sender.Send(new VoidOrderCommand(id, req.Reason), ct));

    /// <summary>POST /api/restaurant/orders/{id}/refund — refunds part or all of what's been paid.</summary>
    [HttpPost("{id:guid}/refund")]
    [RequirePermission("restaurant.orders.refund")]
    public async Task<IActionResult> Refund(Guid id, [FromBody] RefundReq req, CancellationToken ct) =>
        OkOrError(await sender.Send(new RefundOrderCommand(id, req.Amount, req.Reason, req.Method), ct));

    /// <summary>
    /// POST /api/restaurant/orders/{id}/split — splits the bill into 2+ independently-payable child
    /// orders. Returns the newly created children.
    /// </summary>
    [HttpPost("{id:guid}/split")]
    [RequirePermission("restaurant.orders.edit")]
    public async Task<IActionResult> Split(Guid id, [FromBody] SplitReq req, CancellationToken ct) =>
        OkOrError(await sender.Send(new SplitOrderCommand(id, req.Groups), ct));

    /// <summary>POST /api/restaurant/orders/{id}/transfer-table — moves the order to a different table, audited.</summary>
    [HttpPost("{id:guid}/transfer-table")]
    [RequirePermission("restaurant.orders.edit")]
    public async Task<IActionResult> TransferTable(Guid id, [FromBody] TransferTableReq req, CancellationToken ct) =>
        OkOrError(await sender.Send(new TransferOrderTableCommand(id, req.ToTableId), ct));

    public record CreateOrderReq(Guid? TableId, string Waiter, int Covers, string OrderType,
        string? Notes, List<OrderLineReq> Items, Guid? BranchId = null, Guid? SessionId = null, Guid? CustomerId = null);
    public record OrderLineReq(Guid MenuItemId, int Quantity, string? Modifiers, IReadOnlyList<Guid>? SelectedModifierIds = null, int? CourseNumber = null);
    public record AddItemsReq(List<OrderLineReq> Items);
    public record ComboSelectionReq(Guid ComboItemId, Guid MenuItemId);
    public record AddComboReq(Guid ComboId, IReadOnlyList<ComboSelectionReq> Selections);
    public record DiscountReq(string Type, decimal Amount, string Reason);
    public record ReasonReq(string Reason);
    public record PayReq(string Method);
    public record TipReq(decimal Amount);
    public record SetCustomerReq(Guid? CustomerId);
    public record AddPaymentReq(string Method, decimal Amount, string? Reference);
    public record RefundReq(decimal Amount, string Reason, string Method);
    public record SplitReq(IReadOnlyList<SplitGroupInput> Groups);
    public record TransferTableReq(Guid ToTableId);
    public record SendReceiptReq(string Channel, string RecipientAddress);
}
