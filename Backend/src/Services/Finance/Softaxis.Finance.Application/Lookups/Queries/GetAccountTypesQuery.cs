using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Finance.Application.Lookups.Dtos;

namespace Softaxis.Finance.Application.Lookups.Queries;

/// <summary>Returns the active account types, ordered for display in the Chart of Accounts.</summary>
public sealed record GetAccountTypesQuery : IQuery<IReadOnlyList<AccountTypeDto>>;
