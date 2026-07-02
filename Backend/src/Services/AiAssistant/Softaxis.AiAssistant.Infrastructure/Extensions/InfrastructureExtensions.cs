using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
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

        // Telegram
        services.AddScoped<Telegram.TelegramClient>();

        return services;
    }

    public static async Task MigrateAndSeedAiAssistantAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AiAssistantDbContext>();
        await db.Database.MigrateAsync();
    }
}
