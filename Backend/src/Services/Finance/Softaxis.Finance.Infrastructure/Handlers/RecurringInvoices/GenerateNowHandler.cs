using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Abstractions;
using Softaxis.Finance.Application.RecurringInvoices.Commands;
using Softaxis.Finance.Application.RecurringInvoices.Dtos;
using Softaxis.Finance.Infrastructure.Persistence;
using Softaxis.Finance.Infrastructure.Services;

namespace Softaxis.Finance.Infrastructure.Handlers.RecurringInvoices;

internal sealed class GenerateNowHandler(FinanceDbContext db, IFinanceEmailService email)
    : ICommandHandler<GenerateNowCommand, GenerateInvoiceResultDto>
{
    public async Task<Result<GenerateInvoiceResultDto>> Handle(GenerateNowCommand cmd, CancellationToken ct)
    {
        var r = await db.RecurringInvoices.Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (r is null)
            return Result.Failure<GenerateInvoiceResultDto>(Error.NotFoundById("RecurringInvoice", cmd.Id));

        var invoice = RecurringInvoiceGenerator.GenerateInvoice(r, DateTime.UtcNow);
        db.Invoices.Add(invoice);
        r.AdvanceAfterGeneration();

        // Saved before sending: an invoice that exists but was not emailed can be re-sent; an email
        // sent for an invoice that failed to save is a bill the customer has and the books do not.
        await db.SaveChangesAsync(ct);

        var emailed = false;

        if (r.AutoSend && !string.IsNullOrWhiteSpace(invoice.CustomerEmail))
        {
            emailed = await RecurringInvoiceGenerator.SendInvoiceAsync(db, invoice, r.CcList, r.CcEmails, email, ct);
            if (emailed) await db.SaveChangesAsync(ct);
        }

        return Result.Success(new GenerateInvoiceResultDto(invoice.Id, invoice.InvoiceNumber, emailed));
    }
}
