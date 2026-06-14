using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.ExchangeRates.Commands;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.ExchangeRates;

internal sealed class DeleteExchangeRateHandler(FinanceDbContext db) : ICommandHandler<DeleteExchangeRateCommand>
{
    public async Task<Result> Handle(DeleteExchangeRateCommand cmd, CancellationToken ct)
    {
        var rate = await db.ExchangeRates.FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);

        if (rate is null)
            return Result.Failure(Error.NotFoundById(nameof(ExchangeRate), cmd.Id));

        rate.Delete();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
