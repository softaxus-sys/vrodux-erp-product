using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Manufacturing.API.Authorization;
using Softaxis.Manufacturing.API.Controllers.Common;
using Softaxis.Manufacturing.Application.ProductionOrders.Commands;
using Softaxis.Manufacturing.Application.ProductionOrders.Queries;

namespace Softaxis.Manufacturing.API.Controllers;

[Route("api/manufacturing/orders")][Authorize]
public sealed class ProductionOrdersController(ISender sender) : ManufacturingControllerBase
{
    [HttpGet]
    [RequirePermission("manufacturing.orders.view")]
    public async Task<IActionResult> GetAll([FromQuery] string? status, [FromQuery] string? search,
        [FromQuery] string? reference, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetProductionOrdersQuery(status, search, reference), ct));

    [HttpGet("summary")]
    [RequirePermission("manufacturing.orders.view")]
    public async Task<IActionResult> GetSummary(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetProductionSummaryQuery(), ct));

    [HttpGet("{id:guid}")]
    [RequirePermission("manufacturing.orders.view")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetProductionOrderByIdQuery(id), ct));

    [HttpPost]
    [RequirePermission("manufacturing.orders.create")]
    public async Task<IActionResult> Create([FromBody] PlanRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new CreateProductionOrderCommand(
            req.BomId, req.PlannedQuantity, req.WarehouseId, req.PlannedStartDate, req.DueDate,
            req.Reference, req.Notes, req.PlanSubAssemblies), ct));

    [HttpPut("{id:guid}")]
    [RequirePermission("manufacturing.orders.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] PlanRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdateProductionOrderCommand(
            id, req.PlannedQuantity, req.WarehouseId, req.PlannedStartDate, req.DueDate,
            req.Reference, req.Notes), ct));

    [HttpPost("{id:guid}/release")]
    [RequirePermission("manufacturing.orders.edit")]
    public async Task<IActionResult> Release(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new ReleaseProductionOrderCommand(id), ct));

    // Issue and complete move stock, so they sit on edit rather than create.
    [HttpPost("{id:guid}/issue")]
    [RequirePermission("manufacturing.orders.edit")]
    public async Task<IActionResult> Issue(Guid id, [FromBody] IssueRequest? req, CancellationToken ct) =>
        OkOrError(await sender.Send(new IssueMaterialsCommand(id, req?.Lines), ct));

    [HttpPost("{id:guid}/complete")]
    [RequirePermission("manufacturing.orders.edit")]
    public async Task<IActionResult> Complete(Guid id, [FromBody] CompleteRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new CompleteProductionOrderCommand(
            id, req.ProducedQuantity, req.IssueRemaining, req.ScrappedQuantity, req.QualityNotes,
            req.CostScrapSeparately, req.BatchNumber, req.ExpiryDate), ct));

    [HttpPost("{id:guid}/return")]
    [RequirePermission("manufacturing.orders.edit")]
    public async Task<IActionResult> Return(Guid id, [FromBody] IssueRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new ReturnMaterialsCommand(id, req.Lines ?? []), ct));

    // The request itself is raised through the Purchase API by the client; this only remembers its number.
    [HttpPatch("{id:guid}/requisition")]
    [RequirePermission("manufacturing.orders.edit")]
    public async Task<IActionResult> LinkRequisition(Guid id, [FromBody] RequisitionRequest req, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new LinkOrderRequisitionCommand(id, req.RequisitionNumber), ct));

    [HttpPost("{id:guid}/operations/{operationId:guid}/record")]
    [RequirePermission("manufacturing.orders.edit")]
    public async Task<IActionResult> RecordOperation(Guid id, Guid operationId, [FromBody] RecordRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new RecordOperationCommand(id, operationId, req.ActualMinutes), ct));

    // The journal entry itself is created through the Finance API by the client; this only
    // remembers which entry it was.
    [HttpPatch("{id:guid}/journal")]
    [RequirePermission("manufacturing.orders.edit")]
    public async Task<IActionResult> LinkJournal(Guid id, [FromBody] JournalRequest req, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new LinkOrderJournalCommand(id, req.JournalEntryId, req.JournalEntryNumber), ct));

    [HttpPost("{id:guid}/cancel")]
    [RequirePermission("manufacturing.orders.edit")]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new CancelProductionOrderCommand(id), ct));

    [HttpDelete("{id:guid}")]
    [RequirePermission("manufacturing.orders.delete")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteProductionOrderCommand(id), ct));

    public sealed record PlanRequest(
        Guid BomId, decimal PlannedQuantity, Guid? WarehouseId, string? PlannedStartDate,
        string? DueDate, string? Reference, string? Notes, bool PlanSubAssemblies = false);

    public sealed record IssueRequest(List<IssueLineInput>? Lines);

    public sealed record CompleteRequest(
        decimal ProducedQuantity, bool IssueRemaining, decimal ScrappedQuantity = 0, string? QualityNotes = null,
        bool CostScrapSeparately = false, string? BatchNumber = null, string? ExpiryDate = null);

    public sealed record RequisitionRequest(string RequisitionNumber);

    public sealed record RecordRequest(decimal ActualMinutes);

    public sealed record JournalRequest(Guid JournalEntryId, string? JournalEntryNumber);
}
