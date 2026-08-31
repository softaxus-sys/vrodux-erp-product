using Softaxis.Finance.Application.RecurringInvoices.Dtos;
using Softaxis.Finance.Domain.Entities;

namespace Softaxis.Finance.Infrastructure.Handlers.RecurringInvoices;

internal static class RecurringInvoiceMappings
{
    public static RecurringDto ToDto(RecurringInvoice r)
    {
        var sub = r.Lines.Sum(l => l.Quantity * l.UnitPrice);
        return new RecurringDto(
            r.Id, r.TemplateName, r.CustomerName, r.CustomerEmail,
            r.Frequency, r.StartDate.ToString("yyyy-MM-dd"), r.EndDate?.ToString("yyyy-MM-dd"),
            r.NextRunDate.ToString("yyyy-MM-dd"), r.DueDays, r.TaxRate, r.Notes, r.IsActive,
            r.LastGeneratedDate?.ToString("yyyy-MM-dd"), r.GeneratedCount,
            sub, Math.Round(sub + sub * r.TaxRate / 100m, 2),
            r.Lines.Select(l => new LineDto(l.Id, l.Description, l.Quantity, l.UnitPrice)).ToList(),
            r.CcEmails, r.AutoSend);
    }

    public static DateTime ParseDate(string s) =>
        DateTime.TryParse(s, out var d) ? d : DateTime.UtcNow.Date;

    public static DateTime? ParseNullableDate(string? s) =>
        string.IsNullOrWhiteSpace(s) ? null : (DateTime.TryParse(s, out var d) ? d : null);
}
