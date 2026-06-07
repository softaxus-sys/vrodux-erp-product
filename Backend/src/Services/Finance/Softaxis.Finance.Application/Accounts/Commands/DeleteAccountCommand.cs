using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Finance.Application.Accounts.Commands;

/// <summary>Soft-deletes an account (sets IsDeleted = true).</summary>
public sealed record DeleteAccountCommand(Guid Id) : ICommand;
