using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.UserBranches.Dtos;

namespace Softaxis.Restaurant.Application.UserBranches.Commands;

/// <summary>Assigns a user to a branch — the first assignment for a given user is what turns
/// branch-scoping ON for them (see UserBranch.cs).</summary>
public sealed record AddUserBranchCommand(Guid UserId, string UserName, Guid BranchId, string Role) : ICommand<UserBranchDto>;

public sealed class AddUserBranchValidator : AbstractValidator<AddUserBranchCommand>
{
    public AddUserBranchValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.UserName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.Role).Must(r => r is "owner" or "manager" or "staff")
            .WithMessage("Role must be owner, manager, or staff.");
    }
}

public sealed record UpdateUserBranchRoleCommand(Guid Id, string Role) : ICommand<UserBranchDto>;

public sealed class UpdateUserBranchRoleValidator : AbstractValidator<UpdateUserBranchRoleCommand>
{
    public UpdateUserBranchRoleValidator()
    {
        RuleFor(x => x.Role).Must(r => r is "owner" or "manager" or "staff")
            .WithMessage("Role must be owner, manager, or staff.");
    }
}

public sealed record RemoveUserBranchCommand(Guid Id) : ICommand;
