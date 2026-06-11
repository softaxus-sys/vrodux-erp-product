using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.CRM.Application.B2B.Dtos;

namespace Softaxis.CRM.Application.B2B.Commands;

// ── Proposals ────────────────────────────────────────────────────────────────
public sealed record CreateProposalCommand(
    Guid? LeadId, Guid? DealId, Guid? CustomerId, string ClientName, string Title,
    decimal Amount, string ValidUntil, string? Scope, string? Notes) : ICommand<ProposalDto>;

public sealed class CreateProposalValidator : AbstractValidator<CreateProposalCommand>
{
    public CreateProposalValidator()
    {
        RuleFor(x => x.ClientName).NotEmpty();
        RuleFor(x => x.Title).NotEmpty();
        RuleFor(x => x.ValidUntil).NotEmpty();
    }
}

public sealed record UpdateProposalStatusCommand(Guid Id, string Status) : ICommand;

public sealed record DeleteProposalCommand(Guid Id) : ICommand;

// ── Service Contracts ─────────────────────────────────────────────────────────
public sealed record CreateContractCommand(
    Guid? ProposalId, Guid? DealId, Guid? CustomerId, string ClientName, string Title, string ContractType,
    decimal Value, string StartDate, string EndDate, string? SlaTier, string? Notes) : ICommand<ServiceContractDto>;

public sealed class CreateContractValidator : AbstractValidator<CreateContractCommand>
{
    public CreateContractValidator()
    {
        RuleFor(x => x.ClientName).NotEmpty();
        RuleFor(x => x.Title).NotEmpty();
        RuleFor(x => x.ContractType).NotEmpty();
        RuleFor(x => x.StartDate).NotEmpty();
        RuleFor(x => x.EndDate).NotEmpty();
    }
}

public sealed record UpdateContractStatusCommand(Guid Id, string Status) : ICommand;

public sealed record DeleteContractCommand(Guid Id) : ICommand;

// ── Support Tickets ────────────────────────────────────────────────────────────
public sealed record CreateTicketCommand(
    Guid? ContractId, Guid? CustomerId, string ClientName, string Subject, string? Priority, string? Description) : ICommand<SupportTicketDto>;

public sealed class CreateTicketValidator : AbstractValidator<CreateTicketCommand>
{
    public CreateTicketValidator()
    {
        RuleFor(x => x.ClientName).NotEmpty();
        RuleFor(x => x.Subject).NotEmpty();
    }
}

public sealed record ResolveTicketCommand(Guid Id, string? Resolution) : ICommand;

public sealed record UpdateTicketStatusCommand(Guid Id, string Status) : ICommand;

public sealed record DeleteTicketCommand(Guid Id) : ICommand;
