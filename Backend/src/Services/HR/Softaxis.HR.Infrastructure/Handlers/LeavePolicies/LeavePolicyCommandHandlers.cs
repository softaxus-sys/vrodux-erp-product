using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.LeavePolicies.Commands;
using Softaxis.HR.Application.LeavePolicies.Dtos;
using Softaxis.HR.Domain.Entities;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.LeavePolicies;

internal sealed class CreateLeavePolicyHandler(HrDbContext db)
    : ICommandHandler<CreateLeavePolicyCommand, LeavePolicyDto>
{
    public async Task<Result<LeavePolicyDto>> Handle(CreateLeavePolicyCommand cmd, CancellationToken ct)
    {
        var type = cmd.LeaveType.Trim().ToLowerInvariant();

        var duplicate = await db.LeavePolicies
            .AnyAsync(x => !x.IsDeleted && x.LeaveType == type, ct);
        if (duplicate)
            return Result.Failure<LeavePolicyDto>(
                Error.Custom("LeavePolicy.Duplicate", $"A policy for '{type}' already exists."));

        var policy = new LeavePolicy(type, cmd.AnnualEntitlementDays, cmd.IsPaid, cmd.Description);
        db.LeavePolicies.Add(policy);
        await db.SaveChangesAsync(ct);

        return Result.Success(new LeavePolicyDto(
            policy.Id, policy.LeaveType, policy.AnnualEntitlementDays,
            policy.IsPaid, policy.Description, policy.IsActive));
    }
}

internal sealed class UpdateLeavePolicyHandler(HrDbContext db)
    : ICommandHandler<UpdateLeavePolicyCommand>
{
    public async Task<Result> Handle(UpdateLeavePolicyCommand cmd, CancellationToken ct)
    {
        var policy = await db.LeavePolicies.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (policy is null)
            return Result.Failure(Error.NotFoundById("LeavePolicy", cmd.Id));

        policy.Update(cmd.AnnualEntitlementDays, cmd.IsPaid, cmd.Description, cmd.IsActive);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class DeleteLeavePolicyHandler(HrDbContext db)
    : ICommandHandler<DeleteLeavePolicyCommand>
{
    public async Task<Result> Handle(DeleteLeavePolicyCommand cmd, CancellationToken ct)
    {
        var policy = await db.LeavePolicies.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (policy is null)
            return Result.Failure(Error.NotFoundById("LeavePolicy", cmd.Id));

        policy.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
