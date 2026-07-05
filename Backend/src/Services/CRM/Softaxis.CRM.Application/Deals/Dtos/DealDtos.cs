namespace Softaxis.CRM.Application.Deals.Dtos;

public sealed record DealContactDto(string Name, string Title, string Email, string Phone);

public sealed record DealDto(
    Guid Id, string Title, string Company, decimal Value, string Currency, string Stage,
    string Priority, int Probability, string ExpectedCloseDate, string CreatedDate,
    string AssignedTo, string Source, string Industry, string Description,
    IReadOnlyList<string> Tags, DealContactDto Contact, IReadOnlyList<object> Activities,
    string? NextAction, string? NextActionDate,
    string ForecastCategory, decimal WeightedValue, string? LossReason,
    Guid? CustomerId);

public sealed record DealsSummaryDto(
    int TotalDeals, decimal TotalValue, decimal WonValue, int LostDeals,
    decimal AvgDealSize, double WinRate,
    decimal OpenValue, decimal WeightedValue, decimal CommitValue, decimal BestCaseValue);
