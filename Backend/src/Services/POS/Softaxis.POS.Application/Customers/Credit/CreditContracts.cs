using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.POS.Application.DTOs;

namespace Softaxis.POS.Application.Customers.Credit;

/// <summary>One credit sale (or restaurant charge) and how much of it is still owed.</summary>
public sealed record CreditItemDto(
    Guid Id, string Date, string DueOn, string Reference, Guid? SaleId,
    decimal Amount, decimal Outstanding, int DaysOverdue);

/// <summary>One line of the customer's account: a charge, a payment, or a refund/void that took a charge back.</summary>
public sealed record CreditEntryDto(
    Guid Id, DateTime At, string Kind, decimal Amount, string Reference, string? Method, decimal BalanceAfter);

public sealed record CreditAgeingDto(decimal Current, decimal Days1To30, decimal Days31To60, decimal Days61To90, decimal Over90)
{
    public decimal Total => Current + Days1To30 + Days31To60 + Days61To90 + Over90;
    public decimal Overdue => Days1To30 + Days31To60 + Days61To90 + Over90;
}

public sealed record CustomerCreditDto(
    Guid CustomerId, string Name, string? Phone, string? Email, string? Address,
    decimal CreditLimit, decimal CreditBalance, decimal AvailableCredit, int TermsDays,
    bool OnHold, string? HoldReason,
    decimal Overdue, int OldestOverdueDays, string? NextDueOn, decimal NextDueAmount,
    string? LastPaymentOn, decimal LastPaymentAmount, decimal TotalCharged, decimal TotalPaid,
    CreditAgeingDto Ageing, IReadOnlyList<CreditItemDto> OpenItems, IReadOnlyList<CreditEntryDto> Entries);

public sealed record CreditCustomerRowDto(
    Guid CustomerId, string Name, string? Phone,
    decimal CreditLimit, decimal CreditBalance, decimal AvailableCredit, int TermsDays,
    bool OnHold, decimal Overdue, int OldestOverdueDays, string? NextDueOn, string? LastPaymentOn);

public sealed record CreditOverviewDto(
    decimal TotalOutstanding, decimal TotalOverdue, decimal TotalLimit, decimal CollectedThisMonth,
    int CustomersWithBalance, int CustomersOverdue, int NearLimit, int OnHold, decimal DueThisWeek,
    CreditAgeingDto Ageing, IReadOnlyList<CreditCustomerRowDto> Customers, bool Truncated);

public sealed record GetCustomerCreditQuery(Guid CustomerId) : IQuery<CustomerCreditDto>;
public sealed record GetCreditOverviewQuery : IQuery<CreditOverviewDto>;

public sealed record SetCreditTermsCommand(Guid CustomerId, int Days) : ICommand<CustomerDto>;
public sealed class SetCreditTermsValidator : AbstractValidator<SetCreditTermsCommand>
{
    public SetCreditTermsValidator()
    {
        RuleFor(x => x.CustomerId).NotEmpty();
        RuleFor(x => x.Days).InclusiveBetween(0, 365).WithMessage("Payment terms must be between 0 and 365 days.");
    }
}

/// <summary>Stops (or resumes) further credit for a customer. A reason is required to stop it.</summary>
public sealed record SetCreditHoldCommand(Guid CustomerId, bool Hold, string? Reason) : ICommand<CustomerDto>;
public sealed class SetCreditHoldValidator : AbstractValidator<SetCreditHoldCommand>
{
    public SetCreditHoldValidator()
    {
        RuleFor(x => x.CustomerId).NotEmpty();
        RuleFor(x => x.Reason).NotEmpty().When(x => x.Hold).WithMessage("Say why credit is being stopped.");
        RuleFor(x => x.Reason).MaximumLength(300);
    }
}
