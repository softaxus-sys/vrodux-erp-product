using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Domain.Entities;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.Branches.Commands.CreateBranch;

public sealed class CreateBranchCommandHandler(
    IBranchRepository branchRepo,
    IUnitOfWork       uow)
    : ICommandHandler<CreateBranchCommand, BranchDto>
{
    public async Task<Result<BranchDto>> Handle(CreateBranchCommand cmd, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(cmd.Name))
            return Result.Failure<BranchDto>(Error.Custom("Validation.Failed", "Branch name is required."));
        if (string.IsNullOrWhiteSpace(cmd.Code))
            return Result.Failure<BranchDto>(Error.Custom("Validation.Failed", "Branch code is required."));

        if (await branchRepo.CodeExistsAsync(cmd.Code.ToUpperInvariant(), ct))
            return Result.Failure<BranchDto>(Error.Custom("Branch.Code.Taken", "A branch with this code already exists."));

        var branch = new Branch(
            cmd.Code, cmd.Name, cmd.Type ?? "regional",
            cmd.City ?? "", cmd.Country ?? "Pakistan", cmd.Flag ?? "🇵🇰",
            cmd.Address, cmd.Phone, cmd.Email,
            cmd.Manager, cmd.Staff,
            cmd.Status ?? "active", cmd.Currency ?? "PKR",
            cmd.Timezone ?? "Asia/Karachi (UTC+5)", cmd.OpenedDate);

        branchRepo.Add(branch);
        await uow.SaveChangesAsync(ct);

        return Result.Success(ToDto(branch));
    }

    private static BranchDto ToDto(Branch b) => new(
        b.Id, b.Code, b.Name, b.Type, b.City, b.Country, b.Flag,
        b.Address, b.Phone, b.Email, b.Manager, b.Staff,
        b.Status, b.Currency, b.Timezone, b.OpenedDate,
        b.CreatedAt, b.UpdatedAt);
}
