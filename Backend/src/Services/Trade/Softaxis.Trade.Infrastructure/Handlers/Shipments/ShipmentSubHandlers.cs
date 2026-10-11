using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Trade.Application.Abstractions;
using Softaxis.Trade.Application.Shipments;
using Softaxis.Trade.Domain.Entities;
using Softaxis.Trade.Infrastructure.Persistence;

namespace Softaxis.Trade.Infrastructure.Handlers.Shipments;

/// <summary>Costs, payments and documents: everything that hangs off a shipment after it is booked.</summary>
internal static class SubResources
{
    /// <summary>A shipment that is finished or cancelled takes no new costs or payments.</summary>
    public static Error? Closed(Shipment s) =>
        s.Status is ShipmentStatus.Closed or ShipmentStatus.Cancelled
            ? Error.Custom("Shipment.Conflict", $"A {s.Status} shipment takes no further changes.")
            : null;
}

// ── Costs ───────────────────────────────────────────────────────────────────

internal sealed class AddShipmentCostHandler(TradeDbContext db, ICurrentUser user) : ICommandHandler<AddShipmentCostCommand, ShipmentDto>
{
    public async Task<Result<ShipmentDto>> Handle(AddShipmentCostCommand cmd, CancellationToken ct)
    {
        var s = await ShipmentSupport.LoadAsync(db, cmd.ShipmentId, ct);
        if (s is null) return Result.Failure<ShipmentDto>(Error.NotFoundById("Shipment", cmd.ShipmentId));
        if (SubResources.Closed(s) is { } e) return Result.Failure<ShipmentDto>(e);

        var c = cmd.Cost;
        // Added through the context, not the collection: the shipment is already tracked, and a new
        // child reached only through a collection is not always detected as Added.
        db.Costs.Add(new ShipmentCost(s.Id, c.Type, c.Description, c.Amount, c.Basis ?? AllocationBasis.Value,
            c.VendorName, c.InvoiceReference, c.PaidOn));
        await db.SaveChangesAsync(ct);

        var fresh = (await ShipmentSupport.LoadAsync(db, s.Id, ct, tracking: false))!;
        return Result.Success(await ShipmentSupport.ToDtoAsync(db, fresh, user, ct));
    }
}

internal sealed class UpdateShipmentCostHandler(TradeDbContext db, ICurrentUser user) : ICommandHandler<UpdateShipmentCostCommand, ShipmentDto>
{
    public async Task<Result<ShipmentDto>> Handle(UpdateShipmentCostCommand cmd, CancellationToken ct)
    {
        var s = await ShipmentSupport.LoadAsync(db, cmd.ShipmentId, ct);
        if (s is null) return Result.Failure<ShipmentDto>(Error.NotFoundById("Shipment", cmd.ShipmentId));
        if (SubResources.Closed(s) is { } e) return Result.Failure<ShipmentDto>(e);

        var cost = s.Costs.FirstOrDefault(c => c.Id == cmd.CostId);
        if (cost is null) return Result.Failure<ShipmentDto>(Error.NotFoundById("Cost", cmd.CostId));

        var c = cmd.Cost;
        cost.Update(c.Type, c.Description, c.Amount, c.Basis ?? AllocationBasis.Value, c.VendorName, c.InvoiceReference, c.PaidOn);
        await db.SaveChangesAsync(ct);
        return Result.Success(await ShipmentSupport.ToDtoAsync(db, s, user, ct));
    }
}

internal sealed class RemoveShipmentCostHandler(TradeDbContext db, ICurrentUser user) : ICommandHandler<RemoveShipmentCostCommand, ShipmentDto>
{
    public async Task<Result<ShipmentDto>> Handle(RemoveShipmentCostCommand cmd, CancellationToken ct)
    {
        var s = await ShipmentSupport.LoadAsync(db, cmd.ShipmentId, ct);
        if (s is null) return Result.Failure<ShipmentDto>(Error.NotFoundById("Shipment", cmd.ShipmentId));
        if (SubResources.Closed(s) is { } e) return Result.Failure<ShipmentDto>(e);

        var cost = s.Costs.FirstOrDefault(c => c.Id == cmd.CostId);
        if (cost is null) return Result.Failure<ShipmentDto>(Error.NotFoundById("Cost", cmd.CostId));

        s.RemoveCost(cost);
        db.Costs.Remove(cost);
        await db.SaveChangesAsync(ct);
        return Result.Success(await ShipmentSupport.ToDtoAsync(db, s, user, ct));
    }
}

// ── Payments ────────────────────────────────────────────────────────────────

internal sealed class AddShipmentPaymentHandler(TradeDbContext db, ICurrentUser user) : ICommandHandler<AddShipmentPaymentCommand, ShipmentDto>
{
    public async Task<Result<ShipmentDto>> Handle(AddShipmentPaymentCommand cmd, CancellationToken ct)
    {
        var s = await ShipmentSupport.LoadAsync(db, cmd.ShipmentId, ct);
        if (s is null) return Result.Failure<ShipmentDto>(Error.NotFoundById("Shipment", cmd.ShipmentId));
        if (SubResources.Closed(s) is { } e) return Result.Failure<ShipmentDto>(e);

        var p = cmd.Payment;
        db.Payments.Add(new ShipmentPayment(s.Id, p.Kind, p.Amount, p.DueDate, p.PaidOn, p.Reference, p.LcNumber,
            p.BankName, p.LcExpiry, p.Notes));
        await db.SaveChangesAsync(ct);

        var fresh = (await ShipmentSupport.LoadAsync(db, s.Id, ct, tracking: false))!;
        return Result.Success(await ShipmentSupport.ToDtoAsync(db, fresh, user, ct));
    }
}

internal sealed class UpdateShipmentPaymentHandler(TradeDbContext db, ICurrentUser user) : ICommandHandler<UpdateShipmentPaymentCommand, ShipmentDto>
{
    public async Task<Result<ShipmentDto>> Handle(UpdateShipmentPaymentCommand cmd, CancellationToken ct)
    {
        var s = await ShipmentSupport.LoadAsync(db, cmd.ShipmentId, ct);
        if (s is null) return Result.Failure<ShipmentDto>(Error.NotFoundById("Shipment", cmd.ShipmentId));
        if (SubResources.Closed(s) is { } e) return Result.Failure<ShipmentDto>(e);

        var pay = s.Payments.FirstOrDefault(x => x.Id == cmd.PaymentId);
        if (pay is null) return Result.Failure<ShipmentDto>(Error.NotFoundById("Payment", cmd.PaymentId));

        var p = cmd.Payment;
        pay.Update(p.Kind, p.Amount, p.DueDate, p.PaidOn, p.Reference, p.LcNumber, p.BankName, p.LcExpiry, p.Notes);
        await db.SaveChangesAsync(ct);
        return Result.Success(await ShipmentSupport.ToDtoAsync(db, s, user, ct));
    }
}

internal sealed class RemoveShipmentPaymentHandler(TradeDbContext db, ICurrentUser user) : ICommandHandler<RemoveShipmentPaymentCommand, ShipmentDto>
{
    public async Task<Result<ShipmentDto>> Handle(RemoveShipmentPaymentCommand cmd, CancellationToken ct)
    {
        var s = await ShipmentSupport.LoadAsync(db, cmd.ShipmentId, ct);
        if (s is null) return Result.Failure<ShipmentDto>(Error.NotFoundById("Shipment", cmd.ShipmentId));
        if (SubResources.Closed(s) is { } e) return Result.Failure<ShipmentDto>(e);

        var pay = s.Payments.FirstOrDefault(x => x.Id == cmd.PaymentId);
        if (pay is null) return Result.Failure<ShipmentDto>(Error.NotFoundById("Payment", cmd.PaymentId));

        // Money that has actually moved is a record; it is corrected by editing, not by erasing it.
        if (pay.Status == PaymentStatus.Paid)
            return Result.Failure<ShipmentDto>(Error.Custom("Payment.Conflict", "A payment that has been made cannot be deleted. Edit it instead."));

        s.RemovePayment(pay);
        db.Payments.Remove(pay);
        await db.SaveChangesAsync(ct);
        return Result.Success(await ShipmentSupport.ToDtoAsync(db, s, user, ct));
    }
}

// ── Documents ───────────────────────────────────────────────────────────────

internal static class DocumentMapping
{
    public static DocumentDto ToDto(TradeDocument d, string? shipmentNumber = null) => new(
        d.Id, d.ShipmentId, shipmentNumber, d.Type, d.Number, d.IssueDate, d.ExpiryDate, d.Notes,
        d.FileName, d.ContentType, d.SizeBytes, d.FileName != null && d.SizeBytes > 0, d.CreatedAt);

    /// <summary>The decoded file, null when none was sent, or an error when it is not valid or too large.</summary>
    public static (byte[]? Bytes, Error? Error) Decode(string? base64)
    {
        if (string.IsNullOrWhiteSpace(base64)) return (null, null);

        // A data URI ("data:application/pdf;base64,....") is accepted too.
        var comma = base64.IndexOf(',');
        var raw = base64.StartsWith("data:", StringComparison.OrdinalIgnoreCase) && comma > 0 ? base64[(comma + 1)..] : base64;

        // Reject by length first: decoding a huge string just to measure it wastes memory.
        if (raw.Length / 4 * 3 > TradeRules.MaxDocumentBytes + 4)
            return (null, Error.Custom("Document.Invalid", $"The file is larger than {TradeRules.MaxDocumentBytes / 1024 / 1024} MB."));

        try
        {
            var bytes = Convert.FromBase64String(raw);
            return bytes.Length > TradeRules.MaxDocumentBytes
                ? (null, Error.Custom("Document.Invalid", $"The file is larger than {TradeRules.MaxDocumentBytes / 1024 / 1024} MB."))
                : (bytes, null);
        }
        catch (FormatException)
        {
            return (null, Error.Custom("Document.Invalid", "The file could not be read."));
        }
    }
}

internal sealed class AddDocumentHandler(TradeDbContext db) : ICommandHandler<AddDocumentCommand, DocumentDto>
{
    public async Task<Result<DocumentDto>> Handle(AddDocumentCommand cmd, CancellationToken ct)
    {
        var s = await db.Shipments.AsNoTracking().Where(x => x.Id == cmd.ShipmentId && !x.IsDeleted)
            .Select(x => new { x.Id, x.Status }).FirstOrDefaultAsync(ct);
        if (s is null) return Result.Failure<DocumentDto>(Error.NotFoundById("Shipment", cmd.ShipmentId));
        if (s.Status == ShipmentStatus.Cancelled)
            return Result.Failure<DocumentDto>(Error.Custom("Shipment.Conflict", "A cancelled shipment takes no further changes."));

        var d = cmd.Document;
        var (bytes, error) = DocumentMapping.Decode(d.ContentBase64);
        if (error is not null) return Result.Failure<DocumentDto>(error);

        var doc = new TradeDocument(s.Id, d.Type, d.Number, d.IssueDate, d.ExpiryDate, d.Notes, d.FileName, d.ContentType, bytes);
        db.Documents.Add(doc);
        await db.SaveChangesAsync(ct);
        return Result.Success(DocumentMapping.ToDto(doc));
    }
}

internal sealed class UpdateDocumentHandler(TradeDbContext db) : ICommandHandler<UpdateDocumentCommand, DocumentDto>
{
    public async Task<Result<DocumentDto>> Handle(UpdateDocumentCommand cmd, CancellationToken ct)
    {
        var doc = await db.Documents.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (doc is null) return Result.Failure<DocumentDto>(Error.NotFoundById("Document", cmd.Id));

        var d = cmd.Document;
        var (bytes, error) = DocumentMapping.Decode(d.ContentBase64);
        if (error is not null) return Result.Failure<DocumentDto>(error);

        doc.Update(d.Type, d.Number, d.IssueDate, d.ExpiryDate, d.Notes);
        // A new file replaces the old one; leaving it out keeps what is there.
        if (bytes is { Length: > 0 }) doc.AttachFile(d.FileName, d.ContentType, bytes);

        await db.SaveChangesAsync(ct);
        return Result.Success(DocumentMapping.ToDto(doc));
    }
}

internal sealed class DeleteDocumentHandler(TradeDbContext db) : ICommandHandler<DeleteDocumentCommand>
{
    public async Task<Result> Handle(DeleteDocumentCommand cmd, CancellationToken ct)
    {
        var doc = await db.Documents.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (doc is null) return Result.Failure(Error.NotFoundById("Document", cmd.Id));

        doc.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class GetDocumentFileHandler(TradeDbContext db) : IQueryHandler<GetDocumentFileQuery, FileDto>
{
    public async Task<Result<FileDto>> Handle(GetDocumentFileQuery q, CancellationToken ct)
    {
        var doc = await db.Documents.AsNoTracking().FirstOrDefaultAsync(x => x.Id == q.Id && !x.IsDeleted, ct);
        if (doc is null) return Result.Failure<FileDto>(Error.NotFoundById("Document", q.Id));
        if (doc.Content is not { Length: > 0 })
            return Result.Failure<FileDto>(Error.Custom("Document.NotFound", "No file was uploaded for this document."));

        return Result.Success(new FileDto(doc.FileName ?? "document", doc.ContentType ?? "application/octet-stream", doc.Content));
    }
}
