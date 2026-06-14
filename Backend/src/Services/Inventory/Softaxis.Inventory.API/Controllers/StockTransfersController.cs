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

namespace Softaxis.Inventory.API.Controllers;

/// <summary>Stock transfers between warehouses.</summary>
[Route("api/inventory/transfers")]
[Authorize]
public sealed class StockTransfersController(ISender sender) : BaseApiController(sender)
{
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
        => HandleResult(await Sender.Send(new GetStockTransfersSummaryQuery(), ct));

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
        => HandleResult(await Sender.Send(new GetStockTransfersQuery(), ct));

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
        => HandleResult(await Sender.Send(new GetStockTransferByIdQuery(id), ct));

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateStockTransferRequest req, CancellationToken ct)
        => HandleResult(await Sender.Send(
            new CreateStockTransferCommand(req.FromWarehouseId, req.FromWarehouseName, req.ToWarehouseId,
                req.ToWarehouseName, req.RequestedBy, req.ExpectedDate, req.Notes, req.Items), ct), 201);

    [HttpPost("{id:guid}/submit")]
    public async Task<IActionResult> Submit(Guid id, CancellationToken ct)
        => HandleResult(await Sender.Send(new SubmitStockTransferCommand(id), ct));

    [HttpPost("{id:guid}/approve")]
    public async Task<IActionResult> Approve(Guid id, [FromBody] ApproveStockTransferRequest req, CancellationToken ct)
        => HandleResult(await Sender.Send(new ApproveStockTransferCommand(id, req.By), ct));

    [HttpPost("{id:guid}/receive")]
    public async Task<IActionResult> Receive(Guid id, CancellationToken ct)
        => HandleResult(await Sender.Send(new ReceiveStockTransferCommand(id), ct));
}
