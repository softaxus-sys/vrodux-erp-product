using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Finance.Application.Suppliers.Commands;

/// <summary>Soft-deletes a supplier (sets IsDeleted = true).</summary>
public sealed record DeleteSupplierCommand(Guid Id) : ICommand;
