using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Trade.Domain.Entities;

namespace Softaxis.Trade.Application.Parties;

public sealed record PartyDto(
    Guid Id, string Kind, string Name, string? Country, string? ContactName, string? Email, string? Phone,
    string? Address, string? TaxNumber, string? Notes, bool IsActive, int Shipments);

public sealed record GetPartiesQuery(string? Search = null, string? Kind = null, bool ActiveOnly = false)
    : IQuery<IReadOnlyList<PartyDto>>;

/// <summary>Create and edit share one shape; <c>IsActive</c> only matters when editing.</summary>
public sealed record PartyInput(
    string Kind, string Name, string? Country, string? ContactName, string? Email, string? Phone,
    string? Address, string? TaxNumber, string? Notes, bool IsActive = true);

public sealed record CreatePartyCommand(PartyInput Party) : ICommand<PartyDto>;
public sealed record UpdatePartyCommand(Guid Id, PartyInput Party) : ICommand<PartyDto>;
public sealed record DeletePartyCommand(Guid Id) : ICommand;

public sealed class PartyInputValidator : AbstractValidator<PartyInput>
{
    public PartyInputValidator()
    {
        RuleFor(x => x.Kind).Must(k => PartyKind.All.Contains(k)).WithMessage("Choose a valid party type.");
        RuleFor(x => x.Name).NotEmpty().WithMessage("Name is required.").MaximumLength(200);
        RuleFor(x => x.Country).MaximumLength(100);
        RuleFor(x => x.ContactName).MaximumLength(200);
        RuleFor(x => x.Email).MaximumLength(320).EmailAddress().When(x => !string.IsNullOrWhiteSpace(x.Email))
            .WithMessage("Enter a valid email address.");
        RuleFor(x => x.Phone).MaximumLength(50);
        RuleFor(x => x.Address).MaximumLength(500);
        RuleFor(x => x.TaxNumber).MaximumLength(60);
        RuleFor(x => x.Notes).MaximumLength(2000);
    }
}

public sealed class CreatePartyValidator : AbstractValidator<CreatePartyCommand>
{
    public CreatePartyValidator() => RuleFor(x => x.Party).SetValidator(new PartyInputValidator());
}

public sealed class UpdatePartyValidator : AbstractValidator<UpdatePartyCommand>
{
    public UpdatePartyValidator() => RuleFor(x => x.Party).SetValidator(new PartyInputValidator());
}
