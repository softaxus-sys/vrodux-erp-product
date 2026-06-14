using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.ProjectManagement.Application.BoardColumns.Dtos;

namespace Softaxis.ProjectManagement.Application.BoardColumns.Commands;

/// <summary>Creates a new board column for a project (category defaults to "todo").</summary>
public sealed record CreateBoardColumnCommand(
    Guid ProjectId,
    string Name,
    string Category = "todo"
) : ICommand<BoardColumnDto>;

public sealed class CreateBoardColumnValidator : AbstractValidator<CreateBoardColumnCommand>
{
    public CreateBoardColumnValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Name is required.")
            .MaximumLength(100).WithMessage("Name must be ≤ 100 characters.");

        RuleFor(x => x.Category)
            .Must(c => c is "backlog" or "todo" or "in_progress" or "done")
            .WithMessage("Category must be one of: backlog, todo, in_progress, done.");
    }
}

public sealed record UpdateBoardColumnCommand(Guid Id, string Name) : ICommand<BoardColumnDto>;

public sealed class UpdateBoardColumnValidator : AbstractValidator<UpdateBoardColumnCommand>
{
    public UpdateBoardColumnValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Name is required.")
            .MaximumLength(100).WithMessage("Name must be ≤ 100 characters.");
    }
}

/// <summary>Deletes a board column. Fails if it has issues, or if it is a seeded default column.</summary>
public sealed record DeleteBoardColumnCommand(Guid Id) : ICommand;

/// <summary>Bulk-updates the SortOrder of all board columns in a project.</summary>
public sealed record ReorderBoardColumnsCommand(
    Guid ProjectId,
    IReadOnlyList<ReorderBoardColumnItem> Items
) : ICommand<IReadOnlyList<BoardColumnDto>>;

public sealed record ReorderBoardColumnItem(Guid Id, int SortOrder);

public sealed class ReorderBoardColumnsValidator : AbstractValidator<ReorderBoardColumnsCommand>
{
    public ReorderBoardColumnsValidator()
    {
        RuleFor(x => x.Items).NotEmpty().WithMessage("At least one item is required.");
    }
}
