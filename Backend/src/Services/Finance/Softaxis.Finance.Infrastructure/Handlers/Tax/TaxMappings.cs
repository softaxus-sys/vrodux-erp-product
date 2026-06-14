using Softaxis.Finance.Application.Tax.Dtos;
using Softaxis.Finance.Domain.Entities;

namespace Softaxis.Finance.Infrastructure.Handlers.Tax;

internal static class TaxMappings
{
    public static TaxPeriodDto ToDto(TaxPeriod x) => new(
        x.Id, x.Period, x.FromDate, x.ToDate, x.Status,
        x.OutputVat, x.InputVat, x.OutputVat - x.InputVat,
        x.DueDate, x.FiledDate, x.PaidDate, x.Penalty);

    public static TaxTransactionDto ToDto(TaxTransaction x) => new(
        x.Id, x.Date, x.Type, x.Reference,
        x.Amount, x.VatAmount, x.VatRate, x.Description,
        x.Period != null ? x.Period.Period : "");
}
