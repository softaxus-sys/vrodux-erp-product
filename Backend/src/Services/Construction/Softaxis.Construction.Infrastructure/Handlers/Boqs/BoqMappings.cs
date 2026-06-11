using Softaxis.Construction.Application.Boqs.Dtos;
using Softaxis.Construction.Domain.Entities;

namespace Softaxis.Construction.Infrastructure.Handlers.Boqs;

internal static class BoqMappings
{
    public static BoqDto ToDto(BillOfQuantity b) => new(
        b.Id, b.ProjectId, b.ProjectName, b.Status, b.ApprovedBy, b.ApprovedDate,
        b.Items.Sum(i => i.Quantity * i.UnitRate),
        b.Items.Sum(i => i.CompletedQty * i.UnitRate),
        b.Items.Select(ToItemDto).ToList());

    private static BoqItemDto ToItemDto(BoqItem i) => new(
        i.Id, i.ItemCode, i.Description, i.Unit, i.Quantity, i.UnitRate,
        i.Quantity * i.UnitRate, i.CompletedQty, i.CompletedQty * i.UnitRate);
}
