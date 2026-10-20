using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.LeadGen.Domain.Entities;

namespace Softaxis.LeadGen.Infrastructure.Persistence;

public sealed class LeadGenDbContext(DbContextOptions<LeadGenDbContext> options)
    : DbContext(options), ITenantAmbientContext
{
    // Workspace-owned
    public DbSet<LeadGenProfile>    Profiles       => Set<LeadGenProfile>();
    public DbSet<SearchJob>         Searches       => Set<SearchJob>();
    public DbSet<Prospect>          Prospects      => Set<Prospect>();
    public DbSet<ProspectContact>   Contacts       => Set<ProspectContact>();
    public DbSet<CreditWallet>      Wallets        => Set<CreditWallet>();
    public DbSet<CreditLedgerEntry> Ledger         => Set<CreditLedgerEntry>();
    public DbSet<CreditPurchase>    Purchases      => Set<CreditPurchase>();
    public DbSet<SuppressionEntry>  Suppressions   => Set<SuppressionEntry>();
    public DbSet<Mailbox>           Mailboxes      => Set<Mailbox>();
    public DbSet<Campaign>          Campaigns      => Set<Campaign>();
    public DbSet<CampaignStep>      Steps          => Set<CampaignStep>();
    public DbSet<CampaignRecipient> Recipients     => Set<CampaignRecipient>();
    public DbSet<OutreachThread>    Threads        => Set<OutreachThread>();
    public DbSet<OutreachMessage>   Messages       => Set<OutreachMessage>();

    // Platform-level (no tenant)
    public DbSet<CreditPack>             Packs            => Set<CreditPack>();
    public DbSet<PlatformSettings>       PlatformSettings => Set<PlatformSettings>();
    public DbSet<BusinessDirectoryEntry> Directory        => Set<BusinessDirectoryEntry>();
    public DbSet<GlobalSuppression>      GlobalSuppressions => Set<GlobalSuppression>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("leadgen");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(LeadGenDbContext).Assembly);

        // Shadow TenantId + query filter on every workspace table. This replaces any entity-level
        // soft-delete filter, so handlers apply !IsDeleted themselves.
        TenantIsolation.ApplyTenantId(modelBuilder, this, "Softaxis.LeadGen.Domain",
            exclude: [typeof(CreditPack), typeof(PlatformSettings), typeof(BusinessDirectoryEntry), typeof(GlobalSuppression)]);

        // One row per workspace.
        TenantIsolation.TenantUniqueIndex<LeadGenProfile>(modelBuilder, [], excludeSoftDeleted: false);
        TenantIsolation.TenantUniqueIndex<CreditWallet>(modelBuilder, [], excludeSoftDeleted: false);
        // A retried request or repeated webhook cannot post a second ledger row.
        TenantIsolation.TenantUniqueIndex<CreditLedgerEntry>(modelBuilder, [nameof(CreditLedgerEntry.IdempotencyKey)], excludeSoftDeleted: false);
        // The same Google place cannot be in a workspace twice.
        TenantIsolation.TenantUniqueIndex<Prospect>(modelBuilder, [nameof(Prospect.GooglePlaceId)],
            extraFilter: "[GooglePlaceId] IS NOT NULL");
        TenantIsolation.TenantUniqueIndex<SuppressionEntry>(modelBuilder, [nameof(SuppressionEntry.Kind), nameof(SuppressionEntry.Value)]);
        TenantIsolation.TenantUniqueIndex<Mailbox>(modelBuilder, [nameof(Mailbox.Address)]);
        TenantIsolation.TenantUniqueIndex<CampaignRecipient>(modelBuilder,
            [nameof(CampaignRecipient.CampaignId), nameof(CampaignRecipient.ProspectId)], excludeSoftDeleted: false);
        TenantIsolation.TenantUniqueIndex<CampaignStep>(modelBuilder,
            [nameof(CampaignStep.CampaignId), nameof(CampaignStep.Number)], excludeSoftDeleted: false);
        // Re-reading a mailbox can never store the same incoming message twice.
        TenantIsolation.TenantUniqueIndex<OutreachMessage>(modelBuilder,
            [nameof(OutreachMessage.MailboxId), nameof(OutreachMessage.ProviderMessageId)],
            excludeSoftDeleted: false, extraFilter: "[ProviderMessageId] IS NOT NULL");

        base.OnModelCreating(modelBuilder);
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        TenantIsolation.StampTenantId(ChangeTracker);
        return base.SaveChangesAsync(cancellationToken);
    }
}
