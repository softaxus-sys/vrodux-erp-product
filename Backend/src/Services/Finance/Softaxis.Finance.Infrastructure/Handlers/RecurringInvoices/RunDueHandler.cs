using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.RecurringInvoices.Commands;
using Softaxis.Finance.Application.RecurringInvoices.Dtos;
using Softaxis.Finance.Infrastructure.Persistence;
using Softaxis.Finance.Infrastructure.Services;

namespace Softaxis.Finance.Infrastructure.Handlers.RecurringInvoices;

internal sealed class RunDueHandler(FinanceDbContext db) : ICommandHandler<RunDueCommand, RunDueResultDto>
{
    public async Task<Result<RunDueResultDto>> Handle(RunDueCommand cmd, CancellationToken ct)
    {
        var created = await RecurringInvoiceGenerator.GenerateDueAsync(db, DateTime.UtcNow, ct);
        return Result.Success(new RunDueResultDto(created));
    }
}
