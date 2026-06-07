using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.POS.Application.Vendors.Commands.CreateVendor;
using Softaxis.POS.Application.Vendors.Commands.DeleteVendor;
using Softaxis.POS.Application.Vendors.Commands.UpdateVendor;
using Softaxis.POS.Application.Vendors.Queries.GetVendorById;
using Softaxis.POS.Application.Vendors.Queries.GetVendors;

namespace Softaxis.POS.API.Controllers;

[Authorize]
[Route("api/vendors")]
[Tags("Vendors")]
public sealed class VendorsController(ISender sender) : BaseApiController(sender)
{
    // ── GET /api/vendors ──────────────────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search   = null,
        [FromQuery] string? status   = null,
        [FromQuery] string? category = null,
        [FromQuery] int     page     = 1,
        [FromQuery] int     pageSize = 25,
        CancellationToken ct = default) =>
        HandleResult(await Sender.Send(
            new GetVendorsQuery(search, status, category, page, pageSize), ct));

    // ── GET /api/vendors/{id} ─────────────────────────────────────────────────
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct) =>
        HandleResult(await Sender.Send(new GetVendorByIdQuery(id), ct));

    // ── POST /api/vendors ─────────────────────────────────────────────────────
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] UpsertVendorRequest req, CancellationToken ct) =>
        HandleResult(await Sender.Send(new CreateVendorCommand(
            req.Name, req.Code, req.Category, req.ContactPerson,
            req.Email, req.Phone, req.Address, req.TaxNumber,
            req.PaymentTerms, req.Currency, req.Notes), ct), successCode: 201);

    // ── PUT /api/vendors/{id} ─────────────────────────────────────────────────
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpsertVendorRequest req, CancellationToken ct) =>
        HandleResult(await Sender.Send(new UpdateVendorCommand(
            id, req.Name, req.Code, req.Category, req.ContactPerson,
            req.Email, req.Phone, req.Address, req.TaxNumber,
            req.PaymentTerms, req.Currency, req.Notes,
            req.Status, req.Rating), ct));

    // ── DELETE /api/vendors/{id} ──────────────────────────────────────────────
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        HandleResult(await Sender.Send(new DeleteVendorCommand(id), ct));
}

// ── Request DTO ───────────────────────────────────────────────────────────────

public sealed record UpsertVendorRequest(
    string   Name,
    string?  Code,
    string?  Category,
    string?  ContactPerson,
    string?  Email,
    string?  Phone,
    string?  Address,
    string?  TaxNumber,
    string?  PaymentTerms,
    string?  Currency,
    string?  Notes,
    string?  Status,
    decimal? Rating);
