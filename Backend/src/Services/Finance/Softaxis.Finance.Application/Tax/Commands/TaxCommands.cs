using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Finance.Application.Tax.Dtos;

namespace Softaxis.Finance.Application.Tax.Commands;

public sealed record FileTaxPeriodCommand(Guid Id) : ICommand;

public sealed record PayTaxPeriodCommand(Guid Id) : ICommand;

public sealed record CreateTaxPeriodCommand(
    string Period, string FromDate, string ToDate, string DueDate) : ICommand<TaxPeriodDto>;

public sealed class CreateTaxPeriodValidator : AbstractValidator<CreateTaxPeriodCommand>
{
    public CreateTaxPeriodValidator()
    {
        RuleFor(x => x.Period).NotEmpty().MaximumLength(50);
        RuleFor(x => x.FromDate).NotEmpty();
        RuleFor(x => x.ToDate).NotEmpty();
        RuleFor(x => x.DueDate).NotEmpty();
    }
}
