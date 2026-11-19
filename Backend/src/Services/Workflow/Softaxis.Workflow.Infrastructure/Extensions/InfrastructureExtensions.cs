using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Softaxis.BuildingBlocks.Application.Behaviors;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.Workflow.Application;
using Softaxis.Workflow.Infrastructure.Persistence;
using Softaxis.Workflow.Infrastructure.Handlers;
using Softaxis.Workflow.Infrastructure.Services;

namespace Softaxis.Workflow.Infrastructure.Extensions;

public static class InfrastructureExtensions
{
    public static IServiceCollection AddWorkflowInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        // Every service shares one database; falling back to IdentityDb means a deployment with no
        // WorkflowDb key still starts.
        var connection = configuration.GetConnectionString("WorkflowDb") ?? configuration.GetConnectionString("IdentityDb");

        services.AddDbContext<WorkflowDbContext>(opts =>
            opts.UseSqlServer(connection, sql => sql.MigrationsAssembly(typeof(WorkflowDbContext).Assembly.FullName)));

        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssemblies(typeof(AssemblyMarker).Assembly, typeof(WorkflowDbContext).Assembly);
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(LoggingBehavior<,>));
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
        });
        services.AddValidatorsFromAssembly(typeof(AssemblyMarker).Assembly);
        services.AddScoped<WfAccess>();
        services.AddScoped<WfBranding>();
        services.AddScoped<FlowResolver>();
        services.AddScoped<RequestEngine>();
        return services;
    }

    public static async Task MigrateAndSeedWorkflowAsync(this IServiceProvider services)
    {
        // Migrate only. Everything (settings, starter pack) is created per workspace on first use or on
        // request: a startup seed has no tenant, so its rows would be invisible to every workspace.
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<WorkflowDbContext>();
        await db.Database.MigrateTolerantOfLockReleaseAsync();
    }
}
