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

/// <summary>
/// Issue the invoice: post it to the ledger and email it to the customer with the PDF attached.
///
/// <para>Returns whether the email actually left, because those two things can differ. The ledger
/// posting is committed first — an invoice that is posted but not emailed can be re-sent, whereas
/// an email for an invoice that failed to save is a bill the customer holds and the books do not.
/// The caller is told which happened rather than being shown an unconditional "sent".</para>
/// </summary>
public sealed record SendInvoiceCommand(Guid Id) : ICommand<SendInvoiceResultDto>;

/// <param name="EmailSent">False when SMTP is unconfigured, the customer has no address on file,
/// or the mail server refused it. The invoice is still issued and posted in every case.</param>
public sealed record SendInvoiceResultDto(bool EmailSent, string? SentTo);

public sealed record CancelInvoiceCommand(Guid Id) : ICommand;

public sealed record DeleteInvoiceCommand(Guid Id) : ICommand;
