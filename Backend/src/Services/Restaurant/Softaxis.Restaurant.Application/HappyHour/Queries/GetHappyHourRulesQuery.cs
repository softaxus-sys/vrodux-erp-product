using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.HappyHour.Dtos;

namespace Softaxis.Restaurant.Application.HappyHour.Queries;

public sealed record GetHappyHourRulesQuery : IQuery<IReadOnlyList<HappyHourRuleDto>>;
