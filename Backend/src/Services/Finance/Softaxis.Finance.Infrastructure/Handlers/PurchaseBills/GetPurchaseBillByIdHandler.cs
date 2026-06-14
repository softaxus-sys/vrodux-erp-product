using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.PurchaseBills.Dtos;
using Softaxis.Finance.Application.PurchaseBills.Queries;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.PurchaseBills;

internal sealed class GetPurchaseBillByIdHandler(FinanceDbContext db) : IQueryHandler<GetPurchaseBillByIdQuery, PurchaseBillDto>
{
    public async Task<Result<PurchaseBillDto>> Handle(GetPurchaseBillByIdQuery query, CancellationToken ct)
    {
        var bill = await db.PurchaseBills.AsNoTracking().Include(x => x.Items)
            .FirstOrDefaultAsync(x => x.Id == query.Id, ct);

        if (bill is null)
            return Result.Failure<PurchaseBillDto>(Error.NotFoundById(nameof(PurchaseBill), query.Id));

        return Result.Success(PurchaseBillMappings.ToDto(bill));
    }
}
