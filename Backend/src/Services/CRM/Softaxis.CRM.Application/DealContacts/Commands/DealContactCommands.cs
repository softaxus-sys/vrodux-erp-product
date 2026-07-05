using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.CRM.Application.DealContacts.Dtos;

namespace Softaxis.CRM.Application.DealContacts.Commands;

public sealed record AddDealContactCommand(Guid DealId, Guid ContactId, string Role)
    : ICommand<DealContactDto>;

public sealed class AddDealContactValidator : AbstractValidator<AddDealContactCommand>
{
    public AddDealContactValidator()
    {
        RuleFor(x => x.DealId).NotEmpty();
        RuleFor(x => x.ContactId).NotEmpty();
        RuleFor(x => x.Role).NotEmpty().MaximumLength(30);
    }
}

public sealed record UpdateDealContactRoleCommand(Guid DealId, Guid Id, string Role) : ICommand;

public sealed class UpdateDealContactRoleValidator : AbstractValidator<UpdateDealContactRoleCommand>
{
    public UpdateDealContactRoleValidator()
    {
        RuleFor(x => x.Role).NotEmpty().MaximumLength(30);
    }
}

public sealed record RemoveDealContactCommand(Guid DealId, Guid Id) : ICommand;
