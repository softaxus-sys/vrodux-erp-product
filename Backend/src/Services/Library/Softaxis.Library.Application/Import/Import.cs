using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Library.Application.Import;

/// <param name="Row">The row's number in the uploaded sheet, so a problem can be found again.</param>
public sealed record ImportRowError(int Row, string Message);

/// <summary>
/// What an import did. <c>Existing</c> are rows that matched a record already there — they are
/// not failures, which is what makes running the same file twice safe.
/// </summary>
public sealed record ImportResultDto(
    int Created, int Existing, int CopiesAdded, int Failed, int BranchesCreated,
    IReadOnlyList<ImportRowError> Errors);

// ── Catalogue ───────────────────────────────────────────────────────────────

/// <param name="Branch">Branch name or code. Blank = the import's default branch.</param>
/// <param name="Copies">How many copies the branch should hold. Ignored when barcodes are given.</param>
/// <param name="Barcodes">Barcodes already on the books, separated by commas, semicolons or new lines.</param>
public sealed record ImportTitleRow(
    int Row, string? Title, string? Subtitle, string? Authors, string? Isbn, string? Publisher,
    int? PublicationYear, string? Edition, string? Language, string? Category, string? MaterialType,
    string? Description, decimal? ReplacementCost, string? Branch, int? Copies, string? Barcodes,
    string? ShelfLocation, decimal? Price);

/// <param name="CreateBranches">Create a branch the sheet names but the library does not have yet.</param>
public sealed record ImportTitlesCommand(
    IReadOnlyList<ImportTitleRow> Rows, Guid? DefaultBranchId, bool CreateBranches = true)
    : ICommand<ImportResultDto>;

public sealed class ImportTitlesValidator : AbstractValidator<ImportTitlesCommand>
{
    public const int MaxRows = 1000;

    public ImportTitlesValidator() =>
        RuleFor(x => x.Rows).NotEmpty().WithMessage("The file has no rows to import.")
            .Must(r => r.Count <= MaxRows).WithMessage($"Send at most {MaxRows} rows at a time.");
}

// ── Members ─────────────────────────────────────────────────────────────────

/// <param name="MembershipType">Type name. Blank = the import's default type.</param>
public sealed record ImportMemberRow(
    int Row, string? MemberNumber, string? FullName, string? Email, string? Phone, string? Address,
    string? IdNumber, string? MembershipType, string? HomeBranch, string? JoinedOn, string? ExpiresOn,
    string? Status, string? Notes);

public sealed record ImportMembersCommand(
    IReadOnlyList<ImportMemberRow> Rows, Guid? DefaultMembershipTypeId, string? Today = null)
    : ICommand<ImportResultDto>;

public sealed class ImportMembersValidator : AbstractValidator<ImportMembersCommand>
{
    public const int MaxRows = 1000;

    public ImportMembersValidator() =>
        RuleFor(x => x.Rows).NotEmpty().WithMessage("The file has no rows to import.")
            .Must(r => r.Count <= MaxRows).WithMessage($"Send at most {MaxRows} rows at a time.");
}
