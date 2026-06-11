namespace Softaxis.Finance.Application.JournalEntries.Dtos;

public sealed record JournalLineDto(
    Guid    Id,
    Guid    AccountId,
    string  AccountName,
    decimal DebitAmount,
    decimal CreditAmount,
    string? Description);

public sealed record LineRequest(
    Guid    AccountId,
    string  AccountName,
    decimal DebitAmount,
    decimal CreditAmount,
    string? Description);

public sealed record JournalEntrySummaryDto(
    Guid      Id,
    string    EntryNumber,
    string    Date,
    string    Description,
    string?   Reference,
    string    Status,
    decimal   TotalDebit,
    decimal   TotalCredit,
    int       LineCount,
    DateTime  CreatedAt,
    DateTime? UpdatedAt);

public sealed record JournalEntryDto(
    Guid      Id,
    string    EntryNumber,
    string    Date,
    string    Description,
    string?   Reference,
    string    Status,
    string?   Notes,
    decimal   TotalDebit,
    decimal   TotalCredit,
    bool      IsBalanced,
    IReadOnlyList<JournalLineDto> Lines,
    DateTime  CreatedAt,
    DateTime? UpdatedAt);

public sealed record PagedResult<T>(
    IReadOnlyList<T> Items, int Page, int PageSize,
    int TotalCount, int TotalPages, bool HasNext, bool HasPrev);
