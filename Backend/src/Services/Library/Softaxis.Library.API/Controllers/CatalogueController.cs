using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Library.API.Authorization;
using Softaxis.Library.API.Controllers.Common;
using Softaxis.Library.Application.Catalogue;
using Softaxis.Library.Application.Import;

namespace Softaxis.Library.API.Controllers;

/// <summary>
/// Titles and their physical copies. Reads are also open to the circulation desk, which has to
/// find a book before it can issue or reserve it.
/// </summary>
[Route("api/library")][Authorize]
public sealed class CatalogueController(ISender sender) : LibraryControllerBase
{
    private const string View = "library.catalog.view", DeskView = "library.circulation.view";

    // ── Titles ──────────────────────────────────────────────────────────────

    [HttpGet("titles")]
    [RequirePermission(View, DeskView)]
    public async Task<IActionResult> GetTitles(
        [FromQuery] string? search, [FromQuery] string? category, [FromQuery] Guid? branchId,
        [FromQuery] bool availableOnly, [FromQuery] int page = 1, [FromQuery] int pageSize = 50,
        CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetTitlesQuery(search, category, branchId, availableOnly, page, pageSize), ct));

    [HttpGet("titles/categories")]
    [RequirePermission(View, DeskView)]
    public async Task<IActionResult> GetCategories(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetCategoriesQuery(), ct));

    [HttpGet("titles/{id:guid}")]
    [RequirePermission(View, DeskView)]
    public async Task<IActionResult> GetTitle(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetTitleByIdQuery(id), ct));

    [HttpPost("titles")]
    [RequirePermission("library.catalog.create")]
    public async Task<IActionResult> CreateTitle([FromBody] TitleRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new CreateTitleCommand(
            req.Title, req.Subtitle, req.Authors, req.Isbn, req.Publisher, req.PublicationYear, req.Edition,
            req.Language, req.Category, req.MaterialType, req.Description, req.ReplacementCost,
            req.Copies, req.BranchId, req.ShelfLocation), ct));

    /// <summary>Bulk import from a spreadsheet. Rows that match a title already there add copies to it.</summary>
    [HttpPost("titles/import")]
    [RequirePermission("library.catalog.create")]
    public async Task<IActionResult> ImportTitles([FromBody] ImportTitlesRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new ImportTitlesCommand(req.Rows, req.DefaultBranchId, req.CreateBranches), ct));

    [HttpPut("titles/{id:guid}")]
    [RequirePermission("library.catalog.edit")]
    public async Task<IActionResult> UpdateTitle(Guid id, [FromBody] TitleRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdateTitleCommand(
            id, req.Title, req.Subtitle, req.Authors, req.Isbn, req.Publisher, req.PublicationYear, req.Edition,
            req.Language, req.Category, req.MaterialType, req.Description, req.ReplacementCost), ct));

    [HttpDelete("titles/{id:guid}")]
    [RequirePermission("library.catalog.delete")]
    public async Task<IActionResult> DeleteTitle(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteTitleCommand(id), ct));

    // ── Copies ──────────────────────────────────────────────────────────────

    [HttpPost("titles/{id:guid}/copies")]
    [RequirePermission("library.catalog.create")]
    public async Task<IActionResult> AddCopies(Guid id, [FromBody] AddCopiesRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new AddCopiesCommand(
            id, req.BranchId, req.Count, req.Barcodes, req.ShelfLocation, req.Price, req.AcquiredOn), ct));

    [HttpGet("copies")]
    [RequirePermission(View, DeskView)]
    public async Task<IActionResult> GetCopies(
        [FromQuery] string? search, [FromQuery] Guid? branchId, [FromQuery] Guid? titleId, [FromQuery] string? status,
        [FromQuery] string? addedFrom, [FromQuery] int page = 1, [FromQuery] int pageSize = 100,
        CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetCopiesQuery(search, branchId, titleId, status, addedFrom, page, pageSize), ct));

    [HttpGet("copies/by-barcode/{barcode}")]
    [RequirePermission(View, DeskView)]
    public async Task<IActionResult> GetCopyByBarcode(string barcode, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetCopyByBarcodeQuery(barcode), ct));

    [HttpGet("copies/in-transit")]
    [RequirePermission(View, DeskView)]
    public async Task<IActionResult> GetInTransit(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetCopiesInTransitQuery(), ct));

    [HttpPut("copies/{id:guid}")]
    [RequirePermission("library.catalog.edit")]
    public async Task<IActionResult> UpdateCopy(Guid id, [FromBody] CopyRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdateCopyCommand(
            id, req.Barcode, req.ShelfLocation, req.Condition, req.Status, req.Price, req.AcquiredOn, req.Notes), ct));

    [HttpDelete("copies/{id:guid}")]
    [RequirePermission("library.catalog.delete")]
    public async Task<IActionResult> DeleteCopy(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteCopyCommand(id), ct));

    // Moving stock between branches is desk work as much as cataloguing.
    [HttpPost("copies/{id:guid}/transfer")]
    [RequirePermission("library.catalog.edit", "library.circulation.edit")]
    public async Task<IActionResult> Transfer(Guid id, [FromBody] TransferRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new TransferCopyCommand(id, req.ToBranchId), ct));

    [HttpPost("copies/{id:guid}/receive")]
    [RequirePermission("library.catalog.edit", "library.circulation.edit")]
    public async Task<IActionResult> Receive(Guid id, [FromBody] ReceiveRequest? req, CancellationToken ct) =>
        OkOrError(await sender.Send(new ReceiveCopyCommand(id, req?.Today), ct));

    public sealed record TitleRequest(
        string Title, string? Subtitle, string? Authors, string? Isbn, string? Publisher, int? PublicationYear,
        string? Edition, string? Language, string? Category, string? MaterialType, string? Description,
        decimal ReplacementCost = 0, int Copies = 0, Guid? BranchId = null, string? ShelfLocation = null);

    public sealed record AddCopiesRequest(
        Guid BranchId, int Count = 1, IReadOnlyList<string>? Barcodes = null, string? ShelfLocation = null,
        decimal Price = 0, string? AcquiredOn = null);

    public sealed record CopyRequest(
        string Barcode, string? ShelfLocation, string? Condition, string? Status, decimal Price = 0,
        string? AcquiredOn = null, string? Notes = null);

    public sealed record ImportTitlesRequest(
        IReadOnlyList<ImportTitleRow> Rows, Guid? DefaultBranchId, bool CreateBranches = true);

    public sealed record TransferRequest(Guid ToBranchId);
    public sealed record ReceiveRequest(string? Today);
}
