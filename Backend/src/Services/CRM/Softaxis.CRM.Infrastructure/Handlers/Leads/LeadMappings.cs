using Softaxis.CRM.Application.Leads.Dtos;
using Softaxis.CRM.Domain.Entities;

namespace Softaxis.CRM.Infrastructure.Handlers.Leads;

internal static class LeadMappings
{
    public static LeadDto ToDto(Lead l) => new(
        l.Id, l.FirstName, l.LastName, l.FullName, l.Title, l.Company, l.Industry,
        l.Email, l.Phone, l.Country, l.City, l.Source, l.Status, l.Priority, l.Score,
        l.EstimatedValue, l.Currency, l.AssignedTo, l.CreatedDate, l.LastContactDate,
        l.NextFollowUp, l.Notes, l.ConvertedDealId, l.Tags, Array.Empty<object>(),
        l.CreatedAt, l.UpdatedAt, l.ConvertedCustomerId,
        l.WhatsApp, l.InterestedIn, l.Budget, l.Message,
        l.Platform, l.FormName, l.IsOrganic, l.Campaign, l.AdName, l.AdSetName,
        l.PlatformCreatedTime, l.CustomFields, l.AssignedToUserId,
        l.PurchaseTimeframe, PurchaseUrgency.Classify(l.PurchaseTimeframe), l.TeamId);

    public static LeadAssignmentDto ToDto(LeadAssignment a) => new(
        a.Id, a.FromUserId, a.FromUserName, a.ToUserId, a.ToUserName,
        a.AssignedByUserId, a.AssignedByName, a.Note, a.CreatedAt);
}
