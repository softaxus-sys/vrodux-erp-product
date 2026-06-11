using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.CRM.Application.Insurance.Dtos;

namespace Softaxis.CRM.Application.Insurance.Commands;

// ── Policies ─────────────────────────────────────────────────────────────────
public sealed record CreatePolicyCommand(
    Guid? LeadId, Guid? DealId, Guid? CustomerId, string HolderName, string ProductType,
    decimal Premium, decimal SumInsured, string StartDate, string EndDate, string? Agent, string? Notes) : ICommand<PolicyDto>;

public sealed class CreatePolicyValidator : AbstractValidator<CreatePolicyCommand>
{
    public CreatePolicyValidator()
    {
        RuleFor(x => x.HolderName).NotEmpty();
        RuleFor(x => x.ProductType).NotEmpty();
        RuleFor(x => x.StartDate).NotEmpty();
        RuleFor(x => x.EndDate).NotEmpty();
    }
}

public sealed record UpdatePolicyStatusCommand(Guid Id, string Status) : ICommand;

public sealed record RenewPolicyCommand(Guid Id, string RenewalDate, decimal? NewPremium, string? Notes) : ICommand<PolicyRenewalDto>;

public sealed record DeletePolicyCommand(Guid Id) : ICommand;

// ── Renewals ─────────────────────────────────────────────────────────────────
public sealed record CompleteRenewalCommand(Guid Id) : ICommand;

public sealed record UpdateRenewalStatusCommand(Guid Id, string Status) : ICommand;

public sealed record DeleteRenewalCommand(Guid Id) : ICommand;

// ── Claims ───────────────────────────────────────────────────────────────────
public sealed record CreateClaimCommand(Guid PolicyId, string ClaimDate, decimal ClaimAmount, string? Reason, string? Notes) : ICommand<InsuranceClaimDto>;

public sealed class CreateClaimValidator : AbstractValidator<CreateClaimCommand>
{
    public CreateClaimValidator()
    {
        RuleFor(x => x.ClaimDate).NotEmpty();
        RuleFor(x => x.ClaimAmount).GreaterThanOrEqualTo(0);
    }
}

public sealed record ApproveClaimCommand(Guid Id, decimal Amount) : ICommand<InsuranceClaimDto>;

public sealed record UpdateClaimStatusCommand(Guid Id, string Status) : ICommand;

public sealed record DeleteClaimCommand(Guid Id) : ICommand;
