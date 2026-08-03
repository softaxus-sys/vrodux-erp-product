using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Restaurant.API.Authorization;
using Softaxis.Restaurant.API.Controllers.Common;
using Softaxis.Restaurant.Application.Tables.Commands;
using Softaxis.Restaurant.Application.Tables.Queries;

namespace Softaxis.Restaurant.API.Controllers;

[ApiController][Route("api/restaurant/tables")][Authorize]
public sealed class TablesController(ISender sender) : RestaurantControllerBase
{
    /// <summary>GET /api/restaurant/tables/summary</summary>
    [HttpGet("summary")]
    [RequirePermission("restaurant.tables.view")]
    public async Task<IActionResult> GetSummary(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetTablesSummaryQuery(), ct));

    /// <summary>GET /api/restaurant/tables</summary>
    [HttpGet]
    [RequirePermission("restaurant.tables.view")]
    public async Task<IActionResult> GetAll(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetTablesQuery(), ct));

    /// <summary>POST /api/restaurant/tables</summary>
    [HttpPost]
    [RequirePermission("restaurant.tables.create")]
    public async Task<IActionResult> Create([FromBody] CreateTableCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd, ct));

    /// <summary>PUT /api/restaurant/tables/{id}</summary>
    [HttpPut("{id:guid}")]
    [RequirePermission("restaurant.tables.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateTableReq req, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdateTableCommand(id, req.TableNumber, req.Section, req.Capacity, req.DiningAreaId), ct));

    /// <summary>DELETE /api/restaurant/tables/{id} — rejected if the table has an active order.</summary>
    [HttpDelete("{id:guid}")]
    [RequirePermission("restaurant.tables.edit")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteTableCommand(id), ct));

    /// <summary>PATCH /api/restaurant/tables/{id}/status</summary>
    [HttpPatch("{id:guid}/status")]
    [RequirePermission("restaurant.tables.edit")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateStatusReq req, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdateTableStatusCommand(id, req.Status), ct));

    /// <summary>PATCH /api/restaurant/tables/{id}/position — one table's placement on the designer canvas.</summary>
    [HttpPatch("{id:guid}/position")]
    [RequirePermission("restaurant.tables.edit")]
    public async Task<IActionResult> Reposition(Guid id, [FromBody] RepositionReq req, CancellationToken ct) =>
        OkOrError(await sender.Send(new RepositionTableCommand(id, req.PosX, req.PosY, req.Shape, req.Rotation), ct));

    /// <summary>PUT /api/restaurant/tables/layout — batch position save from the designer canvas.</summary>
    [HttpPut("layout")]
    [RequirePermission("restaurant.tables.edit")]
    public async Task<IActionResult> UpdateLayout([FromBody] UpdateTableLayoutCommand cmd, CancellationToken ct) =>
        NoContentOrError(await sender.Send(cmd, ct));

    /// <summary>POST /api/restaurant/tables/{id}/merge — merges this table into another for a large party.</summary>
    [HttpPost("{id:guid}/merge")]
    [RequirePermission("restaurant.tables.edit")]
    public async Task<IActionResult> Merge(Guid id, [FromBody] MergeReq req, CancellationToken ct) =>
        OkOrError(await sender.Send(new MergeTableCommand(id, req.TargetTableId), ct));

    /// <summary>POST /api/restaurant/tables/{id}/unmerge</summary>
    [HttpPost("{id:guid}/unmerge")]
    [RequirePermission("restaurant.tables.edit")]
    public async Task<IActionResult> Unmerge(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new UnmergeTableCommand(id), ct));

    /// <summary>GET /api/restaurant/tables/{id}/qr-code — QR image + guest-ordering URL for this table.</summary>
    [HttpGet("{id:guid}/qr-code")]
    [RequirePermission("restaurant.tables.view")]
    public async Task<IActionResult> GetQrCode(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetTableQrCodeQuery(id), ct));

    public record UpdateStatusReq(string Status);
    public record UpdateTableReq(string TableNumber, string Section, int Capacity, Guid? DiningAreaId);
    public record RepositionReq(double PosX, double PosY, string Shape, int Rotation);
    public record MergeReq(Guid TargetTableId);
}
