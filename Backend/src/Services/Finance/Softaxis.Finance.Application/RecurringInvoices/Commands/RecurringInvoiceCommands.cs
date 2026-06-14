using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Finance.Application.RecurringInvoices.Dtos;

namespace Softaxis.Finance.Application.RecurringInvoices.Commands;

public sealed record CreateRecurringInvoiceCommand(
    string TemplateName, string CustomerName, string? CustomerEmail, string Frequency,
    string StartDate, string? EndDate, int DueDays, decimal TaxRate, string? Notes,
    IReadOnlyList<LineRequest> Lines) : ICommand<RecurringDto>;

public sealed class CreateRecurringInvoiceValidator : AbstractValidator<CreateRecurringInvoiceCommand>
{
    public CreateRecurringInvoiceValidator()
    {
        RuleFor(x => x.TemplateName).NotEmpty();
        RuleFor(x => x.CustomerName).NotEmpty();
        RuleFor(x => x.Frequency).NotEmpty();
        RuleFor(x => x.StartDate).NotEmpty();
        RuleFor(x => x.Lines).NotEmpty().WithMessage("At least one line item is required.");
    }
}

public sealed record UpdateRecurringInvoiceCommand(
    Guid Id, string TemplateName, string CustomerName, string? CustomerEmail, string Frequency,
    string? EndDate, int DueDays, decimal TaxRate, string? Notes,
    IReadOnlyList<LineRequest> Lines) : ICommand;

public sealed class UpdateRecurringInvoiceValidator : AbstractValidator<UpdateRecurringInvoiceCommand>
{
    public UpdateRecurringInvoiceValidator()
    {
        RuleFor(x => x.TemplateName).NotEmpty();
        RuleFor(x => x.CustomerName).NotEmpty();
        RuleFor(x => x.Frequency).NotEmpty();
        RuleFor(x => x.Lines).NotEmpty().WithMessage("At least one line item is required.");
    }
}

public sealed record PauseRecurringInvoiceCommand(Guid Id) : ICommand;

public sealed record ResumeRecurringInvoiceCommand(Guid Id) : ICommand;

public sealed record DeleteRecurringInvoiceCommand(Guid Id) : ICommand;

public sealed record GenerateNowCommand(Guid Id) : ICommand<GenerateInvoiceResultDto>;

public sealed record RunDueCommand : ICommand<RunDueResultDto>;
