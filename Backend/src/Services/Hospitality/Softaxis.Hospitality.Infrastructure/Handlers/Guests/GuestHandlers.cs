using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Hospitality.Application.Guests;
using Softaxis.Hospitality.Domain.Entities;
using Softaxis.Hospitality.Infrastructure.Handlers.Bookings;
using Softaxis.Hospitality.Infrastructure.Persistence;

namespace Softaxis.Hospitality.Infrastructure.Handlers.Guests;

internal static class GuestMappings
{
    public static GuestDto ToDto(Guest g) => new(
        g.Id, g.FullName, g.Email, g.Phone, g.Nationality, g.DocumentType, g.DocumentNumber, g.DocumentExpiry,
        g.DateOfBirth, g.Address, g.Company, g.IsVip, g.Notes, g.StayCount, g.TotalSpent, g.LastStayOn, g.CreatedAt);
}

internal sealed class GetGuestsHandler(HospitalityDbContext db) : IQueryHandler<GetGuestsQuery, PagedResult<GuestDto>>
{
    public async Task<Result<PagedResult<GuestDto>>> Handle(GetGuestsQuery query, CancellationToken ct)
    {
        var page = Math.Max(1, query.Page);
        var size = Math.Clamp(query.PageSize, 1, 200);
        var q = db.Guests.AsNoTracking().Where(g => !g.IsDeleted);
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var s = query.Search.Trim();
            q = q.Where(g => g.FullName.Contains(s) || (g.Email != null && g.Email.Contains(s))
                          || (g.Phone != null && g.Phone.Contains(s)) || (g.DocumentNumber != null && g.DocumentNumber.Contains(s))
                          || (g.Company != null && g.Company.Contains(s)));
        }
        var total = await q.CountAsync(ct);
        var items = await q.OrderByDescending(g => g.IsVip).ThenBy(g => g.FullName).ThenBy(g => g.Id)
            .Skip((page - 1) * size).Take(size).ToListAsync(ct);
        return Result.Success(PagedResult<GuestDto>.Create(items.Select(GuestMappings.ToDto).ToList(), total, page, size));
    }
}

internal sealed class GetGuestByIdHandler(HospitalityDbContext db) : IQueryHandler<GetGuestByIdQuery, GuestDetailDto>
{
    public async Task<Result<GuestDetailDto>> Handle(GetGuestByIdQuery q, CancellationToken ct)
    {
        var g = await db.Guests.AsNoTracking().FirstOrDefaultAsync(x => x.Id == q.Id && !x.IsDeleted, ct);
        if (g is null) return Result.Failure<GuestDetailDto>(Error.NotFoundById("Guest", q.Id));
        var stays = await db.Bookings.AsNoTracking().Where(b => b.GuestId == g.Id && !b.IsDeleted)
            .OrderByDescending(b => b.CheckIn).Take(100).ToListAsync(ct);
        return Result.Success(new GuestDetailDto(GuestMappings.ToDto(g), stays.Select(BookingMappings.ToDto).ToList()));
    }
}

internal sealed class UpsertGuestHandler(HospitalityDbContext db) : ICommandHandler<UpsertGuestCommand, GuestDto>
{
    public async Task<Result<GuestDto>> Handle(UpsertGuestCommand cmd, CancellationToken ct)
    {
        var email = Guest.Norm(cmd.Email);
        // One profile per email address, or a returning guest's history splits across cards.
        if (email is not null && await db.Guests.AnyAsync(g => !g.IsDeleted && g.Email == email && g.Id != cmd.Id, ct))
            return Result.Failure<GuestDto>(Error.Custom("Guest.Duplicate", $"A guest with the email {email} already exists."));

        Guest guest;
        if (cmd.Id is null)
        {
            guest = new Guest(cmd.FullName, cmd.Email, cmd.Phone, cmd.Nationality);
            db.Guests.Add(guest);
        }
        else
        {
            guest = (await db.Guests.FirstOrDefaultAsync(g => g.Id == cmd.Id && !g.IsDeleted, ct))!;
            if (guest is null) return Result.Failure<GuestDto>(Error.NotFoundById("Guest", cmd.Id));
        }
        guest.Update(cmd.FullName, cmd.Email, cmd.Phone, cmd.Nationality, cmd.DocumentType, cmd.DocumentNumber,
            cmd.DocumentExpiry, cmd.DateOfBirth, cmd.Address, cmd.Company, cmd.IsVip, cmd.Notes);
        await db.SaveChangesAsync(ct);
        return Result.Success(GuestMappings.ToDto(guest));
    }
}

internal sealed class DeleteGuestHandler(HospitalityDbContext db) : ICommandHandler<DeleteGuestCommand>
{
    public async Task<Result> Handle(DeleteGuestCommand cmd, CancellationToken ct)
    {
        var guest = await db.Guests.FirstOrDefaultAsync(g => g.Id == cmd.Id && !g.IsDeleted, ct);
        if (guest is null) return Result.Failure(Error.NotFoundById("Guest", cmd.Id));
        if (await db.Bookings.AnyAsync(b => b.GuestId == cmd.Id && !b.IsDeleted && (b.Status == "confirmed" || b.Status == "checked_in"), ct))
            return Result.Failure(Error.Custom("Guest.Conflict", "This guest has an upcoming or current stay."));
        guest.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
