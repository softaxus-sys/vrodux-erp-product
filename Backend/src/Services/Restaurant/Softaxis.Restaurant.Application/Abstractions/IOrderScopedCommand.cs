namespace Softaxis.Restaurant.Application.Abstractions;

/// <summary>
/// A command that changes one existing order. Before its handler runs, OrderBranchBehavior checks
/// the order belongs to a branch the user may work in, so no order handler has to remember to.
/// </summary>
public interface IOrderScopedCommand
{
    Guid OrderId { get; }
}
