using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Abstractions;
using Softaxis.Finance.Application.RecurringInvoices.Commands;
using Softaxis.Finance.Application.RecurringInvoices.Dtos;
using Softaxis.Finance.Infrastructure.Persistence;
using Softaxis.Finance.Infrastructure.Services;

namespace Softaxis.Finance.Infrastructure.Handlers.RecurringInvoices;

internal sealed class RunDueHandler(FinanceDbContext db, IFinanceEmailService email)
    : ICommandHandler<RunDueCommand, RunDueResultDto>
{
    public async Task<Result<RunDueResultDto>> Handle(RunDueCommand cmd, CancellationToken ct)
    {
        // Runs inside a request, so the ambient tenant is resolved and the generated invoices are
        // stamped correctly — unlike the old background path, which produced NULL-tenant rows
        // nobody could see.
        var result = await RecurringInvoiceGenerator.GenerateDueAsync(db, DateTime.UtcNow, email, ct);
        return Result.Success(new RunDueResultDto(result.Created, result.Emailed, result.EmailFailed));
    }
}
