namespace Softaxis.Restaurant.Application.Abstractions;

/// <summary>
/// Lets a background job act as a named person. A head-office instruction is authorised at the cloud, where
/// the requester's permissions were checked; the branch server then applies it with no signed-in user, so
/// the change would otherwise be recorded under nobody. While a scope from <see cref="Begin"/> is open,
/// the current-user service answers with the requester's id and name and treats the action as permitted.
///
/// <para>
/// Flows with the async call chain (AsyncLocal), so it covers everything the command's handler awaits and
/// nothing outside it. Never set from a request - only the branch executor opens a scope.
/// </para>
/// </summary>
public static class InstructionIdentity
{
    private static readonly AsyncLocal<(Guid Id, string Name)?> Current = new();

    public static (Guid Id, string Name)? Active => Current.Value;

    public static IDisposable Begin(Guid userId, string name)
    {
        var previous = Current.Value;
        Current.Value = (userId, name);
        return new Scope(previous);
    }

    private sealed class Scope((Guid Id, string Name)? previous) : IDisposable
    {
        public void Dispose() => Current.Value = previous;
    }
}
