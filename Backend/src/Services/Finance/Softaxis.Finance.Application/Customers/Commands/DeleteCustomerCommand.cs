using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Finance.Application.Customers.Commands;

/// <summary>Soft-deletes a customer (sets IsDeleted = true).</summary>
public sealed record DeleteCustomerCommand(Guid Id) : ICommand;
