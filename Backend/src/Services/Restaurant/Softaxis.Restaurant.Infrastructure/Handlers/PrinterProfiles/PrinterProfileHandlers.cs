using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.PrinterProfiles.Commands;
using Softaxis.Restaurant.Application.PrinterProfiles.Dtos;
using Softaxis.Restaurant.Application.PrinterProfiles.Queries;
using Softaxis.Restaurant.Domain.Entities;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.PrinterProfiles;

internal static class PrinterProfileMappings
{
    public static PrinterProfileDto ToDto(PrinterProfile p) => new(
        p.Id, p.BranchId, p.Name, p.Type, p.ConnectionType, p.IpAddress, p.Port, p.IsDefault);
}

internal sealed class CreatePrinterProfileHandler(RestaurantDbContext db)
    : ICommandHandler<CreatePrinterProfileCommand, PrinterProfileDto>
{
    public async Task<Result<PrinterProfileDto>> Handle(CreatePrinterProfileCommand cmd, CancellationToken ct)
    {
        var profile = new PrinterProfile(cmd.Name.Trim(), cmd.Type, cmd.ConnectionType, cmd.IpAddress, cmd.Port, cmd.IsDefault, cmd.BranchId);
        db.PrinterProfiles.Add(profile);
        await db.SaveChangesAsync(ct);
        return Result.Success(PrinterProfileMappings.ToDto(profile));
    }
}

internal sealed class UpdatePrinterProfileHandler(RestaurantDbContext db)
    : ICommandHandler<UpdatePrinterProfileCommand, PrinterProfileDto>
{
    public async Task<Result<PrinterProfileDto>> Handle(UpdatePrinterProfileCommand cmd, CancellationToken ct)
    {
        var profile = await db.PrinterProfiles.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (profile is null) return Result.Failure<PrinterProfileDto>(Error.NotFoundById("PrinterProfile", cmd.Id));

        profile.Update(cmd.Name.Trim(), cmd.Type, cmd.ConnectionType, cmd.IpAddress, cmd.Port, cmd.IsDefault);
        await db.SaveChangesAsync(ct);
        return Result.Success(PrinterProfileMappings.ToDto(profile));
    }
}

internal sealed class DeletePrinterProfileHandler(RestaurantDbContext db) : ICommandHandler<DeletePrinterProfileCommand>
{
    public async Task<Result> Handle(DeletePrinterProfileCommand cmd, CancellationToken ct)
    {
        var profile = await db.PrinterProfiles.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (profile is null) return Result.Failure(Error.NotFoundById("PrinterProfile", cmd.Id));

        var inUse = await db.KitchenStations.AnyAsync(x => x.PrinterProfileId == cmd.Id && !x.IsDeleted, ct);
        if (inUse) return Result.Failure(Error.Custom("PrinterProfile.Conflict", "Unassign this printer from its kitchen stations first."));

        profile.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class GetPrinterProfilesHandler(RestaurantDbContext db)
    : IQueryHandler<GetPrinterProfilesQuery, IReadOnlyList<PrinterProfileDto>>
{
    public async Task<Result<IReadOnlyList<PrinterProfileDto>>> Handle(GetPrinterProfilesQuery query, CancellationToken ct)
    {
        var items = await db.PrinterProfiles.AsNoTracking().Where(x => !x.IsDeleted)
            .OrderBy(x => x.Name)
            .Select(p => new PrinterProfileDto(p.Id, p.BranchId, p.Name, p.Type, p.ConnectionType, p.IpAddress, p.Port, p.IsDefault))
            .ToListAsync(ct);
        return Result.Success<IReadOnlyList<PrinterProfileDto>>(items);
    }
}
