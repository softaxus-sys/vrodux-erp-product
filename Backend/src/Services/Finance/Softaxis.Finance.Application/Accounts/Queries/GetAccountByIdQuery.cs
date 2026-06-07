using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Finance.Application.Accounts.Dtos;

namespace Softaxis.Finance.Application.Accounts.Queries;

/// <summary>Returns a single account by its GUID.</summary>
public sealed record GetAccountByIdQuery(Guid Id) : IQuery<AccountDto>;
