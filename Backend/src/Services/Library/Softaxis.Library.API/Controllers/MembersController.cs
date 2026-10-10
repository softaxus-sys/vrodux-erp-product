using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Library.API.Authorization;
using Softaxis.Library.API.Controllers.Common;
using Softaxis.Library.Application.Import;
using Softaxis.Library.Application.Members;

namespace Softaxis.Library.API.Controllers;

/// <summary>Reads are also open to the circulation desk, which looks a member up to issue to them.</summary>
[Route("api/library/members")][Authorize]
public sealed class MembersController(ISender sender) : LibraryControllerBase
{
    private const string View = "library.members.view", DeskView = "library.circulation.view";

    [HttpGet]
    [RequirePermission(View, DeskView)]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search, [FromQuery] string? status, [FromQuery] string? today,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetMembersQuery(search, status, page, pageSize, today), ct));

    [HttpGet("{id:guid}")]
    [RequirePermission(View, DeskView)]
    public async Task<IActionResult> GetById(Guid id, [FromQuery] string? today, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetMemberByIdQuery(id, today), ct));

    [HttpPost]
    [RequirePermission("library.members.create")]
    public async Task<IActionResult> Create([FromBody] MemberRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new CreateMemberCommand(
            req.MemberNumber, req.FullName, req.Email, req.Phone, req.Address, req.IdNumber,
            req.MembershipTypeId, req.HomeBranchId, req.JoinedOn, req.ExpiresOn, req.Notes, req.Today), ct));

    /// <summary>Bulk import from a spreadsheet. Members already on file are skipped, not duplicated.</summary>
    [HttpPost("import")]
    [RequirePermission("library.members.create")]
    public async Task<IActionResult> Import([FromBody] ImportMembersRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new ImportMembersCommand(req.Rows, req.DefaultMembershipTypeId, req.Today), ct));

    [HttpPut("{id:guid}")]
    [RequirePermission("library.members.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] MemberRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdateMemberCommand(
            id, req.MemberNumber ?? string.Empty, req.FullName, req.Email, req.Phone, req.Address, req.IdNumber,
            req.MembershipTypeId, req.HomeBranchId, req.ExpiresOn, req.Status, req.Notes, req.Today), ct));

    [HttpDelete("{id:guid}")]
    [RequirePermission("library.members.delete")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteMemberCommand(id), ct));

    public sealed record ImportMembersRequest(
        IReadOnlyList<ImportMemberRow> Rows, Guid? DefaultMembershipTypeId, string? Today);

    public sealed record MemberRequest(
        string? MemberNumber, string FullName, string? Email, string? Phone, string? Address, string? IdNumber,
        Guid MembershipTypeId, Guid? HomeBranchId, string? JoinedOn, string? ExpiresOn, string? Status,
        string? Notes, string? Today);
}
