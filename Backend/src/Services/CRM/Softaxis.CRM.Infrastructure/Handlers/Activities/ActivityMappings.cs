using Softaxis.CRM.Application.Activities.Dtos;
using Softaxis.CRM.Domain.Entities;

namespace Softaxis.CRM.Infrastructure.Handlers.Activities;

internal static class ActivityMappings
{
    public static ActivityDto ToDto(Activity a) => new(
        a.Id, a.Type, a.Subject, a.Description, a.RelatedToType, a.RelatedToId, a.RelatedToName,
        a.DueDate, a.Completed, a.CompletedAt, a.AssignedTo, a.CreatedAt, a.UpdatedAt);
}
