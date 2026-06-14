using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Purchase.Application.GoodsReceiptNotes.Dtos;

namespace Softaxis.Purchase.Application.GoodsReceiptNotes.Queries;

public sealed record GetGoodsReceiptNotesQuery(
    Guid?  PurchaseOrderId = null,
    Guid?  VendorId        = null
) : IQuery<IReadOnlyList<GoodsReceiptNoteSummaryDto>>;

public sealed record GetGoodsReceiptNoteByIdQuery(Guid Id) : IQuery<GoodsReceiptNoteDto>;
