namespace Softaxis.Restaurant.Application.Abstractions;

/// <summary>
/// Set only by the branch server's relay executor while it replays an order the cloud received for this
/// branch (QR / kiosk). The handler then creates the bill with the id the cloud already gave the guest.
/// AsyncLocal, like <see cref="InstructionIdentity"/>: never settable from a request.
/// </summary>
public static class RelayContext
{
    private static readonly AsyncLocal<Guid?> Current = new();

    public static Guid? OrderId => Current.Value;

    public static IDisposable Begin(Guid orderId)
    {
        var previous = Current.Value;
        Current.Value = orderId;
        return new Scope(previous);
    }

    private sealed class Scope(Guid? previous) : IDisposable
    {
        public void Dispose() => Current.Value = previous;
    }
}
