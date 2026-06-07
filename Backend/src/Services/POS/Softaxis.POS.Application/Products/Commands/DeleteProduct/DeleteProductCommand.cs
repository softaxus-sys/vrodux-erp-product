using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.POS.Application.Products.Commands.DeleteProduct;

public sealed record DeleteProductCommand(Guid Id) : ICommand;

public sealed class DeleteProductCommandValidator : AbstractValidator<DeleteProductCommand>
{
    public DeleteProductCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
    }
}
