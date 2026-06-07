using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.MasterData.CustomerGroups.Commands;

public sealed record UpsertCustomerGroupCommand(
    Guid?   Id,
    string  Name,
    string  Code,
    decimal DiscountPercent,
    decimal MinPurchase,
    string? Description,
    bool    IsDefault,
    bool    IsActive
) : ICommand<CustomerGroupDto>;

public sealed class UpsertCustomerGroupCommandHandler(ICustomerGroupRepository repo, IUnitOfWork uow)
    : ICommandHandler<UpsertCustomerGroupCommand, CustomerGroupDto>
{
    public async Task<Result<CustomerGroupDto>> Handle(UpsertCustomerGroupCommand cmd, CancellationToken ct)
    {
        if (await repo.CodeExistsAsync(cmd.Code, cmd.Id, ct))
            return Result.Failure<CustomerGroupDto>(
                Error.Custom("CustomerGroup.CodeTaken", $"Customer group code '{cmd.Code}' is already in use."));

        CustomerGroup group;

        if (cmd.Id is null)
        {
            var result = CustomerGroup.Create(cmd.Name, cmd.Code, cmd.DiscountPercent,
                cmd.MinPurchase, cmd.Description, cmd.IsDefault, cmd.IsActive);
            if (result.IsFailure) return Result.Failure<CustomerGroupDto>(result.Error);
            group = result.Value;
            group.CreatedAt = DateTime.UtcNow;
            group.CreatedBy = "system";
            repo.Add(group);
        }
        else
        {
            group = await repo.GetByIdAsync(cmd.Id.Value, ct)
                ?? throw new InvalidOperationException($"CustomerGroup {cmd.Id} not found.");
            group.Update(cmd.Name, cmd.Code, cmd.DiscountPercent, cmd.MinPurchase,
                cmd.Description, cmd.IsDefault, cmd.IsActive);
        }

        await uow.SaveChangesAsync(ct);

        return Result.Success(new CustomerGroupDto(
            group.Id, group.Name, group.Code, group.DiscountPercent, group.MinPurchase,
            group.Description, group.IsDefault, group.IsActive, group.IsSystem,
            group.CreatedAt, group.UpdatedAt));
    }
}
