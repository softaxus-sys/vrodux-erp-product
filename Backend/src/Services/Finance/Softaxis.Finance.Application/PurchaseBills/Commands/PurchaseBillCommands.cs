using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Finance.Application.PurchaseBills.Dtos;

namespace Softaxis.Finance.Application.PurchaseBills.Commands;

public sealed record CreatePurchaseBillCommand(
    Guid SupplierId, string BillDate, string DueDate,
    decimal TaxRate, string? Reference, string? Notes,
    IReadOnlyList<PurchaseBillItemRequest> Items) : ICommand<PurchaseBillDto>;

public sealed class CreatePurchaseBillValidator : AbstractValidator<CreatePurchaseBillCommand>
{
    public CreatePurchaseBillValidator()
    {
        RuleFor(x => x.SupplierId).NotEmpty();
        RuleFor(x => x.BillDate).NotEmpty();
        RuleFor(x => x.DueDate).NotEmpty();
        RuleFor(x => x.Items).NotEmpty();
    }
}

public sealed record UpdatePurchaseBillCommand(
    Guid Id, string BillDate, string DueDate,
    decimal TaxRate, string? Reference, string? Notes,
    IReadOnlyList<PurchaseBillItemRequest> Items) : ICommand;

public sealed class UpdatePurchaseBillValidator : AbstractValidator<UpdatePurchaseBillCommand>
{
    public UpdatePurchaseBillValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.BillDate).NotEmpty();
        RuleFor(x => x.DueDate).NotEmpty();
        RuleFor(x => x.Items).NotEmpty();
    }
}

public sealed record ApprovePurchaseBillCommand(Guid Id) : ICommand;

public sealed record CancelPurchaseBillCommand(Guid Id) : ICommand;

public sealed record DeletePurchaseBillCommand(Guid Id) : ICommand;
