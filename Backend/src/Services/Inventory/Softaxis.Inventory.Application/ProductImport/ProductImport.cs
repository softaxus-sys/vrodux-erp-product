using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Inventory.Application.ProductImport;

/// <summary>One line of an import file, already read into plain values by the screen.</summary>
public sealed record ImportProductRow(
    string  Name,
    string? Sku             = null,
    string? Barcode         = null,
    string? Category        = null,
    string? Brand           = null,
    string? Unit            = null,
    decimal CostPrice       = 0,
    decimal SalePrice       = 0,
    decimal TaxRate         = 0,
    decimal OpeningStock    = 0,
    decimal ReorderLevel    = 0,
    string? Description     = null,
    /// <summary>Addresses of pictures, in order. The first becomes the main photo.</summary>
    IReadOnlyList<string>? ImageUrls = null,
    /// <summary>Rows sharing a group become the variants of ONE online listing (needs <see cref="Options"/>).</summary>
    string? Group           = null,
    /// <summary>This row's choices inside its group: <c>Size=M; Colour=Red</c>.</summary>
    string? Options         = null);

/// <summary>
/// Creates stock items from a file. Safe to run again: an item whose SKU (or barcode, when it has no SKU) is already
/// in stock is left exactly as it is — only its missing pictures and listing are filled in.
/// </summary>
public sealed record ImportProductsCommand(IReadOnlyList<ImportProductRow> Rows, bool ListOnline = false)
    : ICommand<ImportProductsResult>;

public sealed record ImportRowProblem(int Index, string Reason);

public sealed record ImportProductsResult(
    int Created, int Existing, int Listed, int PhotosQueued,
    IReadOnlyList<ImportRowProblem> Failed, IReadOnlyList<string> Notes);

/// <summary>Where the background picture downloads stand.</summary>
public sealed record GetImportPhotoStatusQuery() : IQuery<ImportPhotoStatusDto>;

public sealed record ImportPhotoFailureDto(Guid Id, Guid ProductId, string ProductName, string Url, string? Error);

public sealed record ImportPhotoStatusDto(
    int Pending, int FailedCount, int DoneLastDay, IReadOnlyList<ImportPhotoFailureDto> Failures);

/// <summary>Gives every failed picture a fresh set of tries.</summary>
public sealed record RetryFailedImportPhotosCommand() : ICommand<int>;

public sealed class ImportProductsCommandValidator : AbstractValidator<ImportProductsCommand>
{
    public const int MaxRows = 500;
    public const int MaxPhotosPerItem = 10;

    public ImportProductsCommandValidator()
    {
        RuleFor(x => x.Rows).NotNull()
            .Must(r => r is { Count: > 0 }).WithMessage("The file has no rows to import.")
            .Must(r => r is null || r.Count <= MaxRows).WithMessage($"Import at most {MaxRows} rows at a time.");
    }
}
