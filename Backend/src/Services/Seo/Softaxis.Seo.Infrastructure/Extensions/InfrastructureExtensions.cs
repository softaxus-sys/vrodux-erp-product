using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Softaxis.BuildingBlocks.Application.Behaviors;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.Seo.Application;
using Softaxis.Seo.Application.Abstractions;
using Softaxis.Seo.Infrastructure.Ai;
using Softaxis.Seo.Infrastructure.Content;
using Softaxis.Seo.Infrastructure.Crawl;
using Softaxis.Seo.Infrastructure.Google;
using Softaxis.Seo.Infrastructure.Persistence;
using Softaxis.Seo.Infrastructure.Scanning;
using Softaxis.Seo.Infrastructure.Security;
using Softaxis.Seo.Infrastructure.WordPress;

namespace Softaxis.Seo.Infrastructure.Extensions;

public static class InfrastructureExtensions
{
    public static IServiceCollection AddSeoInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<SeoDbContext>(opts =>
            opts.UseSqlServer(
                configuration.GetConnectionString("SeoDb"),
                sql => sql.MigrationsAssembly(typeof(SeoDbContext).Assembly.FullName)));

        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssemblies(
                typeof(AssemblyMarker).Assembly,   // Application
                typeof(SeoDbContext).Assembly);    // Infrastructure (handlers)

            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(LoggingBehavior<,>));
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
        });

        services.AddValidatorsFromAssembly(typeof(AssemblyMarker).Assembly);

        // Google OAuth token / API-key encryption at rest (over the gateway's Data Protection key ring).
        services.AddScoped<ISecretProtector, DataProtectionSecretProtector>();

        services.Configure<GoogleOptions>(configuration.GetSection(GoogleOptions.Section));
        services.AddHttpClient("google");
        services.AddHttpClient("seo-crawler", client => client.Timeout = TimeSpan.FromSeconds(15));
        services.AddScoped<GoogleOAuthClient>();

        services.AddScoped<SiteCrawler>();
        services.AddScoped<ISeoAiAnalyzer, SeoAiAnalyzer>();
        services.AddScoped<ISiteScanRunner, SiteScanRunner>();

        services.AddHostedService<SeoScanBackgroundService>();

        // Content generation (Phase 2) — scheduled AI-written SEO articles, drafts for review, with
        // an optional WordPress push. Reuses the same Google connection + crawler Phase 1 already set up.
        services.AddScoped<GoogleAccessTokenResolver>();
        services.AddScoped<ContentResearch>();
        services.AddScoped<IArticleWriter, ArticleWriter>();
        services.AddScoped<IArticleGenerationRunner, ArticleGenerationRunner>();
        services.AddHostedService<SeoContentBackgroundService>();

        services.AddHttpClient("wordpress");
        services.AddScoped<WordPressClient>();

        return services;
    }

    public static async Task MigrateAndSeedSeoAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SeoDbContext>();
        await db.Database.MigrateTolerantOfLockReleaseAsync();
    }
}
