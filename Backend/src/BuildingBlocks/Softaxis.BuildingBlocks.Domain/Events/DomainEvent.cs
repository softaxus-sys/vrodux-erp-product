namespace Softaxis.BuildingBlocks.Domain.Events;

/// <summary>
/// Base record for domain events — immutable by default.
/// </summary>
public abstract record DomainEvent : IDomainEvent
{
    public Guid     EventId    { get; } = Guid.NewGuid();
    public string   EventType  => GetType().Name;
    public DateTime OccurredOn { get; } = DateTime.UtcNow;
}
