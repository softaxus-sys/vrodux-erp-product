using Microsoft.EntityFrameworkCore;
using Softaxis.AiAssistant.Domain.Entities;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;

namespace Softaxis.AiAssistant.Infrastructure.Persistence;

public sealed class AiAssistantDbContext(DbContextOptions<AiAssistantDbContext> options)
    : DbContext(options), ITenantAmbientContext
{
    public DbSet<TenantAiSettings>  AiSettings     => Set<TenantAiSettings>();
    public DbSet<UserTelegramLink>  TelegramLinks  => Set<UserTelegramLink>();
    public DbSet<AiAutomationRule>  AutomationRules => Set<AiAutomationRule>();
    public DbSet<AiAutomationRun>   AutomationRuns  => Set<AiAutomationRun>();
    public DbSet<AiEventInbox>      EventInbox      => Set<AiEventInbox>();
    public DbSet<TenantVoiceSettings> VoiceSettings => Set<TenantVoiceSettings>();
    public DbSet<ScheduledCall>     ScheduledCalls  => Set<ScheduledCall>();
    public DbSet<CallAttempt>       CallAttempts    => Set<CallAttempt>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("aiassistant");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AiAssistantDbContext).Assembly);
        TenantIsolation.ApplyTenantId(modelBuilder, this, "Softaxis.AiAssistant.Domain");
        base.OnModelCreating(modelBuilder);
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        TenantIsolation.StampTenantId(ChangeTracker);
        var now = DateTime.UtcNow;
        foreach (var entry in ChangeTracker.Entries())
        {
            if (entry.State == EntityState.Added &&
                entry.Properties.Any(p => p.Metadata.Name == "CreatedAt"))
                entry.Property("CreatedAt").CurrentValue = now;

            if ((entry.State == EntityState.Added || entry.State == EntityState.Modified) &&
                entry.Properties.Any(p => p.Metadata.Name == "UpdatedAt"))
                entry.Property("UpdatedAt").CurrentValue = now;
        }
        return await base.SaveChangesAsync(cancellationToken);
    }
}
