using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Finance.Application.ReceiptVouchers.Dtos;

namespace Softaxis.Finance.Application.ReceiptVouchers.Commands;

public sealed record CreateReceiptVoucherCommand(
    Guid CustomerId, string ReceiptDate, decimal Amount, string? ReceiptMethod,
    Guid? BankAccountId, string? Reference, string? Notes,
    IReadOnlyList<ReceiptAllocationRequest> Allocations) : ICommand<ReceiptVoucherDto>;

public sealed class CreateReceiptVoucherValidator : AbstractValidator<CreateReceiptVoucherCommand>
{
    public CreateReceiptVoucherValidator()
    {
        RuleFor(x => x.CustomerId).NotEmpty();
        RuleFor(x => x.ReceiptDate).NotEmpty();
        RuleFor(x => x.Amount).GreaterThan(0);
        RuleForEach(x => x.Allocations).ChildRules(a => a.RuleFor(x => x.AmountApplied).GreaterThan(0));
    }
}

public sealed record UpdateReceiptVoucherCommand(
    Guid Id, string ReceiptDate, decimal Amount, string? ReceiptMethod,
    Guid? BankAccountId, string? Reference, string? Notes,
    IReadOnlyList<ReceiptAllocationRequest> Allocations) : ICommand;

public sealed class UpdateReceiptVoucherValidator : AbstractValidator<UpdateReceiptVoucherCommand>
{
    public UpdateReceiptVoucherValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.ReceiptDate).NotEmpty();
        RuleFor(x => x.Amount).GreaterThan(0);
        RuleForEach(x => x.Allocations).ChildRules(a => a.RuleFor(x => x.AmountApplied).GreaterThan(0));
    }
}

public sealed record PostReceiptVoucherCommand(Guid Id) : ICommand;

public sealed record VoidReceiptVoucherCommand(Guid Id) : ICommand;

public sealed record DeleteReceiptVoucherCommand(Guid Id) : ICommand;
