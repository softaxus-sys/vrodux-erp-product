using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Softaxis.BuildingBlocks.Infrastructure.Seeding;
using Microsoft.Extensions.DependencyInjection;
using Softaxis.BuildingBlocks.Application.Behaviors;
using Softaxis.Finance.Application.Abstractions;
using Softaxis.Finance.Application.Accounts.Commands;
using Softaxis.Finance.Infrastructure.Handlers.Accounts;
using Softaxis.Finance.Infrastructure.Handlers.GeneralLedger;
using Softaxis.Finance.Infrastructure.Persistence;
using Softaxis.Finance.Infrastructure.Persistence.Seed;
using Softaxis.Finance.Infrastructure.Services;

namespace Softaxis.Finance.Infrastructure.Extensions;

public static class InfrastructureExtensions
{
    public static IServiceCollection AddFinanceInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // QuestPDF refuses to render until a licence is declared. Set here, at composition, so the
        // obligation is stated once where the service is wired rather than hidden in a static ctor.
        // Community edition: free while company revenue is under the threshold its licence states.
        InvoicePdfBuilder.Configure();

        // ── Database ──────────────────────────────────────────────────────────
        services.AddDbContext<FinanceDbContext>(opts =>
            opts.UseSqlServer(
                configuration.GetConnectionString("FinanceDb"),
                sql => sql.MigrationsAssembly(typeof(FinanceDbContext).Assembly.FullName)));

        // ── MediatR — scan Application + Infrastructure for handlers ─────────
        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssemblies(
                typeof(CreateAccountCommand).Assembly,    // Application
                typeof(GetAccountsHandler).Assembly);     // Infrastructure

            // Pipeline order matters: Logging wraps Validation wraps Handler
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(LoggingBehavior<,>));
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
        });

        // ── FluentValidation — register all validators from Application ───────
        services.AddValidatorsFromAssembly(typeof(CreateAccountCommand).Assembly);

        // ── Exchange rates — online provider + daily refresh ─────────────────
        services.Configure<ExchangeRateOptions>(configuration.GetSection(ExchangeRateOptions.Section));
        services.AddHttpClient("exchange-rates");
        services.AddScoped<IExchangeRateProvider, ErApiExchangeRateProvider>();
        // Invoice delivery. Finance previously had no email capability at all, so every recurring
        // invoice was generated as a draft and sat there.
        services.AddScoped<Softaxis.Finance.Application.Abstractions.IFinanceEmailService,
                           Services.SmtpFinanceEmailService>();

        // ── Background jobs ───────────────────────────────────────────────────
        services.AddHostedService<Services.RecurringInvoiceHostedService>();
        services.AddHostedService<Services.ExchangeRateRefreshService>();

        return services;
    }

    public static async Task MigrateAndSeedFinanceAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<FinanceDbContext>();
        await db.Database.MigrateTolerantOfLockReleaseAsync();
        // Demo-tenant mode: run the FULL seed (reference + demo business) under the demo tenant's
        // ambient context, so the chart of accounts, FX, and demo records are all stamped with the
        // demo tenant id (intended for a fresh/dedicated demo database — never the production DB).
        if (DemoTenantSeeder.Enabled(scope.ServiceProvider))
        {
            await DemoTenantSeeder.RunAsync(async () =>
            {
                await FinanceSeedData.SeedAsync(db, includeDemo: true);
                await FinanceBankingTaxSeed.SeedAsync(db, includeDemo: true);
            });
        }
        else
        {
            // Reference data (currencies, FX, account types, chart of accounts, tax periods) always
            // seeds; demo business records only when Seeding:DemoData is enabled (local dev only).
            var includeDemo = DemoSeedGate.DemoEnabled(scope.ServiceProvider);
            await FinanceSeedData.SeedAsync(db, includeDemo);
            await FinanceBankingTaxSeed.SeedAsync(db, includeDemo);
        }

        await BackfillTenantChartOfAccountsAsync(db);
    }

    /// <summary>
    /// Gives every existing tenant its own copy of the standard chart of accounts.
    ///
    /// The seed above writes the reference chart with <c>TenantId = NULL</c> (there is no ambient
    /// tenant during startup, so <c>StampTenantId</c> no-ops), which the tenant query filter then
    /// hides from every tenant — leaving <c>GlPoster</c> unable to find e.g. account '1200' and
    /// throwing the first time an invoice is sent. See <see cref="ChartOfAccountsProvisioner"/>.
    ///
    /// Idempotent and self-limiting: once a tenant owns the standard account numbers this is a
    /// no-op. Best-effort — a failure here must never crash-loop service startup, and the tenant
    /// is provisioned on demand by <c>GlPoster</c> anyway.
    /// </summary>
    private static async Task BackfillTenantChartOfAccountsAsync(FinanceDbContext db)
    {
        // Outside the try: a catalogue that cannot satisfy GlPoster is a programming error and
        // should fail loudly at startup, not be swallowed and rediscovered as a runtime 500.
        ChartOfAccountsCatalogue.AssertCoversGlPoster(GlPoster.RequiredAccountNumbers);

        try
        {
            // Finance and Identity share one physical database (different schemas), so the tenant
            // list is a plain cross-schema read. NOTE: `identity` is a reserved SQL Server keyword
            // and MUST stay bracketed, or this fails with "Incorrect syntax near the keyword 'identity'".
            var tenantIds = await db.Database
                .SqlQueryRaw<Guid>("SELECT [Id] AS [Value] FROM [identity].[tenants]")
                .ToListAsync();

            foreach (var tenantId in tenantIds)
                await ChartOfAccountsProvisioner.EnsureForTenantAsync(db, tenantId);

            await db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            // Not rethrown: startup seeding runs before the app serves traffic, and a hard failure
            // here would take the whole gateway down over data that GlPoster can provision lazily
            // on first use. But it MUST be visible — a silent catch here just relocates the
            // original "GL account not found" mystery to a different place.
            Console.Error.WriteLine(
                $"[Finance] Chart-of-accounts tenant backfill failed: {ex.GetType().Name}: {ex.Message}");
        }
    }
}
