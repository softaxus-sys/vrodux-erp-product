using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Finance.Application.AccountTypes.Commands;

/// <summary>Deletes an account type/subtype. Fails if it has subtypes or accounts referencing it.</summary>
public sealed record DeleteAccountTypeCommand(Guid Id) : ICommand;
