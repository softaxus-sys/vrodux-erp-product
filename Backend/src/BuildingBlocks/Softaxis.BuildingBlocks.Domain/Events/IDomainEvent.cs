using MediatR;

namespace Softaxis.BuildingBlocks.Domain.Events;

/// <summary>
/// Marker interface for all domain events.
/// Implements INotification so MediatR can dispatch them.
/// </summary>
public interface IDomainEvent : INotification
{
    Guid   EventId   { get; }
    string EventType { get; }
    DateTime OccurredOn { get; }
}
