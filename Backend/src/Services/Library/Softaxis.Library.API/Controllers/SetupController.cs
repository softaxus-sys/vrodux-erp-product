using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Library.API.Authorization;
using Softaxis.Library.API.Controllers.Common;
using Softaxis.Library.Application.Circulation;
using Softaxis.Library.Application.Setup;

namespace Softaxis.Library.API.Controllers;

/// <summary>
/// Branches and membership types. Reading them is open to anyone working in the library — every
/// screen picks a branch — while changing them needs <c>library.setup.edit</c>.
/// </summary>
[Route("api/library")][Authorize]
public sealed class SetupController(ISender sender) : LibraryControllerBase
{
    private const string AnyView1 = "library.setup.view", AnyView2 = "library.catalog.view",
                         AnyView3 = "library.members.view", AnyView4 = "library.circulation.view",
                         AnyView5 = "library.fines.view";

    [HttpGet("dashboard")]
    [RequirePermission(AnyView1, AnyView2, AnyView3, AnyView4, AnyView5)]
    public async Task<IActionResult> Dashboard([FromQuery] string? today, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetLibraryDashboardQuery(today), ct));

    // ── Branches ────────────────────────────────────────────────────────────

    [HttpGet("branches")]
    [RequirePermission(AnyView1, AnyView2, AnyView3, AnyView4, AnyView5)]
    public async Task<IActionResult> GetBranches([FromQuery] bool activeOnly, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetBranchesQuery(activeOnly), ct));

    /// <summary>Whether the caller is limited to some branches. Every screen asks, to offer only those.</summary>
    [HttpGet("branches/mine")]
    [RequirePermission(AnyView1, AnyView2, AnyView3, AnyView4, AnyView5)]
    public async Task<IActionResult> GetMyBranches(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetMyBranchesQuery(), ct));

    [HttpPut("branches/{id:guid}/staff")]
    [RequirePermission("library.setup.edit")]
    public async Task<IActionResult> SetBranchStaff(Guid id, [FromBody] StaffRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new SetBranchStaffCommand(id, req.Staff), ct));

    [HttpPost("branches")]
    [RequirePermission("library.setup.edit")]
    public async Task<IActionResult> CreateBranch([FromBody] BranchRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new CreateBranchCommand(req.Name, req.Code, req.Address, req.Phone, req.Email), ct));

    [HttpPut("branches/{id:guid}")]
    [RequirePermission("library.setup.edit")]
    public async Task<IActionResult> UpdateBranch(Guid id, [FromBody] BranchRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(
            new UpdateBranchCommand(id, req.Name, req.Code, req.Address, req.Phone, req.Email, req.IsActive), ct));

    [HttpDelete("branches/{id:guid}")]
    [RequirePermission("library.setup.edit")]
    public async Task<IActionResult> DeleteBranch(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteBranchCommand(id), ct));

    // ── Membership types ────────────────────────────────────────────────────

    [HttpGet("membership-types")]
    [RequirePermission(AnyView1, AnyView2, AnyView3, AnyView4, AnyView5)]
    public async Task<IActionResult> GetMembershipTypes([FromQuery] bool activeOnly, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetMembershipTypesQuery(activeOnly), ct));

    [HttpPost("membership-types")]
    [RequirePermission("library.setup.edit")]
    public async Task<IActionResult> CreateMembershipType([FromBody] MembershipTypeRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new CreateMembershipTypeCommand(
            req.Name, req.MaxLoans, req.LoanDays, req.MaxRenewals, req.FinePerDay, req.MaxReservations, req.AnnualFee,
            req.SameTitleReserveAfterDays), ct));

    [HttpPut("membership-types/{id:guid}")]
    [RequirePermission("library.setup.edit")]
    public async Task<IActionResult> UpdateMembershipType(Guid id, [FromBody] MembershipTypeRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdateMembershipTypeCommand(
            id, req.Name, req.MaxLoans, req.LoanDays, req.MaxRenewals, req.FinePerDay, req.MaxReservations,
            req.AnnualFee, req.IsActive, req.SameTitleReserveAfterDays), ct));

    [HttpDelete("membership-types/{id:guid}")]
    [RequirePermission("library.setup.edit")]
    public async Task<IActionResult> DeleteMembershipType(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteMembershipTypeCommand(id), ct));

    public sealed record StaffRequest(IReadOnlyList<BranchStaffDto> Staff);

    public sealed record BranchRequest(
        string Name, string? Code, string? Address, string? Phone, string? Email, bool IsActive = true);

    public sealed record MembershipTypeRequest(
        string Name, int MaxLoans, int LoanDays, int MaxRenewals, decimal FinePerDay, int MaxReservations,
        decimal AnnualFee, bool IsActive = true, int SameTitleReserveAfterDays = 1);
}
