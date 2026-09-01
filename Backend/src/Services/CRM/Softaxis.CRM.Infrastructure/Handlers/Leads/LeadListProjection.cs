using Softaxis.CRM.Application.Leads.Dtos;
using Softaxis.CRM.Domain.Entities;

namespace Softaxis.CRM.Infrastructure.Handlers.Leads;

/// <summary>
/// The columns the leads LIST actually shows — deliberately without Notes, Message and CustomFields.
///
/// <para><b>Why this exists.</b> Dropping those three from the DTO stopped a ~10 MB response, but
/// the query still selected them, so the database still read them off disk. On 6,019 leads that is
/// 892 physical LOB reads and <b>41 seconds</b> of I/O against 141 ms of CPU — comfortably past the
/// 30-second command timeout, which is exactly how the leads list started failing. Projecting in
/// SQL means those pages are never touched.</para>
///
/// <para>The drawer fetches the full lead by id, so nothing is lost.</para>
/// </summary>
internal sealed record LeadListRow(
    Guid Id, string FirstName, string LastName, string? Title, string? Company, string? Industry,
    string? Email, string? Phone, string? Country, string? City, string Source, string Status,
    string Priority, int Score, decimal EstimatedValue, string Currency, string? AssignedTo,
    string? CreatedDate, string? LastContactDate, string? NextFollowUp,
    string? ConvertedDealId, List<string> Tags, DateTime CreatedAt, DateTime? UpdatedAt,
    Guid? ConvertedCustomerId, string? WhatsApp, string? InterestedIn, string? Budget,
    string? Platform, string? FormName, bool? IsOrganic, string? Campaign, string? AdName,
    string? AdSetName, string? PlatformCreatedTime, Guid? AssignedToUserId,
    string? PurchaseTimeframe, Guid? TeamId);

internal static class LeadListProjection
{
    /// <summary>
    /// The SQL projection. Must stay a plain expression tree — calling a helper method inside it
    /// would make EF give up and fall back to client evaluation, which reads every column again and
    /// undoes the entire point of this file.
    /// </summary>
    public static System.Linq.Expressions.Expression<Func<Lead, LeadListRow>> Select => l =>
        new LeadListRow(
            l.Id, l.FirstName, l.LastName, l.Title, l.Company, l.Industry,
            l.Email, l.Phone, l.Country, l.City, l.Source, l.Status,
            l.Priority, l.Score, l.EstimatedValue, l.Currency, l.AssignedTo,
            l.CreatedDate, l.LastContactDate, l.NextFollowUp,
            l.ConvertedDealId, l.Tags, l.CreatedAt, l.UpdatedAt,
            l.ConvertedCustomerId, l.WhatsApp, l.InterestedIn, l.Budget,
            l.Platform, l.FormName, l.IsOrganic, l.Campaign, l.AdName,
            l.AdSetName, l.PlatformCreatedTime, l.AssignedToUserId,
            l.PurchaseTimeframe, l.TeamId);

    /// <summary>Mirrors LeadMappings.ToDto(..., forList: true): the three bulky fields are null.</summary>
    public static LeadDto ToDto(LeadListRow r, string? dealStage, decimal? dealValue) => new(
        // These columns are nullable in the database while LeadDto promises non-null strings, so the
        // empty-string default is applied here rather than handed a null the DTO says cannot occur.
        r.Id, r.FirstName, r.LastName, $"{r.FirstName} {r.LastName}".Trim(),
        r.Title ?? "", r.Company ?? "", r.Industry ?? "",
        r.Email ?? "", r.Phone ?? "", r.Country ?? "", r.City ?? "", r.Source, r.Status, r.Priority, r.Score,
        r.EstimatedValue, r.Currency, r.AssignedTo ?? "", r.CreatedDate ?? "", r.LastContactDate,
        r.NextFollowUp, null, r.ConvertedDealId, r.Tags, Array.Empty<object>(),
        r.CreatedAt, r.UpdatedAt, r.ConvertedCustomerId,
        r.WhatsApp, r.InterestedIn, r.Budget, null,
        r.Platform, r.FormName, r.IsOrganic, r.Campaign, r.AdName, r.AdSetName,
        r.PlatformCreatedTime, null, r.AssignedToUserId,
        r.PurchaseTimeframe, PurchaseUrgency.Classify(r.PurchaseTimeframe), r.TeamId, null,
        dealStage, dealValue);

    /// <summary>The outcome for one row, or nulls when it has not converted.</summary>
    public static (string? Stage, decimal? Value) OutcomeFor(
        IReadOnlyDictionary<Guid, ConvertedDealOutcomes.Outcome> outcomes, LeadListRow row)
        => Guid.TryParse(row.ConvertedDealId, out var id) && outcomes.TryGetValue(id, out var o)
            ? (o.Stage, o.Value)
            : (null, null);
}
