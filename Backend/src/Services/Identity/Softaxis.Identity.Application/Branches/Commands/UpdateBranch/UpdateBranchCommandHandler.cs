using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Domain.Entities;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.Branches.Commands.UpdateBranch;

public sealed class UpdateBranchCommandHandler(
    IBranchRepository branchRepo,
    IUnitOfWork       uow)
    : ICommandHandler<UpdateBranchCommand, BranchDto>
{
    public async Task<Result<BranchDto>> Handle(UpdateBranchCommand cmd, CancellationToken ct)
    {
        var branch = await branchRepo.GetByIdAsync(cmd.Id, ct);
        if (branch is null)
            return Result.Failure<BranchDto>(Error.NotFoundById("Branch", cmd.Id));

        if (await branchRepo.CodeExistsExcludingAsync(cmd.Code.ToUpperInvariant(), cmd.Id, ct))
            return Result.Failure<BranchDto>(Error.Custom("Branch.Code.Taken", "Another branch already uses this code."));

        branch.Update(
            cmd.Code, cmd.Name, cmd.Type ?? "regional",
            cmd.City ?? "", cmd.Country ?? "Pakistan", cmd.Flag ?? "🇵🇰",
            cmd.Address, cmd.Phone, cmd.Email,
            cmd.Manager, cmd.Staff,
            cmd.Status ?? "active", cmd.Currency ?? "PKR",
            cmd.Timezone ?? "Asia/Karachi (UTC+5)", cmd.OpenedDate);

        await uow.SaveChangesAsync(ct);

        return Result.Success(ToDto(branch));
    }

    private static BranchDto ToDto(Branch b) => new(
        b.Id, b.Code, b.Name, b.Type, b.City, b.Country, b.Flag,
        b.Address, b.Phone, b.Email, b.Manager, b.Staff,
        b.Status, b.Currency, b.Timezone, b.OpenedDate,
        b.CreatedAt, b.UpdatedAt);
}
