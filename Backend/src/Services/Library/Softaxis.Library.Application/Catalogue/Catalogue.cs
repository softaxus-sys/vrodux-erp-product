using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Library.Application.Catalogue;

public sealed record PagedDto<T>(IReadOnlyList<T> Items, int Total);

/// <summary>A physical copy. Borrower and due date are filled only while it is out.</summary>
public sealed record CopyDto(
    Guid Id, Guid TitleId, string Title, string Authors, string Barcode,
    Guid BranchId, string BranchName, string Status, string? ShelfLocation, string Condition,
    string? AcquiredOn, decimal Price, string? Notes,
    Guid? TransitToBranchId, string? TransitToBranchName,
    Guid? LoanId, Guid? MemberId, string? MemberName, string? DueDate);

public sealed record TitleSummaryDto(
    Guid Id, string Title, string? Subtitle, string Authors, string? Isbn, string? Category,
    string MaterialType, string? Publisher, int? PublicationYear, string? Language,
    int TotalCopies, int AvailableCopies, int WaitingReservations);

public sealed record TitleDetailDto(
    Guid Id, string Title, string? Subtitle, string Authors, string? Isbn, string? Publisher,
    int? PublicationYear, string? Edition, string? Language, string? Category, string MaterialType,
    string? Description, decimal ReplacementCost, int WaitingReservations, IReadOnlyList<CopyDto> Copies);

/// <param name="BranchId">When set, copy counts are for that branch only.</param>
public sealed record GetTitlesQuery(
    string? Search = null, string? Category = null, Guid? BranchId = null, bool AvailableOnly = false,
    int Page = 1, int PageSize = 50) : IQuery<PagedDto<TitleSummaryDto>>;

public sealed record GetTitleByIdQuery(Guid Id) : IQuery<TitleDetailDto>;

public sealed record GetCategoriesQuery : IQuery<IReadOnlyList<string>>;

/// <summary>The issue / return desk: scan a barcode, get the copy and who has it.</summary>
public sealed record GetCopyByBarcodeQuery(string Barcode) : IQuery<CopyDto>;

/// <summary>Copies on their way to another branch.</summary>
public sealed record GetCopiesInTransitQuery : IQuery<IReadOnlyList<CopyDto>>;

/// <param name="Copies">Copies to create with the title; needs <paramref name="BranchId"/> when above zero.</param>
public sealed record CreateTitleCommand(
    string Title, string? Subtitle, string? Authors, string? Isbn, string? Publisher, int? PublicationYear,
    string? Edition, string? Language, string? Category, string? MaterialType, string? Description,
    decimal ReplacementCost, int Copies = 0, Guid? BranchId = null, string? ShelfLocation = null)
    : ICommand<TitleDetailDto>;

public sealed record UpdateTitleCommand(
    Guid Id, string Title, string? Subtitle, string? Authors, string? Isbn, string? Publisher, int? PublicationYear,
    string? Edition, string? Language, string? Category, string? MaterialType, string? Description,
    decimal ReplacementCost) : ICommand<TitleDetailDto>;

public sealed record DeleteTitleCommand(Guid Id) : ICommand;

/// <param name="Barcodes">Optional. When given it decides the count; otherwise barcodes are generated.</param>
public sealed record AddCopiesCommand(
    Guid TitleId, Guid BranchId, int Count, IReadOnlyList<string>? Barcodes, string? ShelfLocation,
    decimal Price, string? AcquiredOn) : ICommand<TitleDetailDto>;

public sealed record UpdateCopyCommand(
    Guid Id, string Barcode, string? ShelfLocation, string? Condition, string? Status, decimal Price,
    string? AcquiredOn, string? Notes) : ICommand<CopyDto>;

public sealed record DeleteCopyCommand(Guid Id) : ICommand;

public sealed record TransferCopyCommand(Guid Id, Guid ToBranchId) : ICommand<CopyDto>;

public sealed record ReceiveCopyCommand(Guid Id, string? Today) : ICommand<CopyDto>;

public sealed class CreateTitleValidator : AbstractValidator<CreateTitleCommand>
{
    public CreateTitleValidator()
    {
        RuleFor(x => x.Title).NotEmpty().WithMessage("Title is required.").MaximumLength(400);
        RuleFor(x => x.Authors).MaximumLength(500);
        RuleFor(x => x.Isbn).MaximumLength(30);
        RuleFor(x => x.Description).MaximumLength(4000);
        RuleFor(x => x.ReplacementCost).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Copies).InclusiveBetween(0, 500).WithMessage("Copies must be between 0 and 500.");
        RuleFor(x => x.BranchId).NotEmpty().When(x => x.Copies > 0).WithMessage("Choose the branch the copies belong to.");
        RuleFor(x => x.PublicationYear).InclusiveBetween(1000, 2200).When(x => x.PublicationYear.HasValue)
            .WithMessage("Publication year looks wrong.");
    }
}

public sealed class UpdateTitleValidator : AbstractValidator<UpdateTitleCommand>
{
    public UpdateTitleValidator()
    {
        RuleFor(x => x.Title).NotEmpty().WithMessage("Title is required.").MaximumLength(400);
        RuleFor(x => x.Authors).MaximumLength(500);
        RuleFor(x => x.Isbn).MaximumLength(30);
        RuleFor(x => x.Description).MaximumLength(4000);
        RuleFor(x => x.ReplacementCost).GreaterThanOrEqualTo(0);
        RuleFor(x => x.PublicationYear).InclusiveBetween(1000, 2200).When(x => x.PublicationYear.HasValue)
            .WithMessage("Publication year looks wrong.");
    }
}

public sealed class AddCopiesValidator : AbstractValidator<AddCopiesCommand>
{
    public AddCopiesValidator()
    {
        RuleFor(x => x.BranchId).NotEmpty().WithMessage("Choose a branch.");
        RuleFor(x => x.Count).InclusiveBetween(1, 500).When(x => x.Barcodes is null || x.Barcodes.Count == 0)
            .WithMessage("Copies must be between 1 and 500.");
        RuleFor(x => x.Price).GreaterThanOrEqualTo(0);
        RuleForEach(x => x.Barcodes).NotEmpty().MaximumLength(60);
    }
}

public sealed class UpdateCopyValidator : AbstractValidator<UpdateCopyCommand>
{
    public UpdateCopyValidator()
    {
        RuleFor(x => x.Barcode).NotEmpty().WithMessage("Barcode is required.").MaximumLength(60);
        RuleFor(x => x.Price).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Notes).MaximumLength(1000);
    }
}
