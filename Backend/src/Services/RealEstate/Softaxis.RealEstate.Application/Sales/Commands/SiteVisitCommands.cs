using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.RealEstate.Application.Sales.Dtos;

namespace Softaxis.RealEstate.Application.Sales.Commands;

public sealed record CreateSiteVisitCommand(
    Guid? LeadId, Guid? CustomerId, string CustomerName, Guid PropertyId, Guid? UnitId,
    string ScheduledAt, string? AssignedTo, string? Notes) : ICommand<SiteVisitDto>;

public sealed class CreateSiteVisitValidator : AbstractValidator<CreateSiteVisitCommand>
{
    public CreateSiteVisitValidator()
    {
        RuleFor(x => x.CustomerName).NotEmpty();
        RuleFor(x => x.ScheduledAt).NotEmpty();
    }
}

public sealed record CompleteSiteVisitCommand(Guid Id, string? Feedback) : ICommand;

public sealed record DeleteSiteVisitCommand(Guid Id) : ICommand;
