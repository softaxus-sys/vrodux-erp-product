using Softaxis.Construction.Application.Projects.Dtos;
using Softaxis.Construction.Domain.Entities;

namespace Softaxis.Construction.Infrastructure.Handlers.Projects;

internal static class ProjectMappings
{
    public static ProjectDto ToDto(Project p) => new(
        p.Id, p.ProjectNumber, p.Name, p.Client, p.Location, p.ProjectType,
        p.Status, p.StartDate, p.EndDate, p.ContractValue, p.BudgetSpent,
        p.BudgetRemaining, p.CompletionPct, p.ProjectManager, p.SiteEngineer,
        p.Workers, p.Notes,
        p.Phases.Select(ph => new ProjectPhaseDto(
            ph.Id, ph.Name, ph.StartDate, ph.EndDate, ph.Status, ph.CompletionPct)).ToList());
}
