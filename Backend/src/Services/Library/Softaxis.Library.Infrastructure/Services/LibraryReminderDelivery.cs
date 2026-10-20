using System.Globalization;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using MimeKit;
using Softaxis.BuildingBlocks.Application.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Infrastructure.Email;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.Library.Application.Reminders;
using Softaxis.Library.Infrastructure.Persistence;

namespace Softaxis.Library.Infrastructure.Services;

/// <summary>
/// Reads the shared "Email" config section the gateway already uses for password resets and
/// rent reminders — one SMTP account per deployment, not one per service.
/// </summary>
internal sealed class SmtpLibraryEmailService(
    IConfiguration configuration, ILogger<SmtpLibraryEmailService> logger) : ILibraryEmailService
{
    /// <summary>
    /// Optional "Email:PickupDirectory": write each notice there as an .eml file instead of
    /// sending it. For trying the reminders out on a machine with no mail account — the files
    /// open in any mail program.
    /// </summary>
    private string? PickupDirectory
    {
        get
        {
            var dir = configuration["Email:PickupDirectory"];
            return string.IsNullOrWhiteSpace(dir) ? null : dir;
        }
    }

    public bool IsConfigured
    {
        get
        {
            if (PickupDirectory is not null) return true;
            var s = configuration.GetSection("Email");
            return !string.IsNullOrWhiteSpace(s["SmtpHost"]) && !string.IsNullOrWhiteSpace(s["SmtpUsername"]);
        }
    }

    public async Task<bool> SendAsync(string toEmail, string toName, string fromName, string subject, string html,
        CancellationToken ct = default)
    {
        if (!IsConfigured)
        {
            // Logged rather than pretending it was delivered; the caller records it as not sent.
            logger.LogWarning("SMTP not configured. Library notice \"{Subject}\" would have gone to {Email}.", subject, toEmail);
            return false;
        }

        var section = configuration.GetSection("Email");
        var port    = int.Parse(section["SmtpPort"] ?? "587", CultureInfo.InvariantCulture);

        var message = new MimeMessage();
        // The library's name is shown; the address stays the deployment's own, or the mail is rejected.
        message.From.Add(new MailboxAddress(fromName, EmailSender.Address(section["FromAddress"])));
        message.Subject = subject;
        message.Body    = new TextPart("html") { Text = html };

        try
        {
            message.To.Add(new MailboxAddress(toName, toEmail));

            if (PickupDirectory is { } pickup)
            {
                Directory.CreateDirectory(pickup);
                await message.WriteToAsync(Path.Combine(pickup, $"{DateTime.UtcNow:yyyyMMdd-HHmmss}-{Guid.NewGuid():N}.eml"), ct);
                return true;
            }

            using var client = new SmtpClient();
            await client.ConnectAsync(section["SmtpHost"], port,
                port == 465 ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls, ct);
            await client.AuthenticateAsync(section["SmtpUsername"], section["SmtpPassword"] ?? string.Empty, ct);
            await client.SendAsync(message, ct);
            await client.DisconnectAsync(true, ct);
            return true;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to send library notice \"{Subject}\" to {Email}.", subject, toEmail);
            return false;
        }
    }
}

/// <summary>
/// Sends member notices for every workspace that has turned them on.
///
/// It wakes every 15 minutes so "your reserved book is ready" arrives while the copy is still
/// being held (three days), and runs the due-soon / overdue pass once a day, in the morning by
/// the library's own clock.
///
/// The startup delay is deliberate: every MigrateAndSeed* is awaited before the app serves, so
/// work on the boot path delays /health and can trip a deploy's health window into a rollback.
/// </summary>
internal sealed class LibraryReminderBackgroundService(
    IServiceScopeFactory scopeFactory,
    ILogger<LibraryReminderBackgroundService> logger) : BackgroundService
{
    private static readonly TimeSpan StartupDelay = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan Interval     = TimeSpan.FromMinutes(15);
    /// <summary>Local hour from which the daily pass may run — not in the middle of the night.</summary>
    private const int DailyHour = 8;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try { await Task.Delay(StartupDelay, stoppingToken); }
        catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            // An unhandled exception here would end the service for the life of the process.
            try { await SweepAsync(stoppingToken); }
            catch (Exception ex) { logger.LogError(ex, "Library reminder sweep failed."); }

            try { await Task.Delay(Interval, stoppingToken); }
            catch (OperationCanceledException) { return; }
        }
    }

    private async Task SweepAsync(CancellationToken ct)
    {
        List<Guid> tenantIds;
        using (var lookup = scopeFactory.CreateScope())
        {
            // Without SMTP nothing can be delivered; skip quietly instead of logging a failure
            // for every member every fifteen minutes.
            if (!lookup.ServiceProvider.GetRequiredService<ILibraryEmailService>().IsConfigured) return;

            // No ambient tenant here, so the tenant filter is bypassed on purpose and the shadow
            // column read directly.
            var db = lookup.ServiceProvider.GetRequiredService<LibraryDbContext>();
            tenantIds = await db.ReminderSettings.IgnoreQueryFilters()
                .Where(s => s.Enabled)
                .Select(s => EF.Property<Guid?>(s, TenantIsolation.Column))
                .Where(id => id != null).Select(id => id!.Value).Distinct().ToListAsync(ct);
        }

        foreach (var tenantId in tenantIds)
        {
            if (ct.IsCancellationRequested) return;

            // A fresh scope per workspace, so one tenant's tracked rows never reach the next.
            using var scope = scopeFactory.CreateScope();
            try
            {
                // A read-only cloud mirror of an on-premises library must not email its members
                // a second time; the shop's own server does that.
                var filter = scope.ServiceProvider.GetService<ITenantWorkFilter>();
                if (filter is not null && !await filter.ShouldProcessAsync(tenantId, ct)) continue;

                TenantAmbient.Set(tenantId, isSuperAdmin: false, isResolved: true);

                var db       = scope.ServiceProvider.GetRequiredService<LibraryDbContext>();
                var settings = await ReminderSettingsStore.GetOrCreateAsync(db, ct);
                if (!settings.Enabled) continue;

                var now   = ReminderSettingsStore.LocalNow(settings);
                var today = now.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
                var daily = settings.LastDailyRunOn != today && now.Hour >= DailyHour;

                var result = await scope.ServiceProvider.GetRequiredService<ILibraryReminderSender>()
                    .RunAsync(today, daily, dryRun: false, ct);

                if (result.DueSoon + result.Overdue + result.Ready + result.Failed > 0)
                    logger.LogInformation(
                        "Library {TenantId}: {DueSoon} due-soon, {Overdue} overdue, {Ready} ready, {Failed} failed.",
                        tenantId, result.DueSoon, result.Overdue, result.Ready, result.Failed);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Library reminder sweep failed for workspace {TenantId}.", tenantId);
            }
            finally
            {
                // The ambient tenant lives in an AsyncLocal; left set, it would leak into whatever runs next.
                TenantAmbient.Clear();
            }
        }
    }
}
