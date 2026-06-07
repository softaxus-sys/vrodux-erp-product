using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.POS.Application.DTOs;

namespace Softaxis.POS.Application.Categories.Commands.UpdateCategory;

public sealed record UpdateCategoryCommand(
    Guid    Id,
    string  Name,
    string? Description,
    Guid?   ParentCategoryId,
    int     SortOrder,
    bool    IsActive) : ICommand<ProductCategoryDto>;

public sealed class UpdateCategoryCommandValidator : AbstractValidator<UpdateCategoryCommand>
{
    public UpdateCategoryCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.SortOrder).GreaterThanOrEqualTo(0);
    }
}
