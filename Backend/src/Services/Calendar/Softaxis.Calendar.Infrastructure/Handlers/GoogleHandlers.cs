using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Calendar.Application.Abstractions;
using Softaxis.Calendar.Application.Events.Dtos;
using Softaxis.Calendar.Application.Google;
using Softaxis.Calendar.Domain.Entities;
using Softaxis.Calendar.Infrastructure.Google;
using Softaxis.Calendar.Infrastructure.Persistence;
using Softaxis.Calendar.Infrastructure.Sync;

namespace Softaxis.Calendar.Infrastructure.Handlers;

internal sealed class GetConnectionHandler(CalendarDbContext db, ICurrentUser user, GoogleCalendarClient google)
    : IQueryHandler<GetConnectionQuery, ConnectionDto>
{
    public async Task<Result<ConnectionDto>> Handle(GetConnectionQuery q, CancellationToken ct)
    {
        if (user.Id is not { } me) return Result.Failure<ConnectionDto>(Error.Custom("Auth.Unresolved", "Sign in again."));
        var c = await db.Connections.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == me && !x.IsDeleted, ct);
        return Result.Success(new ConnectionDto(google.IsConfigured, c?.Status ?? "disconnected", c?.AccountEmail,
            c?.LastSyncAt is { } t ? DateTime.SpecifyKind(t, DateTimeKind.Utc) : null, c?.LastError));
    }
}

internal sealed class StartGoogleConnectHandler(CalendarDbContext db, ICurrentUser user, GoogleCalendarClient google, ISecretProtector protector)
    : ICommandHandler<StartGoogleConnectCommand, OAuthUrlDto>
{
    public async Task<Result<OAuthUrlDto>> Handle(StartGoogleConnectCommand c, CancellationToken ct)
    {
        if (user.Id is not { } me) return Result.Failure<OAuthUrlDto>(Error.Custom("Auth.Unresolved", "Sign in again."));
        if (!google.IsConfigured)
            return Result.Failure<OAuthUrlDto>(Error.Custom("Calendar.Conflict",
                "Google Calendar is not set up on this server yet. Ask your administrator to add the Google client ID and secret."));

        // Created here, in an authenticated request, so it is tenant-stamped automatically: the anonymous
        // callback only ever UPDATES this row (a new row made there would have no tenant).
        var conn = await db.Connections.FirstOrDefaultAsync(x => x.UserId == me && !x.IsDeleted, ct);
        if (conn is null)
        {
            conn = new CalendarConnection(me);
            db.Connections.Add(conn);
            await db.SaveChangesAsync(ct);
        }
        var state = protector.Protect(conn.Id.ToString())!;
        return Result.Success(new OAuthUrlDto(google.BuildLoginUrl(c.RedirectUri, state)));
    }
}

/// <summary>
/// Anonymous OAuth callback (Google redirects the browser; there is no JWT). It resolves the row from
/// the encrypted state, and deliberately does NOT sync: with no ambient tenant, any new event written
/// here would be saved with no tenant and be invisible to its owner. The app triggers the first sync
/// from an authenticated request right after the redirect.
/// </summary>
internal sealed class GoogleCallbackHandler(CalendarDbContext db, GoogleCalendarClient google, ISecretProtector protector)
    : ICommandHandler<GoogleCallbackCommand, OAuthResultDto>
{
    public async Task<Result<OAuthResultDto>> Handle(GoogleCallbackCommand c, CancellationToken ct)
    {
        string? plain;
        try { plain = protector.Unprotect(c.State); } catch { plain = null; }
        if (!Guid.TryParse(plain, out var connId))
            return Result.Failure<OAuthResultDto>(Error.Custom("Calendar.InvalidState", "Invalid sign-in state."));

        var conn = await db.Connections.FirstOrDefaultAsync(x => x.Id == connId && !x.IsDeleted, ct);
        if (conn is null) return Result.Failure<OAuthResultDto>(Error.NotFoundById("CalendarConnection", connId));

        try
        {
            var tokens = await google.ExchangeCodeAsync(c.Code, c.RedirectUri, ct);
            if (string.IsNullOrEmpty(tokens.RefreshToken))
                return Result.Failure<OAuthResultDto>(Error.Custom("Calendar.OAuthFailed",
                    "Google did not allow offline access. Remove Vrodux from your Google account's connected apps and try again."));

            conn.SetCredentials(protector.Protect(JsonSerializer.Serialize(new
                { accessToken = tokens.AccessToken, refreshToken = tokens.RefreshToken, expiresAt = tokens.ExpiresAt }))!);
            conn.SetAccount(await google.GetAccountEmailAsync(tokens.AccessToken, ct));
            conn.SetSyncToken(null); // first pull is a full window
            await db.SaveChangesAsync(ct);
            return Result.Success(new OAuthResultDto(conn.UserId));
        }
        catch (Exception ex) when (ex is GoogleApiException or HttpRequestException)
        {
            conn.RecordError(ex.Message);
            await db.SaveChangesAsync(ct);
            return Result.Failure<OAuthResultDto>(Error.Custom("Calendar.OAuthFailed", "Could not complete the Google connection."));
        }
    }
}

internal sealed class DisconnectGoogleHandler(CalendarDbContext db, ICurrentUser user) : ICommandHandler<DisconnectGoogleCommand>
{
    public async Task<Result> Handle(DisconnectGoogleCommand c, CancellationToken ct)
    {
        if (user.Id is not { } me) return Result.Failure(Error.Custom("Auth.Unresolved", "Sign in again."));
        var conn = await db.Connections.FirstOrDefaultAsync(x => x.UserId == me && !x.IsDeleted, ct);
        if (conn is null) return Result.Success();

        // Events already on the calendar stay; they just stop mirroring. Their Google ids are dropped
        // from the sync cursor, so reconnecting does a clean full pull.
        conn.Disconnect();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class SyncNowHandler(CalendarDbContext db, ICurrentUser user, GoogleCalendarSync sync)
    : ICommandHandler<SyncNowCommand, SyncResultDto>
{
    public async Task<Result<SyncResultDto>> Handle(SyncNowCommand c, CancellationToken ct)
    {
        if (user.Id is not { } me) return Result.Failure<SyncResultDto>(Error.Custom("Auth.Unresolved", "Sign in again."));
        var conn = await EventMapping.ConnectionAsync(db, me, ct);
        if (conn is null)
            return Result.Failure<SyncResultDto>(Error.Custom("Calendar.Conflict", "Google Calendar is not connected."));

        // Push first so a pull cannot overwrite something not yet on Google with an older copy.
        await sync.PushUnsyncedAsync(conn, ct);
        return Result.Success(await sync.PullAsync(conn, ct));
    }
}
