using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Construction.Application.Bidding.Dtos;

namespace Softaxis.Construction.Application.Bidding.Commands;

public sealed record CreateEstimateCommand(
    Guid? RfqId, Guid? DealId, Guid? CustomerId, string ClientName, string Title,
    decimal Amount, string ValidUntil, string? Notes) : ICommand<EstimateDto>;

public sealed class CreateEstimateValidator : AbstractValidator<CreateEstimateCommand>
{
    public CreateEstimateValidator()
    {
        RuleFor(x => x.ClientName).NotEmpty();
        RuleFor(x => x.Title).NotEmpty();
        RuleFor(x => x.ValidUntil).NotEmpty();
    }
}

public sealed record SetEstimateStatusCommand(Guid Id, string Status) : ICommand;

public sealed class SetEstimateStatusValidator : AbstractValidator<SetEstimateStatusCommand>
{
    public SetEstimateStatusValidator()
    {
        RuleFor(x => x.Status).NotEmpty();
    }
}

public sealed record DeleteEstimateCommand(Guid Id) : ICommand;
