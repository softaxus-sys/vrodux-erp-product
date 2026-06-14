using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Construction.Application.Projects.Dtos;

namespace Softaxis.Construction.Application.Projects.Commands;

public sealed record CreateProjectCommand(
    string Name, string Client, string Location, string ProjectType,
    string StartDate, string EndDate, decimal ContractValue,
    string ProjectManager, string SiteEngineer, string? Notes) : ICommand<ProjectDto>;

public sealed class CreateProjectValidator : AbstractValidator<CreateProjectCommand>
{
    public CreateProjectValidator()
    {
        RuleFor(x => x.Name).NotEmpty();
        RuleFor(x => x.Client).NotEmpty();
        RuleFor(x => x.Location).NotEmpty();
        RuleFor(x => x.ProjectType).NotEmpty();
        RuleFor(x => x.StartDate).NotEmpty();
        RuleFor(x => x.EndDate).NotEmpty();
        RuleFor(x => x.ProjectManager).NotEmpty();
        RuleFor(x => x.SiteEngineer).NotEmpty();
    }
}
