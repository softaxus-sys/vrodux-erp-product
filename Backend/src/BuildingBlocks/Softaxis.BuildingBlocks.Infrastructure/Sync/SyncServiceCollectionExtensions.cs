using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;

namespace Softaxis.BuildingBlocks.Infrastructure.Sync;

/// <summary>
/// Registration and startup for the on-premises → cloud mirror capture layer.
/// See <c>docs/on-premises-cloud-mirror.md</c>.
/// </summary>
public static class SyncServiceCollectionExtensions
{
    /// <summary>
    /// Registers the capture services. Cheap and side-effect-free - nothing touches the database
    /// until <see cref="PrepareChangeCaptureAsync"/> runs, and that no-ops unless this installation
    /// is actually configured to mirror.
    /// </summary>
    public static IServiceCollection AddCloudMirrorCapture(
        this IServiceCollection services, IConfiguration configuration)
    {
        var cs = ConnectionString(configuration);

        services.AddSingleton(new SyncStateStore(cs));
        services.AddSingleton(new SyncSchemaReader(cs));
        services.AddSingleton<IChangeCaptureService>(new SqlChangeCaptureService(cs));

        // The receiving half. Registered in every deployment: only a mirror workspace ever gets a
        // push (the endpoint refuses anything else), so there is nothing to gate here.
        services.AddSingleton(sp => new SyncReceiveStore(
            cs, sp.GetRequiredService<ILoggerFactory>().CreateLogger<SyncReceiveStore>()));

        // ── The sending half ─────────────────────────────────────────────────
        services.AddSingleton(new SyncSettingsStore(cs));
        services.AddSingleton(new SyncRunLogStore(cs));

        // Silent unless the host registers a real one. Registered with TryAdd so the gateway's
        // implementation (which can reach email and the notification store) wins.
        services.TryAddSingleton<Application.Sync.ISyncAlerter, Application.Sync.NullSyncAlerter>();

        // A named client with a generous timeout: a 500-row batch over a shop's upstream link is
        // slower than an interactive request, and the default 100 s would fail batches that were
        // simply taking their time.
        services.AddHttpClient<SyncPushClient>(c => c.Timeout = TimeSpan.FromMinutes(3));

        services.AddScoped<SyncPushRunner>();
        services.AddHostedService<SyncPushService>();

        return services;
    }

    /// <summary>
    /// Prepares change capture on startup: enables Change Tracking, creates the watermark table, and
    /// reports any table in a mirrored schema that the catalogue does not cover.
    ///
    /// <para>
    /// A complete no-op unless this installation mirrors - decided by the database rather than by a
    /// separate config flag, so there is nothing to forget when a store is provisioned. Set
    /// <c>Sync:EnableChangeTracking=true</c> to force it on (testing, or ahead of provisioning).
    /// </para>
    ///
    /// <para>
    /// Never throws. Change capture is not needed to trade, so a failure here must not stop the shop
    /// from opening - it is logged, and the push simply has nothing to read until it is fixed.
    /// </para>
    /// </summary>
    public static async Task PrepareChangeCaptureAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var sp     = scope.ServiceProvider;
        var config = sp.GetRequiredService<IConfiguration>();
        var logger = sp.GetRequiredService<ILoggerFactory>().CreateLogger("CloudMirrorCapture");

        try
        {
            var cs = ConnectionString(config);
            if (string.IsNullOrWhiteSpace(cs)) return;

            var forced = config.GetValue("Sync:EnableChangeTracking", false);
            if (!forced && !await MirrorsToCloudAsync(cs)) return;

            var schemaReader = sp.GetRequiredService<SyncSchemaReader>();
            var stateStore   = sp.GetRequiredService<SyncStateStore>();

            var schemas  = SyncTableCatalog.BusinessSchemas.Append("identity").ToArray();
            var existing = await schemaReader.ReadTablesAsync(schemas);
            var catalogue = SyncTableCatalog.Build(existing);

            var bootstrapper = new ChangeTrackingBootstrapper(cs, logger);
            bootstrapper.WarnAboutUncatalogued(existing, catalogue);

            await stateStore.EnsureCreatedAsync();
            var result = await bootstrapper.EnableAsync(catalogue);

            logger.LogInformation(
                "Sync: change capture ready on {Database} - {InScope} table(s) in scope, {New} newly tracked.",
                result.Database, result.TablesInScope, result.NewlyEnabled);
        }
        catch (Exception ex)
        {
            logger.LogError(ex,
                "Sync: could not prepare change capture. The installation trades normally; " +
                "nothing will be pushed to the cloud mirror until this is resolved.");
        }
    }

    /// <summary>
    /// True when this installation has an enabled sync configuration. Read with raw SQL because
    /// BuildingBlocks cannot reference Identity, and tolerant of the table not existing yet - on a
    /// database that predates Phase 1 the answer is simply no.
    /// </summary>
    private static async Task<bool> MirrorsToCloudAsync(string connectionString)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            IF OBJECT_ID('[identity].[tenant_sync_settings]') IS NULL SELECT CAST(0 AS BIT);
            ELSE SELECT CAST(CASE WHEN EXISTS (
                     SELECT 1 FROM [identity].[tenant_sync_settings]
                     WHERE [Enabled] = 1 AND [IsDeleted] = 0) THEN 1 ELSE 0 END AS BIT);
            """;
        var result = await cmd.ExecuteScalarAsync();
        return result is bool b && b;
    }

    private static string ConnectionString(IConfiguration configuration) =>
        // Every service points at the same physical database, so any of them identifies it. Identity
        // is used because it is the one connection string guaranteed to be configured.
        configuration.GetConnectionString("IdentityDb") ?? string.Empty;
}
