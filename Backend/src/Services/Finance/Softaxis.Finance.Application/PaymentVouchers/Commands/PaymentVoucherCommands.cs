using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Finance.Application.PaymentVouchers.Dtos;

namespace Softaxis.Finance.Application.PaymentVouchers.Commands;

public sealed record CreatePaymentVoucherCommand(
    Guid SupplierId, string PaymentDate, decimal Amount, string? PaymentMethod,
    Guid? BankAccountId, string? Reference, string? Notes,
    IReadOnlyList<PaymentAllocationRequest> Allocations) : ICommand<PaymentVoucherDto>;

public sealed class CreatePaymentVoucherValidator : AbstractValidator<CreatePaymentVoucherCommand>
{
    public CreatePaymentVoucherValidator()
    {
        RuleFor(x => x.SupplierId).NotEmpty();
        RuleFor(x => x.PaymentDate).NotEmpty();
        RuleFor(x => x.Amount).GreaterThan(0);
        RuleForEach(x => x.Allocations).ChildRules(a => a.RuleFor(x => x.AmountApplied).GreaterThan(0));
    }
}

public sealed record UpdatePaymentVoucherCommand(
    Guid Id, string PaymentDate, decimal Amount, string? PaymentMethod,
    Guid? BankAccountId, string? Reference, string? Notes,
    IReadOnlyList<PaymentAllocationRequest> Allocations) : ICommand;

public sealed class UpdatePaymentVoucherValidator : AbstractValidator<UpdatePaymentVoucherCommand>
{
    public UpdatePaymentVoucherValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.PaymentDate).NotEmpty();
        RuleFor(x => x.Amount).GreaterThan(0);
        RuleForEach(x => x.Allocations).ChildRules(a => a.RuleFor(x => x.AmountApplied).GreaterThan(0));
    }
}

public sealed record PostPaymentVoucherCommand(Guid Id) : ICommand;

public sealed record VoidPaymentVoucherCommand(Guid Id) : ICommand;

public sealed record DeletePaymentVoucherCommand(Guid Id) : ICommand;
