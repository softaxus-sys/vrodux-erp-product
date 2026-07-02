using Softaxis.AiAssistant.Application.Automations.Dtos;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.AiAssistant.Application.Automations.Queries;

/// <summary>All automation rules for the current tenant.</summary>
public sealed record GetAutomationRulesQuery() : IQuery<IReadOnlyList<AutomationRuleSummaryDto>>;

/// <summary>One rule with its most recent runs.</summary>
public sealed record GetAutomationRuleByIdQuery(Guid Id) : IQuery<AutomationRuleDto>;
