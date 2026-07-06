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

        // ── Background jobs ───────────────────────────────────────────────────
        services.AddHostedService<Services.RecurringInvoiceHostedService>();
        services.AddHostedService<Services.ExchangeRateRefreshService>();

        return services;
    }

    public static async Task MigrateAndSeedFinanceAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<FinanceDbContext>();
        await db.Database.MigrateAsync();
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
    }
}
