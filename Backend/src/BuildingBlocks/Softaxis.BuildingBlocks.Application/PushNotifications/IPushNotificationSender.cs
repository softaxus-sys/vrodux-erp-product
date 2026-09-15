namespace Softaxis.BuildingBlocks.Application.PushNotifications;

/// <summary>
/// Sends mobile push notifications via Expo's push service (which relays to APNs/FCM on our
/// behalf — no native certificates or server keys needed on our side). One instance per process,
/// shared by any service that wants to notify a user's phone; the token itself is stored per-user
/// in Identity, so a caller here never needs to be Identity to send one — it only needs the raw
/// Expo push token(s), typically resolved via a cross-schema read against
/// <c>[identity].[user_device_tokens]</c> (same pattern used elsewhere in this codebase for reading
/// another service's tables — e.g. Real Estate's rent-reminder CC list).
/// </summary>
public interface IPushNotificationSender
{
    /// <summary>
    /// Sends one notification to every token given (batched internally — Expo caps a single
    /// request at 100 messages). Never throws: a delivery failure must never fail the business
    /// action that triggered it. Returns the subset of tokens Expo reported as permanently dead
    /// (<c>DeviceNotRegistered</c>) so the caller can delete them from the store.
    /// </summary>
    Task<IReadOnlyList<string>> SendAsync(
        IReadOnlyList<string> expoPushTokens,
        string title,
        string body,
        IReadOnlyDictionary<string, string>? data = null,
        CancellationToken ct = default);
}
