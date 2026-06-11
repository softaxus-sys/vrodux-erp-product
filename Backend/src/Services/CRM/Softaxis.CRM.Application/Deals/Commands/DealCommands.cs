using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.CRM.Application.Deals.Dtos;

namespace Softaxis.CRM.Application.Deals.Commands;

public sealed record CreateDealCommand(
    string Title, string Company, decimal Value, string Stage, string Priority,
    int Probability, string ExpectedCloseDate, string AssignedTo, string Source,
    string Industry, string Description) : ICommand<DealDto>;

public sealed class CreateDealValidator : AbstractValidator<CreateDealCommand>
{
    public CreateDealValidator()
    {
        RuleFor(x => x.Title).NotEmpty();
        RuleFor(x => x.Company).NotEmpty();
        RuleFor(x => x.Stage).NotEmpty();
    }
}

public sealed record UpdateDealCommand(
    Guid Id, string Title, string Company, decimal Value, string Stage, string Priority,
    int Probability, string ExpectedCloseDate, string AssignedTo, string Source, string Industry,
    string Description, string? NextAction, string? NextActionDate, List<string>? Tags) : ICommand;

public sealed class UpdateDealValidator : AbstractValidator<UpdateDealCommand>
{
    public UpdateDealValidator()
    {
        RuleFor(x => x.Title).NotEmpty();
        RuleFor(x => x.Company).NotEmpty();
        RuleFor(x => x.Stage).NotEmpty();
    }
}

public sealed record MoveDealStageCommand(Guid Id, string Stage, int Probability) : ICommand;

public sealed record DeleteDealCommand(Guid Id) : ICommand;
