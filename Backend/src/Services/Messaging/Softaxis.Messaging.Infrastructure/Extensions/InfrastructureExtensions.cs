using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Softaxis.BuildingBlocks.Application.Behaviors;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.Messaging.Application;
using Softaxis.Messaging.Application.Abstractions;
using Softaxis.Messaging.Application.WhatsApp;
using Softaxis.Messaging.Infrastructure.Persistence;
using Softaxis.Messaging.Infrastructure.Services;

namespace Softaxis.Messaging.Infrastructure.Extensions;

public static class InfrastructureExtensions
{
    public static IServiceCollection AddMessagingInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connection = configuration.GetConnectionString("MessagingDb")
                         ?? configuration.GetConnectionString("IdentityDb");

        services.AddDbContext<MessagingDbContext>(opts =>
            opts.UseSqlServer(connection, sql => sql.MigrationsAssembly(typeof(MessagingDbContext).Assembly.FullName)));

        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssemblies(typeof(AssemblyMarker).Assembly, typeof(MessagingDbContext).Assembly);
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(LoggingBehavior<,>));
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
        });
        services.AddValidatorsFromAssembly(typeof(AssemblyMarker).Assembly);

        services.AddHttpClient(MetaWhatsAppClient.HttpClientName, c => c.Timeout = TimeSpan.FromSeconds(20));
        services.AddScoped<IWhatsAppClient, MetaWhatsAppClient>();
        services.AddSingleton<IMessagingSecretProtector, MessagingSecretProtector>();
        services.AddScoped<IWhatsAppSender, WhatsAppSender>();
        services.AddHostedService<WhatsAppAutomationService>();

        return services;
    }

    public static async Task MigrateMessagingAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MessagingDbContext>();
        await db.Database.MigrateTolerantOfLockReleaseAsync();
    }
}
