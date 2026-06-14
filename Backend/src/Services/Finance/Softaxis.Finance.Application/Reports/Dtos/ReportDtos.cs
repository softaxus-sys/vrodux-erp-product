namespace Softaxis.Finance.Application.Reports.Dtos;

public sealed record AgingLineDto(
    Guid Id,
    string DocumentNumber,
    Guid? PartyId,
    string PartyName,
    string DocumentDate,
    string DueDate,
    decimal Total,
    decimal AmountPaid,
    decimal AmountDue,
    int DaysOverdue,
    string Bucket);

public sealed record AgingBucketTotalDto(string Bucket, decimal Amount);

public sealed record AgingReportDto(
    string AsOf,
    IReadOnlyList<AgingLineDto> Lines,
    IReadOnlyList<AgingBucketTotalDto> BucketTotals,
    decimal TotalDue);

public sealed record StatementLineDto(
    string Date,
    string Type,
    string Reference,
    decimal Debit,
    decimal Credit,
    decimal Balance);

public sealed record StatementDto(
    Guid PartyId,
    string PartyName,
    IReadOnlyList<StatementLineDto> Lines,
    decimal TotalDebit,
    decimal TotalCredit,
    decimal ClosingBalance);
