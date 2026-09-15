namespace Softaxis.POS.Application.Common;

/// <summary>
/// Present only when a command is replayed from an offline till by the day-end sync.
///
/// Never bind this from a request body: it relaxes live stock checks. Controllers construct
/// commands without it (or strip it), and only <c>SyncOfflineDayCommandHandler</c> sets it.
/// </summary>
/// <param name="ClientRef">Client-generated id — the idempotency key for the synced record.</param>
/// <param name="OccurredAtUtc">When it actually happened at the till.</param>
/// <param name="ReceiptNumber">The receipt number printed offline, if any.</param>
public sealed record OfflineContext(string ClientRef, DateTime OccurredAtUtc, string? ReceiptNumber = null);
