namespace Softaxis.Identity.Application.DTOs;

/// <summary>
/// One active login session for the current user -- one row per RefreshToken currently active
/// (token rotation keeps this to exactly one row per device, see RefreshToken's own device-dedup
/// at login/refresh). DeviceName/Platform are null for a session that predates this feature or
/// whose client never sent them; the list still shows those, just unlabeled.
/// </summary>
public sealed record SessionDto(
    Guid      Id,
    string?   DeviceName,
    string?   Platform,
    string?   CreatedByIp,
    DateTime  CreatedAt,
    DateTime  ExpiresAt,
    // True when this session's DeviceId matches the DeviceId the caller passed to GET /sessions --
    // display only (the caller already knows which device it's asking from), never used to decide
    // access.
    bool      IsCurrent);
