using Softaxis.RealEstate.Application.Contracts.Dtos;
using Softaxis.RealEstate.Domain.Entities;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Contracts;

internal static class ContractMappings
{
    public static ContractDto ToDto(LeaseContract c, string today)
    {
        var live = c.Installments.Where(i => !i.IsDeleted).ToList();

        var next     = live.Where(i => !i.IsSettled && string.CompareOrdinal(i.DueDate, today) >= 0)
                           .OrderBy(i => i.DueDate, StringComparer.Ordinal).FirstOrDefault();
        var overdue  = live.Where(i => i.IsOverdue(today)).ToList();
        var lastPaid = live.Where(i => i.PaidDate is not null)
                           .OrderByDescending(i => i.PaidDate, StringComparer.Ordinal).FirstOrDefault();

        return new ContractDto(
            c.Id, c.ContractNumber, c.PropertyId, c.PropertyName, c.UnitId, c.UnitNumber,
            c.TenantId, c.TenantName, c.StartDate, c.EndDate, c.AnnualRent, c.Cheques,
            c.SecurityDeposit, c.Status, c.TotalPaid, c.Balance, c.EjariNumber, c.Notes,
            c.PaymentFrequency,
            next?.DueDate,
            next?.Balance ?? 0,
            lastPaid?.PaidDate,
            overdue.Count,
            overdue.Sum(i => i.Balance),
            live.Count,
            DaysBetween(today, c.EndDate));
    }

    public static RentInstallmentDto ToDto(RentInstallment i, string today) => new(
        i.Id, i.ContractId, i.InstallmentNumber, i.DueDate,
        i.Amount, i.AmountPaid, i.Balance,
        // "overdue" is presentation only — the stored Status stays pending/partial so that a row
        // does not need rewriting every midnight just to stay accurate.
        i.IsOverdue(today) ? "overdue" : i.Status,
        i.DaysOverdue(today),
        i.PaidDate, i.PaymentMethod, i.Reference, i.Notes);

    /// <summary>Whole days from <paramref name="from"/> to <paramref name="to"/>; negative when past.
    /// Null rather than 0 when either date is unparseable — 0 reads as "expires today".</summary>
    public static int? DaysBetween(string from, string to) =>
        DateTime.TryParse(from, out var f) && DateTime.TryParse(to, out var t)
            ? (int)(t.Date - f.Date).TotalDays
            : null;
}
