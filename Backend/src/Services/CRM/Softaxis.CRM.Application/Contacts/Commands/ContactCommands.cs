using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.CRM.Application.Contacts.Dtos;

namespace Softaxis.CRM.Application.Contacts.Commands;

public sealed record CreateContactCommand(
    Guid CustomerId, string FirstName, string LastName, string Title,
    string Email, string Phone, string? Department, bool IsPrimary, string? Notes) : ICommand<ContactDto>;

public sealed class CreateContactValidator : AbstractValidator<CreateContactCommand>
{
    public CreateContactValidator()
    {
        RuleFor(x => x.FirstName).NotEmpty();
        RuleFor(x => x.LastName).NotEmpty();
        RuleFor(x => x.Email).NotEmpty();
    }
}

public sealed record UpdateContactCommand(
    Guid Id, Guid CustomerId, string FirstName, string LastName, string Title,
    string Email, string Phone, string? Department, bool IsPrimary, string? Notes) : ICommand;

public sealed class UpdateContactValidator : AbstractValidator<UpdateContactCommand>
{
    public UpdateContactValidator()
    {
        RuleFor(x => x.FirstName).NotEmpty();
        RuleFor(x => x.LastName).NotEmpty();
        RuleFor(x => x.Email).NotEmpty();
    }
}

public sealed record SetPrimaryContactCommand(Guid Id) : ICommand;

public sealed record DeleteContactCommand(Guid Id) : ICommand;
