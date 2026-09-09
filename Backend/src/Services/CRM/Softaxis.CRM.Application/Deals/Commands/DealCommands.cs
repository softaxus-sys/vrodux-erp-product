using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.CRM.Application.Deals.Dtos;
using Softaxis.CRM.Application.Leads.Commands;

namespace Softaxis.CRM.Application.Deals.Commands;

public sealed record CreateDealCommand(
    string Title, string Company, decimal Value, string Stage, string Priority,
    int Probability, string ExpectedCloseDate, string AssignedTo, string Source,
    string Industry, string Description, string? ForecastCategory = null,
    Guid? CustomerId = null, Guid? AssignedToUserId = null, Guid? TeamId = null,
    /// <summary>What the deal actually closed at, when a past win is logged directly in the "won"
    /// stage. Null = it closed at the quoted value.</summary>
    decimal? ClosedValue = null) : ICommand<DealDto>;

public sealed class CreateDealValidator : AbstractValidator<CreateDealCommand>
{
    public CreateDealValidator()
    {
        RuleFor(x => x.Title).NotEmpty();
        RuleFor(x => x.Company).NotEmpty();
        RuleFor(x => x.Stage).NotEmpty();
        RuleFor(x => x.ClosedValue).GreaterThanOrEqualTo(0).When(x => x.ClosedValue.HasValue);
    }
}

public sealed record UpdateDealCommand(
    Guid Id, string Title, string Company, decimal Value, string Stage, string Priority,
    int Probability, string ExpectedCloseDate, string AssignedTo, string Source, string Industry,
    string Description, string? NextAction, string? NextActionDate, List<string>? Tags,
    string? ForecastCategory = null, Guid? CustomerId = null, Guid? AssignedToUserId = null,
    Guid? TeamId = null,
    /// <summary>What the deal actually closed at, where that differs from <paramref name="Value"/>.
    /// Null leaves any recorded amount untouched (a won deal defaults to the quoted value).
    /// Ignored unless the deal is won.</summary>
    decimal? ClosedValue = null) : ICommand;

public sealed class UpdateDealValidator : AbstractValidator<UpdateDealCommand>
{
    public UpdateDealValidator()
    {
        RuleFor(x => x.Title).NotEmpty();
        RuleFor(x => x.Company).NotEmpty();
        RuleFor(x => x.Stage).NotEmpty();
        RuleFor(x => x.ClosedValue).GreaterThanOrEqualTo(0).When(x => x.ClosedValue.HasValue);
    }
}

public sealed record MoveDealStageCommand(
    Guid Id, string Stage, int Probability,
    string? ForecastCategory = null, string? LossReason = null,
    /// <summary>The amount actually won, captured as the deal is dragged into "won". Null leaves it
    /// at the quoted value.</summary>
    decimal? ClosedValue = null) : ICommand;

public sealed record DeleteDealCommand(Guid Id) : ICommand;

/// <summary>
/// File several opportunities to a team at once. Same rationale as the lead equivalent: until a
/// record is filed, a team lead cannot see it — and every pipeline/forecast report reads deals, so
/// leaving them unfiled makes those reports empty for team leads. Null TeamId un-files.
/// </summary>
public sealed record BulkFileDealsToTeamCommand(IReadOnlyList<Guid> DealIds, Guid? TeamId)
    : ICommand<BulkFileResultDto>;
