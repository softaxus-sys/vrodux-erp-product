using Softaxis.CRM.Application.Deals.Dtos;
using Softaxis.CRM.Domain.Entities;

namespace Softaxis.CRM.Infrastructure.Handlers.Deals;

internal static class DealMappings
{
    public static DealDto ToDto(Deal d) => new(
        d.Id, d.Title, d.Company, d.Value, d.Currency, d.Stage, d.Priority, d.Probability,
        d.ExpectedCloseDate, d.CreatedDate, d.AssignedTo, d.Source, d.Industry, d.Description,
        d.Tags, new DealContactDto("", "", "", ""), Array.Empty<object>(), d.NextAction, d.NextActionDate,
        d.ForecastCategory, d.WeightedValue, d.LossReason, d.CustomerId);
}
