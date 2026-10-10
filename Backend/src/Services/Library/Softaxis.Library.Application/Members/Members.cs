using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Library.Application.Catalogue;

namespace Softaxis.Library.Application.Members;

public sealed record MemberDto(
    Guid Id, string MemberNumber, string FullName, string? Email, string? Phone, string? Address,
    string? IdNumber, Guid MembershipTypeId, string MembershipTypeName, Guid? HomeBranchId,
    string? HomeBranchName, string JoinedOn, string? ExpiresOn, string Status, string? Notes,
    int ActiveLoans, int OverdueLoans, int MaxLoans, decimal UnpaidFines, bool IsExpired);

/// <param name="Status">active | suspended | expired, or null for all.</param>
public sealed record GetMembersQuery(
    string? Search = null, string? Status = null, int Page = 1, int PageSize = 50, string? Today = null)
    : IQuery<PagedDto<MemberDto>>;

public sealed record GetMemberByIdQuery(Guid Id, string? Today = null) : IQuery<MemberDto>;

/// <param name="MemberNumber">Card number. Generated when left blank.</param>
public sealed record CreateMemberCommand(
    string? MemberNumber, string FullName, string? Email, string? Phone, string? Address, string? IdNumber,
    Guid MembershipTypeId, Guid? HomeBranchId, string? JoinedOn, string? ExpiresOn, string? Notes,
    string? Today = null) : ICommand<MemberDto>;

public sealed record UpdateMemberCommand(
    Guid Id, string MemberNumber, string FullName, string? Email, string? Phone, string? Address, string? IdNumber,
    Guid MembershipTypeId, Guid? HomeBranchId, string? ExpiresOn, string? Status, string? Notes,
    string? Today = null) : ICommand<MemberDto>;

public sealed record DeleteMemberCommand(Guid Id) : ICommand;

public sealed class CreateMemberValidator : AbstractValidator<CreateMemberCommand>
{
    public CreateMemberValidator()
    {
        RuleFor(x => x.FullName).NotEmpty().WithMessage("Full name is required.").MaximumLength(200);
        RuleFor(x => x.MemberNumber).MaximumLength(40);
        RuleFor(x => x.MembershipTypeId).NotEmpty().WithMessage("Choose a membership type.");
        RuleFor(x => x.Email).EmailAddress().When(x => !string.IsNullOrWhiteSpace(x.Email))
            .WithMessage("Email address is not valid.");
        RuleFor(x => x.Notes).MaximumLength(2000);
    }
}

public sealed class UpdateMemberValidator : AbstractValidator<UpdateMemberCommand>
{
    public UpdateMemberValidator()
    {
        RuleFor(x => x.FullName).NotEmpty().WithMessage("Full name is required.").MaximumLength(200);
        RuleFor(x => x.MemberNumber).NotEmpty().WithMessage("Member number is required.").MaximumLength(40);
        RuleFor(x => x.MembershipTypeId).NotEmpty().WithMessage("Choose a membership type.");
        RuleFor(x => x.Email).EmailAddress().When(x => !string.IsNullOrWhiteSpace(x.Email))
            .WithMessage("Email address is not valid.");
        RuleFor(x => x.Notes).MaximumLength(2000);
    }
}
