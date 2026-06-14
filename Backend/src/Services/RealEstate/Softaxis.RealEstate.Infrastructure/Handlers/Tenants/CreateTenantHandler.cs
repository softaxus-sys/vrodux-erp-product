using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Tenants.Commands;
using Softaxis.RealEstate.Application.Tenants.Dtos;
using Softaxis.RealEstate.Domain.Entities;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Tenants;

internal sealed class CreateTenantHandler(RealEstateDbContext db)
    : ICommandHandler<CreateTenantCommand, CreatedTenantDto>
{
    public async Task<Result<CreatedTenantDto>> Handle(CreateTenantCommand cmd, CancellationToken ct)
    {
        var t = new Tenant(cmd.Name, cmd.TenantType, cmd.Email, cmd.Phone, cmd.Nationality,
            cmd.NationalId, cmd.CompanyName, cmd.TradeLicense);

        db.Tenants.Add(t);
        await db.SaveChangesAsync(ct);

        return Result.Success(new CreatedTenantDto(t.Id, t.TenantNumber, t.Name));
    }
}
