using Softaxis.CRM.Application.Leads.Dtos;
using Softaxis.CRM.Domain.Entities;

namespace Softaxis.CRM.Infrastructure.Handlers.Leads;

internal static class LeadMappings
{
    /// <summary>
    /// <paramref name="dealStage"/>/<paramref name="dealValue"/> describe the opportunity this lead
    /// converted into — see <see cref="ConvertedDealOutcomes"/>. Optional so callers that do not need
    /// the outcome (or have not loaded it) map exactly as before.
    /// </summary>
    /// <param name="forList">
    /// Leave the bulky fields out. Notes, Message and CustomFields (a lead's Form Responses) are only
    /// read in the drawer, but across a whole list they dominate the response: on one real workspace
    /// 5,967 leads carried 5.7 MB of CustomFields and 3.5 MB of Notes, so a list that included them
    /// serialised about 10 MB — enough to time the request out whenever the database was busy. The
    /// drawer fetches the full lead by id, so nothing is actually lost.
    /// </param>
    public static LeadDto ToDto(Lead l, string? dealStage = null, decimal? dealValue = null, bool forList = false) => new(
        l.Id, l.FirstName, l.LastName, l.FullName, l.Title, l.Company, l.Industry,
        l.Email, l.Phone, l.Country, l.City, l.Source, l.Status, l.Priority, l.Score,
        l.EstimatedValue, l.Currency, l.AssignedTo, l.CreatedDate, l.LastContactDate,
        l.NextFollowUp, forList ? null : l.Notes, l.ConvertedDealId, l.Tags, Array.Empty<object>(),
        l.CreatedAt, l.UpdatedAt, l.ConvertedCustomerId,
        l.WhatsApp, l.InterestedIn, l.Budget, forList ? null : l.Message,
        l.Platform, l.FormName, l.IsOrganic, l.Campaign, l.AdName, l.AdSetName,
        l.PlatformCreatedTime, forList ? null : l.CustomFields, l.AssignedToUserId,
        l.PurchaseTimeframe, PurchaseUrgency.Classify(l.PurchaseTimeframe), l.TeamId, null,
        dealStage, dealValue);

    public static LeadAssignmentDto ToDto(LeadAssignment a) => new(
        a.Id, a.FromUserId, a.FromUserName, a.ToUserId, a.ToUserName,
        a.AssignedByUserId, a.AssignedByName, a.Note, a.CreatedAt);
}
