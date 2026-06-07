using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Finance.Application.Accounts.Dtos;

namespace Softaxis.Finance.Application.Accounts.Queries;

/// <summary>Returns all accounts, with optional filters.</summary>
public sealed record GetAccountsQuery(
    string? Search      = null,
    string? AccountType = null,
    bool?   IsActive    = null
) : IQuery<IReadOnlyList<AccountDto>>;
