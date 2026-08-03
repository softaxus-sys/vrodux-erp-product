using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace Softaxis.Restaurant.API.Realtime;

/// <summary>
/// Realtime push channel for the Kitchen Display (KDS) and table board — clients just connect and
/// listen for "kitchenChanged"/"tablesChanged" events (see IRestaurantRealtimeNotifier), then re-fetch
/// via the existing REST endpoints. No hub methods are exposed; this is server-to-client only.
/// Auth-gated the same as every other restaurant endpoint (JWT bearer) — a stale/expired connection
/// simply fails to connect, and the frontend falls back to its existing polling interval.
/// </summary>
[Authorize]
public sealed class RestaurantHub : Hub;
