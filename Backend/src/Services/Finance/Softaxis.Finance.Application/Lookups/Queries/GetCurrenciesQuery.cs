using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Finance.Application.Lookups.Dtos;

namespace Softaxis.Finance.Application.Lookups.Queries;

/// <summary>Returns the active currencies, base currency first.</summary>
public sealed record GetCurrenciesQuery : IQuery<IReadOnlyList<CurrencyDto>>;
