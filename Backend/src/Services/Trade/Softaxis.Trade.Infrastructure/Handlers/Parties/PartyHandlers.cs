using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Trade.Application.Parties;
using Softaxis.Trade.Domain.Entities;
using Softaxis.Trade.Infrastructure.Persistence;

namespace Softaxis.Trade.Infrastructure.Handlers.Parties;

internal static class PartyMapping
{
    public static PartyDto ToDto(TradeParty p, int shipments) => new(
        p.Id, p.Kind, p.Name, p.Country, p.ContactName, p.Email, p.Phone, p.Address, p.TaxNumber, p.Notes,
        p.IsActive, shipments);

    /// <summary>How many live shipments name this party in any role.</summary>
    public static Task<int> CountShipmentsAsync(TradeDbContext db, Guid id, CancellationToken ct) =>
        db.Shipments.AsNoTracking().CountAsync(
            s => !s.IsDeleted && (s.PartnerId == id || s.ForwarderId == id || s.AgentId == id), ct);
}

internal sealed class GetPartiesHandler(TradeDbContext db) : IQueryHandler<GetPartiesQuery, IReadOnlyList<PartyDto>>
{
    public async Task<Result<IReadOnlyList<PartyDto>>> Handle(GetPartiesQuery q, CancellationToken ct)
    {
        var query = db.Parties.AsNoTracking().Where(p => !p.IsDeleted);
        if (q.ActiveOnly) query = query.Where(p => p.IsActive);
        if (!string.IsNullOrWhiteSpace(q.Kind)) query = query.Where(p => p.Kind == q.Kind);
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            query = query.Where(p => p.Name.Contains(s) || (p.Country != null && p.Country.Contains(s))
                                  || (p.ContactName != null && p.ContactName.Contains(s))
                                  || (p.Email != null && p.Email.Contains(s)));
        }

        var parties = await query.OrderBy(p => p.Name).Take(500).ToListAsync(ct);

        // One grouped read for the "used on N shipments" figure rather than a count per party.
        var used = await db.Shipments.AsNoTracking().Where(s => !s.IsDeleted)
            .Select(s => new { s.PartnerId, s.ForwarderId, s.AgentId }).ToListAsync(ct);
        int Used(Guid id) => used.Count(s => s.PartnerId == id || s.ForwarderId == id || s.AgentId == id);

        return Result.Success<IReadOnlyList<PartyDto>>(parties.Select(p => PartyMapping.ToDto(p, Used(p.Id))).ToList());
    }
}

internal sealed class CreatePartyHandler(TradeDbContext db) : ICommandHandler<CreatePartyCommand, PartyDto>
{
    public async Task<Result<PartyDto>> Handle(CreatePartyCommand cmd, CancellationToken ct)
    {
        var i = cmd.Party;
        var name = i.Name.Trim();
        if (await db.Parties.AnyAsync(p => !p.IsDeleted && p.Kind == i.Kind && p.Name == name, ct))
            return Result.Failure<PartyDto>(Error.Custom("Party.Duplicate", $"A {i.Kind.Replace('_', ' ')} named \"{name}\" already exists."));

        var party = new TradeParty(i.Kind, name, i.Country, i.ContactName, i.Email, i.Phone, i.Address, i.TaxNumber, i.Notes);
        db.Parties.Add(party);
        await db.SaveChangesAsync(ct);
        return Result.Success(PartyMapping.ToDto(party, 0));
    }
}

internal sealed class UpdatePartyHandler(TradeDbContext db) : ICommandHandler<UpdatePartyCommand, PartyDto>
{
    public async Task<Result<PartyDto>> Handle(UpdatePartyCommand cmd, CancellationToken ct)
    {
        var party = await db.Parties.FirstOrDefaultAsync(p => p.Id == cmd.Id && !p.IsDeleted, ct);
        if (party is null) return Result.Failure<PartyDto>(Error.NotFoundById("Party", cmd.Id));

        var i = cmd.Party;
        var name = i.Name.Trim();
        if (await db.Parties.AnyAsync(p => !p.IsDeleted && p.Id != cmd.Id && p.Kind == i.Kind && p.Name == name, ct))
            return Result.Failure<PartyDto>(Error.Custom("Party.Duplicate", $"A {i.Kind.Replace('_', ' ')} named \"{name}\" already exists."));

        party.Update(i.Kind, name, i.Country, i.ContactName, i.Email, i.Phone, i.Address, i.TaxNumber, i.Notes, i.IsActive);
        await db.SaveChangesAsync(ct);
        return Result.Success(PartyMapping.ToDto(party, await PartyMapping.CountShipmentsAsync(db, party.Id, ct)));
    }
}

internal sealed class DeletePartyHandler(TradeDbContext db) : ICommandHandler<DeletePartyCommand>
{
    public async Task<Result> Handle(DeletePartyCommand cmd, CancellationToken ct)
    {
        var party = await db.Parties.FirstOrDefaultAsync(p => p.Id == cmd.Id && !p.IsDeleted, ct);
        if (party is null) return Result.Failure(Error.NotFoundById("Party", cmd.Id));

        // A shipment points at its parties by id; deleting one would leave a name that reads as blank.
        var used = await PartyMapping.CountShipmentsAsync(db, party.Id, ct);
        if (used > 0)
            return Result.Failure(Error.Custom("Party.Conflict",
                $"{used} shipment(s) use this party. Mark it inactive instead of deleting it."));

        party.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
