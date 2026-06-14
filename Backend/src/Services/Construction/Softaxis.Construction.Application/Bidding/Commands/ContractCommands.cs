using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Construction.Application.Bidding.Dtos;

namespace Softaxis.Construction.Application.Bidding.Commands;

public sealed record CreateContractCommand(
    Guid? DealId, Guid? CustomerId, Guid? EstimateId, string ClientName, string Title,
    decimal ContractValue, string StartDate, string EndDate, string? Contractor, string? Notes)
    : ICommand<ConstructionContractDto>;

public sealed class CreateContractValidator : AbstractValidator<CreateContractCommand>
{
    public CreateContractValidator()
    {
        RuleFor(x => x.ClientName).NotEmpty();
        RuleFor(x => x.Title).NotEmpty();
        RuleFor(x => x.StartDate).NotEmpty();
        RuleFor(x => x.EndDate).NotEmpty();
    }
}

public sealed record SetContractStatusCommand(Guid Id, string Status) : ICommand;

public sealed class SetContractStatusValidator : AbstractValidator<SetContractStatusCommand>
{
    public SetContractStatusValidator()
    {
        RuleFor(x => x.Status).NotEmpty();
    }
}

public sealed record DeleteContractCommand(Guid Id) : ICommand;
