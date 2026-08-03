using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using QRCoder;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Tables.Queries;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Tables;

internal sealed class GetTableQrCodeHandler(RestaurantDbContext db, IConfiguration configuration)
    : IQueryHandler<GetTableQrCodeQuery, TableQrCodeDto>
{
    public async Task<Result<TableQrCodeDto>> Handle(GetTableQrCodeQuery query, CancellationToken ct)
    {
        var table = await db.Tables.AsNoTracking().FirstOrDefaultAsync(x => x.Id == query.TableId && !x.IsDeleted, ct);
        if (table is null) return Result.Failure<TableQrCodeDto>(Error.NotFoundById("Table", query.TableId));

        var frontendUrl = configuration["FrontendUrl"] ?? "http://localhost:5173";
        var url = $"{frontendUrl}/order/{table.QrCode}";

        using var generator = new QRCodeGenerator();
        using var data = generator.CreateQrCode(url, QRCodeGenerator.ECCLevel.Q);
        var png = new PngByteQRCode(data).GetGraphic(8);
        var dataUri = $"data:image/png;base64,{Convert.ToBase64String(png)}";

        return Result.Success(new TableQrCodeDto(table.QrCode, url, dataUri));
    }
}
