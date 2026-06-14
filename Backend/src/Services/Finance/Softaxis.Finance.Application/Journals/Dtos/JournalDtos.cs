namespace Softaxis.Finance.Application.Journals.Dtos;

public sealed record JournalLineDto(
    Guid    Id,
    string  AccountCode,
    string  AccountName,
    decimal Debit,
    decimal Credit,
    string? Description);

public sealed record JournalDto(
    Guid      Id,
    string    JournalNumber,
    string    Date,
    string    Description,
    string?   Reference,
    string    Status,
    string?   Notes,
    decimal   TotalDebit,
    decimal   TotalCredit,
    bool      IsBalanced,
    string    Period,
    string    CreatedBy,
    IReadOnlyList<JournalLineDto> Lines,
    DateTime  CreatedAt,
    DateTime? UpdatedAt);

public sealed record JournalsSummaryDto(
    int     Total,
    int     Draft,
    int     Posted,
    int     Reversed,
    decimal TotalPostedValue,
    int     ThisMonth);
