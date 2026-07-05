using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
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
        await FinanceSeedData.SeedAsync(db);
        await FinanceBankingTaxSeed.SeedAsync(db);
    }
}
