using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.Messaging.Domain.Entities;

namespace Softaxis.Messaging.Infrastructure.Persistence;

public sealed class MessagingDbContext(DbContextOptions<MessagingDbContext> options)
    : DbContext(options), ITenantAmbientContext
{
    public DbSet<WaConnection>   Connections   => Set<WaConnection>();
    public DbSet<WaTemplate>     Templates     => Set<WaTemplate>();
    public DbSet<WaConversation> Conversations => Set<WaConversation>();
    public DbSet<WaMessage>      Messages      => Set<WaMessage>();
    public DbSet<WaKeywordRule>  KeywordRules  => Set<WaKeywordRule>();
    public DbSet<WaAutomation>   Automations   => Set<WaAutomation>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.HasDefaultSchema("messaging");

        b.Entity<WaConnection>(e =>
        {
            e.ToTable("wa_connections");
            e.Property(x => x.PhoneNumberId).HasMaxLength(40);
            e.Property(x => x.WabaId).HasMaxLength(40);
            e.Property(x => x.AccessTokenCipher).HasMaxLength(4000);
            e.Property(x => x.AppSecretCipher).HasMaxLength(4000);
            e.Property(x => x.WebhookVerifyToken).HasMaxLength(64);
            // Meta's GET handshake carries only the token, so it is how that request finds its workspace.
            e.HasIndex(x => x.WebhookVerifyToken).IsUnique().HasFilter("[WebhookVerifyToken] IS NOT NULL");
            e.Property(x => x.DisplayPhone).HasMaxLength(40);
            e.Property(x => x.VerifiedName).HasMaxLength(200);
            e.Property(x => x.Status).HasMaxLength(20);
            e.Property(x => x.LastError).HasMaxLength(500);
            e.Property(x => x.WelcomeMessage).HasMaxLength(1000);
            e.Property(x => x.AwayMessage).HasMaxLength(1000);
            e.Property(x => x.TimeZoneId).HasMaxLength(100);
            e.Property(x => x.OpensAt).HasMaxLength(5);
            e.Property(x => x.ClosesAt).HasMaxLength(5);
            e.Property(x => x.WorkDays).HasMaxLength(20);
            e.Property(x => x.DefaultCountryCode).HasMaxLength(4);
            // Incoming webhooks find their workspace by this — and one number belongs to one workspace.
            e.HasIndex(x => x.PhoneNumberId).IsUnique();
        });

        b.Entity<WaTemplate>(e =>
        {
            e.ToTable("wa_templates");
            e.Property(x => x.Name).HasMaxLength(512);
            e.Property(x => x.Language).HasMaxLength(15);
            e.Property(x => x.MetaTemplateId).HasMaxLength(60);
            e.Property(x => x.Category).HasMaxLength(30);
            e.Property(x => x.Status).HasMaxLength(30);
            e.Property(x => x.HeaderText).HasMaxLength(200);
            e.Property(x => x.BodyText).HasMaxLength(2000);
            e.Property(x => x.FooterText).HasMaxLength(200);
            e.Property(x => x.RejectedReason).HasMaxLength(500);
        });

        b.Entity<WaConversation>(e =>
        {
            e.ToTable("wa_conversations");
            e.Property(x => x.ContactPhone).HasMaxLength(20);
            e.Property(x => x.ContactName).HasMaxLength(200);
            e.Property(x => x.RelatedType).HasMaxLength(40);
            e.Property(x => x.RelatedName).HasMaxLength(200);
            e.Property(x => x.LastMessagePreview).HasMaxLength(200);
            e.HasIndex(x => new { x.RelatedType, x.RelatedId });
            e.HasIndex(x => x.LastMessageAt);
        });

        b.Entity<WaMessage>(e =>
        {
            e.ToTable("wa_messages");
            e.Property(x => x.Direction).HasMaxLength(5);
            e.Property(x => x.Type).HasMaxLength(20);
            e.Property(x => x.Body).HasMaxLength(4096);
            e.Property(x => x.TemplateName).HasMaxLength(512);
            e.Property(x => x.WaMessageId).HasMaxLength(200);
            e.Property(x => x.Status).HasMaxLength(20);
            e.Property(x => x.Error).HasMaxLength(500);
            e.Property(x => x.Origin).HasMaxLength(20);
            e.Property(x => x.SentByName).HasMaxLength(200);
            e.Property(x => x.RelatedType).HasMaxLength(40);
            e.HasIndex(x => x.ConversationId);
            e.HasIndex(x => x.WaMessageId);
            e.HasIndex(x => new { x.RelatedType, x.RelatedId });
        });

        b.Entity<WaKeywordRule>(e =>
        {
            e.ToTable("wa_keyword_rules");
            e.Property(x => x.Keyword).HasMaxLength(100);
            e.Property(x => x.MatchType).HasMaxLength(10);
            e.Property(x => x.Reply).HasMaxLength(1000);
        });

        b.Entity<WaAutomation>(e =>
        {
            e.ToTable("wa_automations");
            e.Property(x => x.EventKey).HasMaxLength(60);
            e.Property(x => x.TemplateName).HasMaxLength(512);
            e.Property(x => x.Language).HasMaxLength(15);
            e.Property(x => x.VariableFields).HasMaxLength(500);
        });

        TenantIsolation.ApplyTenantId(b, this, "Softaxis.Messaging.Domain");

        // One connection, one automation per event, one template per name+language — per workspace.
        TenantIsolation.TenantUniqueIndex<WaConnection>(b, [], excludeSoftDeleted: false);
        TenantIsolation.TenantUniqueIndex<WaAutomation>(b, [nameof(WaAutomation.EventKey)], excludeSoftDeleted: false);
        TenantIsolation.TenantUniqueIndex<WaTemplate>(b, [nameof(WaTemplate.Name), nameof(WaTemplate.Language)], excludeSoftDeleted: false);
        TenantIsolation.TenantUniqueIndex<WaConversation>(b, [nameof(WaConversation.ContactPhone)], excludeSoftDeleted: false);

        base.OnModelCreating(b);
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        TenantIsolation.StampTenantId(ChangeTracker);
        return base.SaveChangesAsync(cancellationToken);
    }
}

/// <summary>Design-time factory for `dotnet ef`. Not used at runtime.</summary>
public sealed class MessagingDbContextFactory : IDesignTimeDbContextFactory<MessagingDbContext>
{
    public MessagingDbContext CreateDbContext(string[] args) =>
        new(new DbContextOptionsBuilder<MessagingDbContext>()
            .UseSqlServer(Environment.GetEnvironmentVariable("SOFTAXIS_DB")
                ?? "Server=SHAHBAZ-QFINITY;Database=SoftaxisErpDb;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=True;")
            .Options);
}
