using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Application.MasterData.Vouchers.Commands;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.MasterData.Vouchers.Queries;

public sealed record GetVouchersQuery : IQuery<List<VoucherDto>>;

public sealed class GetVouchersQueryHandler(IVoucherRepository repo)
    : IQueryHandler<GetVouchersQuery, List<VoucherDto>>
{
    public async Task<Result<List<VoucherDto>>> Handle(GetVouchersQuery q, CancellationToken ct)
    {
        var items = await repo.GetAllAsync(ct);
        var dtos  = items.Select(UpsertVoucherCommandHandler.Map).ToList();
        return Result.Success(dtos);
    }
}
