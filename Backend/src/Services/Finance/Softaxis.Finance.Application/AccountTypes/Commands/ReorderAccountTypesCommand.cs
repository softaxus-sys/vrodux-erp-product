using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Finance.Application.Lookups.Dtos;

namespace Softaxis.Finance.Application.AccountTypes.Commands;

/// <summary>Bulk-updates the SortOrder of a set of sibling account types/subtypes (must share the same ParentId).</summary>
public sealed record ReorderAccountTypesCommand(
    IReadOnlyList<ReorderAccountTypeItem> Items
) : ICommand<IReadOnlyList<AccountTypeDto>>;

public sealed record ReorderAccountTypeItem(Guid Id, int SortOrder);

public sealed class ReorderAccountTypesValidator : AbstractValidator<ReorderAccountTypesCommand>
{
    public ReorderAccountTypesValidator()
    {
        RuleFor(x => x.Items).NotEmpty().WithMessage("At least one item is required.");
    }
}
