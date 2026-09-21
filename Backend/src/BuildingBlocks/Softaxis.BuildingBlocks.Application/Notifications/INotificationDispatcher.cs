namespace Softaxis.BuildingBlocks.Application.Notifications;

/// <summary>
/// The one way any module raises an alert. Named "dispatcher", not "publisher", because MediatR
/// already owns INotificationPublisher — the two would be ambiguous in any handler that uses both,
/// which is most of them. Inject it into a handler and call it — the implementation
/// stores the row (so it survives being offline) and pushes it to whichever of that user's browser
/// tabs are connected (so it arrives instantly). A caller never talks to SignalR or the notifications
/// schema directly.
///
/// <para><b>Never throws.</b> An alert is a side effect of some real piece of work — assigning a lead,
/// approving a payroll — and a broadcast hiccup, a dead socket or a missing recipient must not fail or
/// roll back that work. Failures are logged and swallowed. The trade is deliberate: a missed alert is
/// recoverable (the user sees it on their next visit, or not at all), a rolled-back assignment is not.</para>
/// </summary>
public interface INotificationDispatcher
{
    Task PublishAsync(NotificationRequest request, CancellationToken ct = default);

    /// <summary>
    /// Fan-out to several recipients in one round trip. Prefer this over a loop: it writes every row
    /// in a single save, so a queue-wide alert costs one database call rather than one per person.
    /// </summary>
    Task PublishManyAsync(IEnumerable<NotificationRequest> requests, CancellationToken ct = default);
}
