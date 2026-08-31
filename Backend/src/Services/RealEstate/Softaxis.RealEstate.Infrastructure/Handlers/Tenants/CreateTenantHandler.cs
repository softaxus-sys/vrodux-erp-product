using Microsoft.EntityFrameworkCore;
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
        var email = cmd.Email.Trim();

        // Reminders are addressed by tenant, so two records sharing an address means one person
        // gets both leases' notices and nobody can tell which is which. Caught here with a readable
        // message rather than left to a unique-index violation.
        var duplicate = await db.Tenants.AsNoTracking()
            .AnyAsync(t => !t.IsDeleted && t.Email == email, ct);
        if (duplicate)
            return Result.Failure<CreatedTenantDto>(Error.Custom("Tenant.Duplicate",
                $"A tenant with the email {email} already exists."));

        var t = new Tenant(cmd.Name.Trim(), cmd.TenantType, email, cmd.Phone.Trim(), cmd.Nationality.Trim(),
            cmd.NationalId, cmd.CompanyName, cmd.TradeLicense);

        t.SetProfile(cmd.PassportNumber, cmd.Trn, cmd.Occupation,
            cmd.MonthlyIncome, cmd.EmergencyContact, cmd.Notes);
        t.SetStatus(cmd.Status);

        db.Tenants.Add(t);
        await db.SaveChangesAsync(ct);

        return Result.Success(new CreatedTenantDto(t.Id, t.TenantNumber, t.Name));
    }
}
