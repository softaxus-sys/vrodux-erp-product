using Softaxis.Construction.Application.Sites.Dtos;
using Softaxis.Construction.Domain.Entities;

namespace Softaxis.Construction.Infrastructure.Handlers.Sites;

internal static class SiteMappings
{
    public static SiteDto ToDto(Site s) => new(
        s.Id, s.SiteCode, s.Name, s.ProjectId, s.ProjectName,
        new SiteLocationDto(s.Address, s.City, s.Emirate, s.Lat, s.Lng),
        s.SiteManager, s.SiteManagerPhone, s.SafetyOfficer, s.SafetyOfficerPhone, s.Status,
        new SiteWorkersDto(s.CurrentWorkers, s.MaxWorkers),
        s.Area, s.StartDate, s.PermitNumber, s.PermitExpiry,
        s.LastInspection, s.NextInspection, s.SafetyScore, s.Notes);
}
