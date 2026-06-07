using Softaxis.BuildingBlocks.Domain.Events;

namespace Softaxis.Identity.Domain.Events;

public sealed record UserRegisteredEvent(Guid UserId, string Email) : DomainEvent;
public sealed record UserPasswordChangedEvent(Guid UserId) : DomainEvent;
public sealed record UserLockedEvent(Guid UserId, DateTime LockedUntil) : DomainEvent;
public sealed record UserLoggedInEvent(Guid UserId, string IpAddress) : DomainEvent;
