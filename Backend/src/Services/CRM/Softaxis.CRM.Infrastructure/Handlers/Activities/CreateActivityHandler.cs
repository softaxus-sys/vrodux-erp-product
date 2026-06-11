using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Activities.Commands;
using Softaxis.CRM.Application.Activities.Dtos;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Activities;

internal sealed class CreateActivityHandler(CrmDbContext db) : ICommandHandler<CreateActivityCommand, ActivityDto>
{
    public async Task<Result<ActivityDto>> Handle(CreateActivityCommand cmd, CancellationToken ct)
    {
        var a = new Activity(cmd.Type, cmd.Subject, cmd.Description,
            cmd.RelatedToType, cmd.RelatedToId, cmd.RelatedToName, cmd.DueDate, cmd.AssignedTo);

        db.Activities.Add(a);
        await db.SaveChangesAsync(ct);

        return Result.Success(ActivityMappings.ToDto(a));
    }
}
