using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Finance.Application.Invoices.Dtos;

namespace Softaxis.Finance.Application.Invoices.Commands;

public sealed record CreateInvoiceCommand(
    string CustomerName, string? CustomerEmail, string InvoiceDate, string DueDate,
    decimal TaxRate, string? Notes, IReadOnlyList<InvoiceItemRequest> Items) : ICommand<InvoiceDto>;

public sealed class CreateInvoiceValidator : AbstractValidator<CreateInvoiceCommand>
{
    public CreateInvoiceValidator()
    {
        RuleFor(x => x.CustomerName).NotEmpty();
        RuleFor(x => x.InvoiceDate).NotEmpty();
        RuleFor(x => x.DueDate).NotEmpty();
    }
}

public sealed record UpdateInvoiceCommand(
    Guid Id, string CustomerName, string? CustomerEmail, string InvoiceDate, string DueDate,
    decimal TaxRate, string? Notes, string Status, IReadOnlyList<InvoiceItemRequest> Items) : ICommand;

public sealed class UpdateInvoiceValidator : AbstractValidator<UpdateInvoiceCommand>
{
    public UpdateInvoiceValidator()
    {
        RuleFor(x => x.CustomerName).NotEmpty();
        RuleFor(x => x.InvoiceDate).NotEmpty();
        RuleFor(x => x.DueDate).NotEmpty();
        RuleFor(x => x.Status).NotEmpty();
    }
}

public sealed record MarkInvoicePaidCommand(Guid Id) : ICommand;

public sealed record SendInvoiceCommand(Guid Id) : ICommand;

public sealed record CancelInvoiceCommand(Guid Id) : ICommand;

public sealed record DeleteInvoiceCommand(Guid Id) : ICommand;
