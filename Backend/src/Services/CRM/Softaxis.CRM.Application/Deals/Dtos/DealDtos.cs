namespace Softaxis.CRM.Application.Deals.Dtos;

public sealed record DealContactDto(string Name, string Title, string Email, string Phone);

public sealed record DealDto(
    Guid Id, string Title, string Company, decimal Value, string Currency, string Stage,
    string Priority, int Probability, string ExpectedCloseDate, string CreatedDate,
    string AssignedTo, Guid? AssignedToUserId, string Source, string Industry, string Description,
    IReadOnlyList<string> Tags, DealContactDto Contact, IReadOnlyList<object> Activities,
    string? NextAction, string? NextActionDate,
    string ForecastCategory, decimal WeightedValue, string? LossReason,
    Guid? CustomerId,
    /// <summary>Team the record belongs to — null = untagged (falls back to owner membership).</summary>
    Guid? TeamId = null,
    /// <summary>What the deal closed at, where that differs from the quoted <paramref name="Value"/>.
    /// Null on an open deal.</summary>
    decimal? ClosedValue = null,
    /// <summary>The figure that counts as money: <paramref name="ClosedValue"/> where present, else
    /// <paramref name="Value"/>. Read this rather than re-deriving it per screen.</summary>
    decimal RealizedValue = 0m);

public sealed record DealsSummaryDto(
    int TotalDeals, decimal TotalValue, decimal WonValue, int LostDeals,
    decimal AvgDealSize, double WinRate,
    decimal OpenValue, decimal WeightedValue, decimal CommitValue, decimal BestCaseValue);
