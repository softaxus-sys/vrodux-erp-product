using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Application.MasterData.PaymentTerms;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.MasterData.PaymentTerms.Queries;

public sealed record GetPaymentTermsQuery : IQuery<List<PaymentTermDto>>;

public sealed class GetPaymentTermsQueryHandler(IPaymentTermRepository repo, IUnitOfWork uow)
    : IQueryHandler<GetPaymentTermsQuery, List<PaymentTermDto>>
{
    public async Task<Result<List<PaymentTermDto>>> Handle(GetPaymentTermsQuery q, CancellationToken ct)
    {
        var items = await repo.GetAllAsync(ct);

        // Lazy per-tenant seed: the original catalogue was seeded globally (TenantId = NULL), which
        // the tenant-isolation filter hides from every real tenant — see GetVisaTypesHandler for the
        // same pattern. The first time a tenant reads an empty list, give it its own editable copy.
        if (items.Count == 0)
        {
            foreach (var term in PaymentTermCatalogue.BuildDefaults())
                repo.Add(term);
            await uow.SaveChangesAsync(ct);
            items = await repo.GetAllAsync(ct);
        }

        var dtos  = items.Select(t => new PaymentTermDto(
            t.Id, t.Name, t.Code, t.DaysNet, t.AdvancePercent,
            t.Description, t.IsDefault, t.IsSystem,
            t.CreatedAt, t.UpdatedAt)).ToList();
        return Result.Success(dtos);
    }
}
