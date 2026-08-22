using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.CRM.Application.Customers.Dtos;
using Softaxis.CRM.Application.Leads.Commands;

namespace Softaxis.CRM.Application.Customers.Commands;

public sealed record CreateCrmCustomerCommand(
    string Name, string Industry, string Country, string City, string Address,
    string Phone, string Email, string Tier, string AccountManager, string Description,
    Guid? AccountManagerUserId = null, Guid? TeamId = null) : ICommand<CrmCustomerDto>;

public sealed class CreateCrmCustomerValidator : AbstractValidator<CreateCrmCustomerCommand>
{
    public CreateCrmCustomerValidator()
    {
        RuleFor(x => x.Name).NotEmpty();
        RuleFor(x => x.Email).NotEmpty();
        RuleFor(x => x.Phone).NotEmpty();
    }
}

public sealed record UpdateCrmCustomerCommand(
    Guid Id, string Name, string Industry, string Country, string City, string Address,
    string Phone, string Email, string Status, string Tier, string AccountManager, string Description,
    string? Website, string? TradeName, string? Employees, int? NpsScore, string? ContractRenewal,
    List<string>? Tags, Guid? AccountManagerUserId = null, Guid? TeamId = null) : ICommand;

public sealed class UpdateCrmCustomerValidator : AbstractValidator<UpdateCrmCustomerCommand>
{
    public UpdateCrmCustomerValidator()
    {
        RuleFor(x => x.Name).NotEmpty();
        RuleFor(x => x.Email).NotEmpty();
    }
}

public sealed record DeleteCrmCustomerCommand(Guid Id) : ICommand;

/// <summary>File several accounts to a team at once. See BulkFileLeadsToTeamCommand.</summary>
public sealed record BulkFileCustomersToTeamCommand(IReadOnlyList<Guid> CustomerIds, Guid? TeamId)
    : ICommand<BulkFileResultDto>;
