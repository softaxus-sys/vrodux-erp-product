using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Softaxis.AiAssistant.Application;
using Softaxis.AiAssistant.Application.Abstractions;
using Softaxis.AiAssistant.Infrastructure.Orchestration;
using Softaxis.AiAssistant.Infrastructure.Persistence;
using Softaxis.AiAssistant.Infrastructure.Providers;
using Softaxis.AiAssistant.Infrastructure.Security;
using Softaxis.AiAssistant.Infrastructure.Tools;
using Softaxis.AiAssistant.Infrastructure.Tools.Crm;
using Softaxis.BuildingBlocks.Application.Behaviors;

namespace Softaxis.AiAssistant.Infrastructure.Extensions;

public static class InfrastructureExtensions
{
    public static IServiceCollection AddAiAssistantInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // Fall back to the Identity connection string if a dedicated one isn't configured,
        // so adding this service can never break an existing deployment.
        var connectionString = configuration.GetConnectionString("AiAssistantDb")
                             ?? configuration.GetConnectionString("IdentityDb");

        services.AddDbContext<AiAssistantDbContext>(opts =>
            opts.UseSqlServer(
                connectionString,
                sql => sql.MigrationsAssembly(typeof(AiAssistantDbContext).Assembly.FullName)));

        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssemblies(
                typeof(AssemblyMarker).Assembly,          // Application
                typeof(AiAssistantDbContext).Assembly);   // Infrastructure (handlers)

            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(LoggingBehavior<,>));
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
        });

        services.AddValidatorsFromAssembly(typeof(AssemblyMarker).Assembly);

        // Shared HTTP client for provider calls + gateway tool calls.
        services.AddHttpClient("ai", c => c.Timeout = TimeSpan.FromSeconds(100));

        services.AddScoped<ISecretProtector, DataProtectionSecretProtector>();
        services.AddScoped<IAiProviderFactory, AiProviderFactory>();

        // Tool infrastructure
        services.AddScoped<GatewayToolClient>();
        // CRM agent
        services.AddScoped<IAiTool, CrmListLeadsTool>();
        services.AddScoped<IAiTool, CrmLeadsSummaryTool>();
        services.AddScoped<IAiTool, CrmCreateLeadTool>();       // write (confirm-gated)
        // Other module agents (read-only)
        services.AddScoped<IAiTool, FinanceInvoicesSummaryTool>();
        services.AddScoped<IAiTool, FinanceExpensesSummaryTool>();
        services.AddScoped<IAiTool, HrEmployeesSummaryTool>();
        services.AddScoped<IAiTool, SalesListOrdersTool>();
        services.AddScoped<IAiTool, PurchaseListOrdersTool>();
        services.AddScoped<IAiTool, CrmCustomersSummaryTool>();
        services.AddScoped<IAiTool, CrmPipelineSummaryTool>();
        services.AddScoped<IAiTool, InventoryProductsTool>();
        services.AddScoped<IAiTool, SalesQuotationsTool>();
        services.AddScoped<IAiTool, PurchaseVendorsTool>();
        services.AddScoped<IAiTool, ProjectsListTool>();
        services.AddScoped<IAiToolRegistry, AiToolRegistry>();

        services.AddScoped<IAiOrchestrator, AiOrchestrator>();

        // Autonomous rules (M4): per-rule runner + the background scheduler that fires due rules.
        services.AddScoped<IAiAutomationRunner, Automation.AiAutomationRunner>();
        services.AddHostedService<Automation.AiAutomationScheduler>();

        // Event triggers (M4b): the real event bus (overrides the gateway's NullAiEventBus fallback)
        // + the background processor that drains the event inbox and fires matching event rules.
        services.AddScoped<BuildingBlocks.Application.AiEvents.IAiEventBus, Automation.AiEventBus>();
        services.AddHostedService<Automation.AiEventInboxProcessor>();

        // Telegram
        services.AddScoped<Telegram.TelegramClient>();

        return services;
    }

    public static async Task MigrateAndSeedAiAssistantAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        // The AI Assistant is an optional add-on module — a failure applying its migrations must NOT
        // crash the whole ERP API on startup. Log and continue; the assistant stays unavailable until fixed.
        try
        {
            var db = scope.ServiceProvider.GetRequiredService<AiAssistantDbContext>();
            await db.Database.MigrateAsync();
        }
        catch (Exception ex)
        {
            var logger = scope.ServiceProvider
                .GetRequiredService<ILoggerFactory>()
                .CreateLogger("AiAssistant.Startup");
            logger.LogError(ex, "AI Assistant migration failed; the module will be unavailable until this is resolved.");
        }
    }
}
