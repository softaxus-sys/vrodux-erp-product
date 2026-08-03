using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Restaurant.Application.Tables.Queries;

/// <summary>GET /api/restaurant/tables/{id}/qr-code</summary>
public sealed record GetTableQrCodeQuery(Guid TableId) : IQuery<TableQrCodeDto>;

public sealed record TableQrCodeDto(string QrCode, string Url, string QrImageDataUri);
