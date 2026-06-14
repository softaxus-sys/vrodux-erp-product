using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Suppliers.Dtos;
using Softaxis.Finance.Application.Suppliers.Queries;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Suppliers;

internal sealed class GetSupplierByIdHandler(FinanceDbContext db)
    : IQueryHandler<GetSupplierByIdQuery, SupplierDto>
{
    public async Task<Result<SupplierDto>> Handle(GetSupplierByIdQuery q, CancellationToken ct)
    {
        var supplier = await db.Suppliers
            .AsNoTracking()
            .Where(x => x.Id == q.Id)
            .Select(x => new
            {
                x.Id, x.Code, x.Name, x.Email, x.Phone, x.Address, x.AccountId,
                x.IsActive, x.CreatedAt, x.UpdatedAt
            })
            .FirstOrDefaultAsync(ct);

        if (supplier is null)
            return Result.Failure<SupplierDto>(Error.NotFoundById(nameof(Supplier), q.Id));

        var account = supplier.AccountId.HasValue
            ? await db.Accounts.AsNoTracking()
                .Where(x => x.Id == supplier.AccountId.Value)
                .Select(x => new { x.AccountNumber, x.Name })
                .FirstOrDefaultAsync(ct)
            : null;

        return Result.Success(new SupplierDto(
            supplier.Id, supplier.Code, supplier.Name, supplier.Email, supplier.Phone, supplier.Address,
            supplier.AccountId, account?.AccountNumber, account?.Name,
            supplier.IsActive, supplier.CreatedAt, supplier.UpdatedAt));
    }
}
