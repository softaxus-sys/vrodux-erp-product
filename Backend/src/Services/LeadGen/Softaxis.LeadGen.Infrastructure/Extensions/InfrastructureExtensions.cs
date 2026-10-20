using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.Behaviors;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.LeadGen.Application;
using Softaxis.LeadGen.Application.Abstractions;
using Softaxis.LeadGen.Domain.Entities;
using Softaxis.LeadGen.Infrastructure.Mail;
using Softaxis.LeadGen.Infrastructure.Options;
using Softaxis.LeadGen.Infrastructure.Persistence;
using Softaxis.LeadGen.Infrastructure.Providers;
using Softaxis.LeadGen.Infrastructure.Security;
using Softaxis.LeadGen.Infrastructure.Services;

namespace Softaxis.LeadGen.Infrastructure.Extensions;

public static class InfrastructureExtensions
{
    public static IServiceCollection AddLeadGenInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        // Every service shares one database; falling back to IdentityDb means a deployment that has not
        // been given a LeadGenDb key still starts.
        var connection = configuration.GetConnectionString("LeadGenDb") ?? configuration.GetConnectionString("IdentityDb");

        services.AddDbContext<LeadGenDbContext>(opts =>
            opts.UseSqlServer(connection, sql => sql.MigrationsAssembly(typeof(LeadGenDbContext).Assembly.FullName)));

        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssemblies(typeof(AssemblyMarker).Assembly, typeof(LeadGenDbContext).Assembly);
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(LoggingBehavior<,>));
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
        });
        services.AddValidatorsFromAssembly(typeof(AssemblyMarker).Assembly);

        services.Configure<LeadGenOptions>(configuration.GetSection(LeadGenOptions.Section));
        services.AddMemoryCache();

        // Plain API calls (Google Places, Stripe, PayPal, Gmail, Graph, the email verifier).
        services.AddHttpClient("leadgen-api", c =>
        {
            c.Timeout = TimeSpan.FromSeconds(30);
            c.DefaultRequestHeaders.UserAgent.ParseAdd("VroduxLeadGen/1.0");
        });
        // Fetching businesses' own websites: public internet only, short timeouts. See SafeHttp.
        services.AddHttpClient("leadgen-web", c => c.Timeout = TimeSpan.FromSeconds(20))
            .ConfigurePrimaryHttpMessageHandler(SafeHttp.CreateHandler);

        services.AddScoped<ISecretProtector, DataProtectionSecretProtector>();
        services.AddScoped<IPlatformSettings, PlatformSettingsService>();
        services.AddScoped<ICurrentUserAccessor, CurrentUserAccessor>();
        services.AddScoped<ICreditService, CreditService>();
        services.AddScoped<ITenantInfoReader, TenantInfoReader>();
        services.AddScoped<IOutreachPolicy, OutreachPolicy>();

        // Finding and enriching businesses.
        services.AddScoped<IPlacesClient, GooglePlacesClient>();
        services.AddScoped<IWebsiteEnricher, WebsiteEnricher>();
        services.AddScoped<IEmailChecker, EmailChecker>();
        services.AddScoped<IEnrichmentService, EnrichmentService>();
        services.AddScoped<SearchRunner>();

        // Money.
        services.AddScoped<ICreditPayments, CreditPayments>();
        services.AddScoped<ICreditFulfilment, CreditFulfilment>();

        // Email.
        services.AddScoped<ImapSmtpTransport>();
        services.AddScoped<IMailTransport>(sp => sp.GetRequiredService<ImapSmtpTransport>());
        services.AddScoped<IMailTransport, GmailTransport>();
        services.AddScoped<IMailTransport, GraphTransport>();
        services.AddScoped<IMailTransportFactory, MailTransportFactory>();
        services.AddScoped<IMailboxAuth, MailboxAuth>();
        services.AddScoped<IEmailRenderer, EmailRenderer>();
        services.AddScoped<IUnsubscribeTokens, UnsubscribeTokens>();
        services.AddScoped<IUnsubscribeService, UnsubscribeService>();
        services.AddScoped<IOutreachEngine, OutreachEngine>();

        services.TryAddSingleton<BuildingBlocks.Application.Multitenancy.ITenantWorkFilter,
            BuildingBlocks.Application.Multitenancy.AllowAllTenantWorkFilter>();
        services.AddHostedService<SearchWorker>();
        services.AddHostedService<OutreachSendWorker>();
        services.AddHostedService<MailboxSyncWorker>();
        return services;
    }

    public static async Task MigrateAndSeedLeadGenAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<LeadGenDbContext>();
        await db.Database.MigrateTolerantOfLockReleaseAsync();

        // Credit packs are platform-level (no workspace), so unlike workspace data they can be seeded at
        // startup. Prices are a starting point; the super admin edits them from the console.
        try
        {
            if (!await db.Packs.AnyAsync())
            {
                db.Packs.AddRange(
                    new CreditPack("Starter", 100, 1900, "USD", 1, null),
                    new CreditPack("Growth", 500, 7900, "USD", 2, "Popular"),
                    new CreditPack("Scale", 2000, 24900, "USD", 3, "Best value"));
                await db.SaveChangesAsync();
            }
        }
        catch (Exception ex)
        {
            scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("LeadGen")
                .LogWarning(ex, "Could not seed the default credit packs.");
        }
    }
}
