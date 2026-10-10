using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Library.Application.Setup;

// ── Branches ────────────────────────────────────────────────────────────────

public sealed record BranchDto(
    Guid Id, string Name, string? Code, string? Address, string? Phone, string? Email, bool IsActive,
    int Copies, int Available, int OnLoan);

public sealed record GetBranchesQuery(bool ActiveOnly = false) : IQuery<IReadOnlyList<BranchDto>>;

public sealed record CreateBranchCommand(string Name, string? Code, string? Address, string? Phone, string? Email)
    : ICommand<BranchDto>;

public sealed record UpdateBranchCommand(
    Guid Id, string Name, string? Code, string? Address, string? Phone, string? Email, bool IsActive)
    : ICommand<BranchDto>;

public sealed record DeleteBranchCommand(Guid Id) : ICommand;

public sealed class CreateBranchValidator : AbstractValidator<CreateBranchCommand>
{
    public CreateBranchValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Branch name is required.").MaximumLength(200);
        RuleFor(x => x.Code).MaximumLength(30);
        RuleFor(x => x.Address).MaximumLength(500);
        RuleFor(x => x.Phone).MaximumLength(50);
        RuleFor(x => x.Email).MaximumLength(320);
    }
}

public sealed class UpdateBranchValidator : AbstractValidator<UpdateBranchCommand>
{
    public UpdateBranchValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Branch name is required.").MaximumLength(200);
        RuleFor(x => x.Code).MaximumLength(30);
        RuleFor(x => x.Address).MaximumLength(500);
        RuleFor(x => x.Phone).MaximumLength(50);
        RuleFor(x => x.Email).MaximumLength(320);
    }
}

// ── Membership types (borrowing rules) ──────────────────────────────────────

public sealed record MembershipTypeDto(
    Guid Id, string Name, int MaxLoans, int LoanDays, int MaxRenewals, decimal FinePerDay,
    int MaxReservations, decimal AnnualFee, bool IsActive, int Members);

public sealed record GetMembershipTypesQuery(bool ActiveOnly = false) : IQuery<IReadOnlyList<MembershipTypeDto>>;

public sealed record CreateMembershipTypeCommand(
    string Name, int MaxLoans, int LoanDays, int MaxRenewals, decimal FinePerDay, int MaxReservations,
    decimal AnnualFee) : ICommand<MembershipTypeDto>;

public sealed record UpdateMembershipTypeCommand(
    Guid Id, string Name, int MaxLoans, int LoanDays, int MaxRenewals, decimal FinePerDay, int MaxReservations,
    decimal AnnualFee, bool IsActive) : ICommand<MembershipTypeDto>;

public sealed record DeleteMembershipTypeCommand(Guid Id) : ICommand;

public sealed class CreateMembershipTypeValidator : AbstractValidator<CreateMembershipTypeCommand>
{
    public CreateMembershipTypeValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Name is required.").MaximumLength(120);
        RuleFor(x => x.MaxLoans).InclusiveBetween(1, 500).WithMessage("Items allowed must be between 1 and 500.");
        RuleFor(x => x.LoanDays).InclusiveBetween(1, 365).WithMessage("Loan period must be between 1 and 365 days.");
        RuleFor(x => x.MaxRenewals).InclusiveBetween(0, 50);
        RuleFor(x => x.MaxReservations).InclusiveBetween(0, 100);
        RuleFor(x => x.FinePerDay).GreaterThanOrEqualTo(0);
        RuleFor(x => x.AnnualFee).GreaterThanOrEqualTo(0);
    }
}

public sealed class UpdateMembershipTypeValidator : AbstractValidator<UpdateMembershipTypeCommand>
{
    public UpdateMembershipTypeValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Name is required.").MaximumLength(120);
        RuleFor(x => x.MaxLoans).InclusiveBetween(1, 500).WithMessage("Items allowed must be between 1 and 500.");
        RuleFor(x => x.LoanDays).InclusiveBetween(1, 365).WithMessage("Loan period must be between 1 and 365 days.");
        RuleFor(x => x.MaxRenewals).InclusiveBetween(0, 50);
        RuleFor(x => x.MaxReservations).InclusiveBetween(0, 100);
        RuleFor(x => x.FinePerDay).GreaterThanOrEqualTo(0);
        RuleFor(x => x.AnnualFee).GreaterThanOrEqualTo(0);
    }
}
