using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Trade.Application.Abstractions;
using Softaxis.Trade.Application.Shipments;
using Softaxis.Trade.Domain.Entities;
using Softaxis.Trade.Infrastructure.Persistence;

namespace Softaxis.Trade.Infrastructure.Handlers.Shipments;

internal sealed class GetShipmentsHandler(TradeDbContext db) : IQueryHandler<GetShipmentsQuery, Paged<ShipmentSummaryDto>>
{
    public async Task<Result<Paged<ShipmentSummaryDto>>> Handle(GetShipmentsQuery q, CancellationToken ct)
    {
        var query = db.Shipments.AsNoTracking().Where(s => !s.IsDeleted);

        if (!string.IsNullOrWhiteSpace(q.Direction)) query = query.Where(s => s.Direction == q.Direction);
        if (!string.IsNullOrWhiteSpace(q.Status))    query = query.Where(s => s.Status == q.Status);
        if (q.PartnerId.HasValue)                    query = query.Where(s => s.PartnerId == q.PartnerId);
        if (q.OpenOnly)
            query = query.Where(s => s.Status != ShipmentStatus.Delivered && s.Status != ShipmentStatus.Closed
                                  && s.Status != ShipmentStatus.Cancelled);

        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var term = q.Search.Trim();
            var partners = db.Parties.Where(p => !p.IsDeleted && p.Name.Contains(term)).Select(p => p.Id);
            query = query.Where(s => s.ShipmentNumber.Contains(term)
                || (s.BlNumber != null && s.BlNumber.Contains(term))
                || (s.OrderReference != null && s.OrderReference.Contains(term))
                || (s.VesselOrFlight != null && s.VesselOrFlight.Contains(term))
                || (s.PartnerId != null && partners.Contains(s.PartnerId.Value))
                || s.Containers.Any(c => c.Number.Contains(term)));
        }

        var total = await query.CountAsync(ct);
        var page  = Math.Max(1, q.Page);
        var size  = Math.Clamp(q.PageSize, 1, 200);

        var rows = await query
            .OrderByDescending(s => s.CreatedAt)
            .Skip((page - 1) * size).Take(size)
            .Select(s => new
            {
                s.Id, s.ShipmentNumber, s.Direction, s.Status, s.Mode, s.PartnerId, s.OrderReference, s.Incoterm, s.BlNumber,
                s.OriginCountry, s.OriginPort, s.DestinationCountry, s.DestinationPort, s.Etd, s.Eta, s.ArrivedOn, s.FreeDays,
                s.Currency, s.CreatedAt,
                Goods = s.Items.Sum(i => (decimal?)(i.Quantity * i.UnitPrice)) ?? 0m,
                Items = s.Items.Count(), Containers = s.Containers.Count(),
            })
            .ToListAsync(ct);

        var partnerIds = rows.Where(r => r.PartnerId.HasValue).Select(r => r.PartnerId!.Value).Distinct().ToList();
        var names = partnerIds.Count == 0
            ? new Dictionary<Guid, string>()
            : await db.Parties.AsNoTracking().Where(p => partnerIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id, p => p.Name, ct);

        var items = rows.Select(r => new ShipmentSummaryDto(
            r.Id, r.ShipmentNumber, r.Direction, r.Status, r.Mode, r.PartnerId,
            r.PartnerId.HasValue && names.TryGetValue(r.PartnerId.Value, out var n) ? n : null,
            r.OrderReference, r.Incoterm, r.BlNumber, r.OriginCountry, r.OriginPort, r.DestinationCountry, r.DestinationPort,
            r.Etd, r.Eta, r.ArrivedOn is { } a && r.FreeDays is { } d ? a.AddDays(d) : null,
            r.Currency, Math.Round(r.Goods, 2), r.Items, r.Containers, r.CreatedAt)).ToList();

        return Result.Success(new Paged<ShipmentSummaryDto>(items, total));
    }
}

internal sealed class GetShipmentByIdHandler(TradeDbContext db, ICurrentUser user) : IQueryHandler<GetShipmentByIdQuery, ShipmentDto>
{
    public async Task<Result<ShipmentDto>> Handle(GetShipmentByIdQuery q, CancellationToken ct)
    {
        var s = await ShipmentSupport.LoadAsync(db, q.Id, ct, tracking: false);
        return s is null
            ? Result.Failure<ShipmentDto>(Error.NotFoundById("Shipment", q.Id))
            : Result.Success(await ShipmentSupport.ToDtoAsync(db, s, user, ct));
    }
}

/// <summary>Checks the parties a shipment names exist and are of a sensible kind.</summary>
internal static class PartyChecks
{
    public static async Task<Error?> ValidateAsync(TradeDbContext db, ShipmentInput i, CancellationToken ct)
    {
        var ids = new[] { i.PartnerId, i.ForwarderId, i.AgentId }.Where(x => x.HasValue).Select(x => x!.Value).Distinct().ToList();
        if (ids.Count == 0) return null;

        var found = await db.Parties.AsNoTracking().Where(p => !p.IsDeleted && ids.Contains(p.Id)).Select(p => p.Id).ToListAsync(ct);
        var missing = ids.FirstOrDefault(id => !found.Contains(id));
        return missing == Guid.Empty ? null : Error.NotFoundById("Party", missing);
    }
}

internal sealed class CreateShipmentHandler(TradeDbContext db, ICurrentUser user) : ICommandHandler<CreateShipmentCommand, ShipmentDto>
{
    public async Task<Result<ShipmentDto>> Handle(CreateShipmentCommand cmd, CancellationToken ct)
    {
        var i = cmd.Input;
        if (await PartyChecks.ValidateAsync(db, i, ct) is { } bad) return Result.Failure<ShipmentDto>(bad);

        var s = new Shipment(i.Direction);
        s.SetDetails(i.Mode, i.PartnerId, i.ForwarderId, i.AgentId, i.OrderReference, i.Incoterm, i.BlNumber, i.CarrierName,
            i.VesselOrFlight, i.OriginCountry, i.OriginPort, i.DestinationCountry, i.DestinationPort,
            i.Etd, i.Eta, i.FreeDays, i.Currency, i.ExchangeRate, i.Notes, i.LinkedOrderType, i.LinkedOrderId);
        s.ReplaceItems(ShipmentSupport.BuildItems(i.Items));
        s.ReplaceContainers(ShipmentSupport.BuildContainers(i.Containers));
        s.LogCreated(TradeDates.Today(cmd.Today), user.Name);

        db.Shipments.Add(s);
        await db.SaveChangesAsync(ct);
        return Result.Success(await ShipmentSupport.ToDtoAsync(db, s, user, ct));
    }
}

internal sealed class UpdateShipmentHandler(TradeDbContext db, ICurrentUser user) : ICommandHandler<UpdateShipmentCommand, ShipmentDto>
{
    public async Task<Result<ShipmentDto>> Handle(UpdateShipmentCommand cmd, CancellationToken ct)
    {
        var s = await ShipmentSupport.LoadAsync(db, cmd.Id, ct);
        if (s is null) return Result.Failure<ShipmentDto>(Error.NotFoundById("Shipment", cmd.Id));
        if (s.Status is ShipmentStatus.Closed or ShipmentStatus.Cancelled)
            return Result.Failure<ShipmentDto>(Error.Custom("Shipment.Conflict", $"A {s.Status} shipment cannot be edited."));

        var i = cmd.Input;
        if (await PartyChecks.ValidateAsync(db, i, ct) is { } bad) return Result.Failure<ShipmentDto>(bad);

        // The direction is part of what the shipment IS (it decides who pays whom); it is set once.
        s.SetDetails(i.Mode, i.PartnerId, i.ForwarderId, i.AgentId, i.OrderReference, i.Incoterm, i.BlNumber, i.CarrierName,
            i.VesselOrFlight, i.OriginCountry, i.OriginPort, i.DestinationCountry, i.DestinationPort,
            i.Etd, i.Eta, i.FreeDays, i.Currency, i.ExchangeRate, i.Notes, i.LinkedOrderType, i.LinkedOrderId);
        s.ReplaceItems(ShipmentSupport.BuildItems(i.Items));
        s.ReplaceContainers(ShipmentSupport.BuildContainers(i.Containers));

        await db.SaveChangesAsync(ct);
        return Result.Success(await ShipmentSupport.ToDtoAsync(db, s, user, ct));
    }
}

internal sealed class ChangeShipmentStatusHandler(TradeDbContext db, ICurrentUser user)
    : ICommandHandler<ChangeShipmentStatusCommand, ShipmentDto>
{
    public async Task<Result<ShipmentDto>> Handle(ChangeShipmentStatusCommand cmd, CancellationToken ct)
    {
        var s = await ShipmentSupport.LoadAsync(db, cmd.Id, ct);
        if (s is null) return Result.Failure<ShipmentDto>(Error.NotFoundById("Shipment", cmd.Id));

        // The date is when it HAPPENED, so a backdated one is kept as given (the validator stops
        // the future); only a missing date falls back to today.
        if (!s.MoveTo(cmd.Status, cmd.Date ?? TradeDates.Today(null), cmd.Note, user.Name))
            return Result.Failure<ShipmentDto>(Error.Custom("Shipment.InvalidTransition",
                $"A {s.Status.Replace('_', ' ')} shipment cannot move to {cmd.Status.Replace('_', ' ')}."));

        await db.SaveChangesAsync(ct);
        return Result.Success(await ShipmentSupport.ToDtoAsync(db, s, user, ct));
    }
}

internal sealed class DeleteShipmentHandler(TradeDbContext db) : ICommandHandler<DeleteShipmentCommand>
{
    public async Task<Result> Handle(DeleteShipmentCommand cmd, CancellationToken ct)
    {
        var s = await ShipmentSupport.LoadAsync(db, cmd.Id, ct);
        if (s is null) return Result.Failure(Error.NotFoundById("Shipment", cmd.Id));

        // Once cargo has moved, the shipment is a record. Cancel it instead of deleting it.
        if (s.Status is not (ShipmentStatus.Booked or ShipmentStatus.Cancelled))
            return Result.Failure(Error.Custom("Shipment.Conflict", "Only a booked or cancelled shipment can be deleted. Cancel it instead."));
        if (s.Payments.Any(p => p.Status == PaymentStatus.Paid))
            return Result.Failure(Error.Custom("Shipment.Conflict", "Payments are recorded against this shipment, so it cannot be deleted."));

        var docs = await db.Documents.Where(d => d.ShipmentId == s.Id && !d.IsDeleted).ToListAsync(ct);
        foreach (var d in docs) d.Delete();

        s.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
