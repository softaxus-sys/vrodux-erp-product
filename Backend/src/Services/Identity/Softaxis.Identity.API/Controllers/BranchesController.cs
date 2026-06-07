using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Identity.Application.Branches.Commands.CreateBranch;
using Softaxis.Identity.Application.Branches.Commands.DeleteBranch;
using Softaxis.Identity.Application.Branches.Commands.UpdateBranch;
using Softaxis.Identity.Application.Branches.Queries.GetBranchById;
using Softaxis.Identity.Application.Branches.Queries.GetBranches;

namespace Softaxis.Identity.API.Controllers;

[Authorize]
[Tags("Branches")]
public sealed class BranchesController(ISender sender) : BaseApiController(sender)
{
    // ── GET /api/branches ─────────────────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] int     page     = 1,
        [FromQuery] int     pageSize = 50,
        [FromQuery] string? status   = null,
        CancellationToken ct = default) =>
        HandleResult(await Sender.Send(new GetBranchesQuery(page, pageSize, status), ct));

    // ── GET /api/branches/{id} ────────────────────────────────────────────────
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct) =>
        HandleResult(await Sender.Send(new GetBranchByIdQuery(id), ct));

    // ── POST /api/branches ────────────────────────────────────────────────────
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] UpsertBranchRequest req, CancellationToken ct) =>
        HandleResult(await Sender.Send(new CreateBranchCommand(
            req.Code, req.Name, req.Type, req.City, req.Country, req.Flag,
            req.Address, req.Phone, req.Email, req.Manager, req.Staff,
            req.Status, req.Currency, req.Timezone, req.OpenedDate), ct), successCode: 201);

    // ── PUT /api/branches/{id} ────────────────────────────────────────────────
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpsertBranchRequest req, CancellationToken ct) =>
        HandleResult(await Sender.Send(new UpdateBranchCommand(
            id, req.Code, req.Name, req.Type, req.City, req.Country, req.Flag,
            req.Address, req.Phone, req.Email, req.Manager, req.Staff,
            req.Status, req.Currency, req.Timezone, req.OpenedDate), ct));

    // ── DELETE /api/branches/{id} ─────────────────────────────────────────────
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        HandleResult(await Sender.Send(new DeleteBranchCommand(id), ct));
}

// ── Request DTO ───────────────────────────────────────────────────────────────

public sealed record UpsertBranchRequest(
    string  Code,
    string  Name,
    string? Type,
    string? City,
    string? Country,
    string? Flag,
    string? Address,
    string? Phone,
    string? Email,
    string? Manager,
    int     Staff,
    string? Status,
    string? Currency,
    string? Timezone,
    string? OpenedDate);
