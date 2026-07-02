using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Inventory.Application.StockTransfers.Commands.ApproveStockTransfer;
using Softaxis.Inventory.Application.StockTransfers.Commands.CreateStockTransfer;
using Softaxis.Inventory.Application.StockTransfers.Commands.ReceiveStockTransfer;
using Softaxis.Inventory.Application.StockTransfers.Commands.SubmitStockTransfer;
using Softaxis.Inventory.Application.StockTransfers.Dtos;
using Softaxis.Inventory.Application.StockTransfers.Queries.GetStockTransferById;
using Softaxis.Inventory.Application.StockTransfers.Queries.GetStockTransfers;
using Softaxis.Inventory.Application.StockTransfers.Queries.GetStockTransfersSummary;
using Softaxis.Inventory.API.Authorization;

namespace Softaxis.Inventory.API.Controllers;

/// <summary>Stock transfers between warehouses.</summary>
[Route("api/inventory/transfers")]
[Authorize]
public sealed class StockTransfersController(ISender sender) : BaseApiController(sender)
{
    [HttpGet("summary")]
    [RequirePermission("inventory.transfers.view")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
        => HandleResult(await Sender.Send(new GetStockTransfersSummaryQuery(), ct));

    [HttpGet]
    [RequirePermission("inventory.transfers.view")]
    public async Task<IActionResult> GetAll(CancellationToken ct)
        => HandleResult(await Sender.Send(new GetStockTransfersQuery(), ct));

    [HttpGet("{id:guid}")]
    [RequirePermission("inventory.transfers.view")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
        => HandleResult(await Sender.Send(new GetStockTransferByIdQuery(id), ct));

    [HttpPost]
    [RequirePermission("inventory.transfers.create")]
    public async Task<IActionResult> Create([FromBody] CreateStockTransferRequest req, CancellationToken ct)
        => HandleResult(await Sender.Send(
            new CreateStockTransferCommand(req.FromWarehouseId, req.FromWarehouseName, req.ToWarehouseId,
                req.ToWarehouseName, req.RequestedBy, req.ExpectedDate, req.Notes, req.Items), ct), 201);

    // Submit is the requester's own action (draft → submitted) — same actor as create.
    [HttpPost("{id:guid}/submit")]
    [RequirePermission("inventory.transfers.create")]
    public async Task<IActionResult> Submit(Guid id, CancellationToken ct)
        => HandleResult(await Sender.Send(new SubmitStockTransferCommand(id), ct));

    [HttpPost("{id:guid}/approve")]
    [RequirePermission("inventory.transfers.approve")]
    public async Task<IActionResult> Approve(Guid id, [FromBody] ApproveStockTransferRequest req, CancellationToken ct)
        => HandleResult(await Sender.Send(new ApproveStockTransferCommand(id, req.By), ct));

    // Receiving completes the transfer at the destination — approve-level (no seeded receive/edit key).
    [HttpPost("{id:guid}/receive")]
    [RequirePermission("inventory.transfers.approve")]
    public async Task<IActionResult> Receive(Guid id, CancellationToken ct)
        => HandleResult(await Sender.Send(new ReceiveStockTransferCommand(id), ct));
}
