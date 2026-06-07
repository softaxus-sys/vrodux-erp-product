using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Identity.Application.DTOs;

namespace Softaxis.Identity.Application.Branches.Commands.CreateBranch;

public sealed record CreateBranchCommand(
    string  Code,
    string  Name,
    string? Type,
    string? City,
    string? Country,
    string? Flag,
    string? Address,
    string? Phone,
    string? Email,
    string? Manager,
    int     Staff,
    string? Status,
    string? Currency,
    string? Timezone,
    string? OpenedDate)
    : ICommand<BranchDto>;
