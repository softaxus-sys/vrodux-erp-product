using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.VisaServices.Application.VisaCases.Commands;
using Softaxis.VisaServices.Domain.Entities;
using Softaxis.VisaServices.Infrastructure.Persistence;

namespace Softaxis.VisaServices.Infrastructure.Handlers.VisaCases;

internal sealed class LinkCaseInvoiceHandler(VisaDbContext db) : ICommandHandler<LinkCaseInvoiceCommand>
{
    public async Task<Result> Handle(LinkCaseInvoiceCommand cmd, CancellationToken ct)
    {
        var vcase = await db.VisaCases.FindAsync([cmd.Id], ct);
        if (vcase is null)
            return Result.Failure(Error.NotFoundById("VisaCase", cmd.Id));

        vcase.LinkInvoice(cmd.InvoiceId, cmd.InvoiceNumber);
        db.CaseStatusEvents.Add(new CaseStatusEvent(vcase.Id, "invoice", null, null,
            $"Invoice {cmd.InvoiceNumber} generated", cmd.ByName));

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
