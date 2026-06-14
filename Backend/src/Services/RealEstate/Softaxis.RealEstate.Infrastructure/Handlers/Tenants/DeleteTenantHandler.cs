using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Tenants.Commands;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Tenants;

internal sealed class DeleteTenantHandler(RealEstateDbContext db)
    : ICommandHandler<DeleteTenantCommand>
{
    public async Task<Result> Handle(DeleteTenantCommand cmd, CancellationToken ct)
    {
        var t = await db.Tenants.FindAsync([cmd.Id], ct);
        if (t is null)
            return Result.Failure(Error.NotFoundById("Tenant", cmd.Id));

        t.Delete();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
