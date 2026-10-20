using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.LeadGen.Domain.Entities;

namespace Softaxis.LeadGen.Infrastructure.Persistence.Configurations;

internal sealed class ProfileConfig : IEntityTypeConfiguration<LeadGenProfile>
{
    public void Configure(EntityTypeBuilder<LeadGenProfile> b)
    {
        b.ToTable("profiles"); b.HasKey(x => x.Id);
        b.Property(x => x.OfferSummary).HasMaxLength(600);
        b.Property(x => x.TargetCustomers).HasMaxLength(600);
        b.Property(x => x.DealSize).HasMaxLength(100);
        b.Property(x => x.CountryCode).HasMaxLength(2).IsRequired();
        b.Property(x => x.ExcludeKeywords).HasMaxLength(300);
        b.Property(x => x.SenderBusinessName).HasMaxLength(160);
        b.Property(x => x.SenderAddress).HasMaxLength(300);
        b.Property(x => x.SenderWebsite).HasMaxLength(200);
    }
}

internal sealed class SearchConfig : IEntityTypeConfiguration<SearchJob>
{
    public void Configure(EntityTypeBuilder<SearchJob> b)
    {
        b.ToTable("searches"); b.HasKey(x => x.Id);
        b.Property(x => x.Name).HasMaxLength(120).IsRequired();
        b.Property(x => x.CountryCode).HasMaxLength(2).IsRequired();
        b.Property(x => x.Keywords).HasMaxLength(120);
        b.Property(x => x.Status).HasMaxLength(20).IsRequired();
        b.Property(x => x.Error).HasMaxLength(500);
        b.Property(x => x.Progress).HasMaxLength(200);
        b.Property(x => x.CreatedByName).HasMaxLength(200);
        b.HasIndex(x => x.Status);
        b.HasIndex(x => x.CreatedAt);
    }
}

internal sealed class ProspectConfig : IEntityTypeConfiguration<Prospect>
{
    public void Configure(EntityTypeBuilder<Prospect> b)
    {
        b.ToTable("prospects"); b.HasKey(x => x.Id);
        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.NameKey).HasMaxLength(200).IsRequired();
        b.Property(x => x.Category).HasMaxLength(80);
        b.Property(x => x.PrimaryType).HasMaxLength(80);
        b.Property(x => x.CountryCode).HasMaxLength(2).IsRequired();
        b.Property(x => x.Region).HasMaxLength(80);
        b.Property(x => x.City).HasMaxLength(80);
        b.Property(x => x.Area).HasMaxLength(120);
        b.Property(x => x.Address).HasMaxLength(400);
        b.Property(x => x.Phone).HasMaxLength(40);
        b.Property(x => x.PhoneE164).HasMaxLength(24);
        b.Property(x => x.PhoneType).HasMaxLength(12);
        b.Property(x => x.Website).HasMaxLength(300);
        b.Property(x => x.Domain).HasMaxLength(200);
        b.Property(x => x.Email).HasMaxLength(320);
        b.Property(x => x.EmailStatus).HasMaxLength(12).IsRequired();
        b.Property(x => x.Social).HasMaxLength(1500);
        b.Property(x => x.Rating).HasPrecision(3, 2);
        b.Property(x => x.BusinessStatus).HasMaxLength(30);
        b.Property(x => x.GoogleMapsUri).HasMaxLength(400);
        b.Property(x => x.GooglePlaceId).HasMaxLength(200);
        b.Property(x => x.Status).HasMaxLength(20).IsRequired();
        b.Property(x => x.ScoreNotes).HasMaxLength(2000);
        b.Property(x => x.OwnerName).HasMaxLength(200);
        b.Property(x => x.Notes).HasMaxLength(4000);
        b.HasMany(x => x.Contacts).WithOne().HasForeignKey(c => c.ProspectId).OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(x => x.SearchJobId);
        b.HasIndex(x => x.Status);
        b.HasIndex(x => x.Domain);
        b.HasIndex(x => x.PhoneE164);
        b.HasIndex(x => x.Email);
        b.HasIndex(x => x.OwnerUserId);
        b.HasIndex(x => new { x.NameKey, x.Region });
    }
}

internal sealed class ContactConfig : IEntityTypeConfiguration<ProspectContact>
{
    public void Configure(EntityTypeBuilder<ProspectContact> b)
    {
        b.ToTable("prospect_contacts"); b.HasKey(x => x.Id);
        b.Property(x => x.FullName).HasMaxLength(200).IsRequired();
        b.Property(x => x.Title).HasMaxLength(120);
        b.Property(x => x.Email).HasMaxLength(320);
        b.Property(x => x.EmailStatus).HasMaxLength(12).IsRequired();
        b.Property(x => x.Phone).HasMaxLength(40);
        b.Property(x => x.Source).HasMaxLength(20).IsRequired();
    }
}

internal sealed class WalletConfig : IEntityTypeConfiguration<CreditWallet>
{
    public void Configure(EntityTypeBuilder<CreditWallet> b) { b.ToTable("credit_wallets"); b.HasKey(x => x.Id); }
}

internal sealed class LedgerConfig : IEntityTypeConfiguration<CreditLedgerEntry>
{
    public void Configure(EntityTypeBuilder<CreditLedgerEntry> b)
    {
        b.ToTable("credit_ledger"); b.HasKey(x => x.Id);
        b.Property(x => x.Type).HasMaxLength(16).IsRequired();
        b.Property(x => x.Reason).HasMaxLength(300).IsRequired();
        b.Property(x => x.RefType).HasMaxLength(30);
        b.Property(x => x.IdempotencyKey).HasMaxLength(160).IsRequired();
        b.Property(x => x.ActorName).HasMaxLength(200);
        b.HasIndex(x => x.CreatedAt);
    }
}

internal sealed class PurchaseConfig : IEntityTypeConfiguration<CreditPurchase>
{
    public void Configure(EntityTypeBuilder<CreditPurchase> b)
    {
        b.ToTable("credit_purchases"); b.HasKey(x => x.Id);
        b.Property(x => x.PackName).HasMaxLength(80).IsRequired();
        b.Property(x => x.Currency).HasMaxLength(3).IsRequired();
        b.Property(x => x.Provider).HasMaxLength(10).IsRequired();
        b.Property(x => x.ProviderRef).HasMaxLength(200);
        b.Property(x => x.Status).HasMaxLength(10).IsRequired();
        b.Property(x => x.FailureReason).HasMaxLength(300);
        b.Property(x => x.CreatedByName).HasMaxLength(200);
        // Provider references are globally unique, so no tenant in this index: the webhook that
        // looks a purchase up arrives with no tenant context at all.
        b.HasIndex(x => new { x.Provider, x.ProviderRef }).IsUnique().HasFilter("[ProviderRef] IS NOT NULL");
    }
}

internal sealed class SuppressionConfig : IEntityTypeConfiguration<SuppressionEntry>
{
    public void Configure(EntityTypeBuilder<SuppressionEntry> b)
    {
        b.ToTable("suppressions"); b.HasKey(x => x.Id);
        b.Property(x => x.Kind).HasMaxLength(10).IsRequired();
        b.Property(x => x.Value).HasMaxLength(320).IsRequired();
        b.Property(x => x.Reason).HasMaxLength(30).IsRequired();
        b.Property(x => x.Source).HasMaxLength(120);
    }
}

internal sealed class MailboxConfig : IEntityTypeConfiguration<Mailbox>
{
    public void Configure(EntityTypeBuilder<Mailbox> b)
    {
        b.ToTable("mailboxes"); b.HasKey(x => x.Id);
        b.Property(x => x.Provider).HasMaxLength(12).IsRequired();
        b.Property(x => x.Address).HasMaxLength(320).IsRequired();
        b.Property(x => x.DisplayName).HasMaxLength(120);
        b.Property(x => x.Status).HasMaxLength(14).IsRequired();
        b.Property(x => x.StatusReason).HasMaxLength(300);
        b.Property(x => x.Credentials).HasColumnType("nvarchar(max)");
        b.Property(x => x.SmtpHost).HasMaxLength(255);
        b.Property(x => x.ImapHost).HasMaxLength(255);
        b.Property(x => x.Username).HasMaxLength(320);
        b.Property(x => x.SyncCursor).HasMaxLength(400);
        b.Property(x => x.LastError).HasMaxLength(400);
        b.Property(x => x.SignatureText).HasMaxLength(1000);
    }
}

internal sealed class CampaignConfig : IEntityTypeConfiguration<Campaign>
{
    public void Configure(EntityTypeBuilder<Campaign> b)
    {
        b.ToTable("campaigns"); b.HasKey(x => x.Id);
        b.Property(x => x.Name).HasMaxLength(120).IsRequired();
        b.Property(x => x.Status).HasMaxLength(12).IsRequired();
        b.Property(x => x.TimeZoneId).HasMaxLength(60).IsRequired();
        b.Property(x => x.WindowStart).HasMaxLength(5).IsRequired();
        b.Property(x => x.WindowEnd).HasMaxLength(5).IsRequired();
        b.Property(x => x.SendDays).HasMaxLength(20).IsRequired();
        b.Property(x => x.PauseReason).HasMaxLength(300);
        b.Property(x => x.CreatedByName).HasMaxLength(200);
        b.HasMany(x => x.Steps).WithOne().HasForeignKey(s => s.CampaignId).OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(x => x.Status);
        b.HasIndex(x => x.MailboxId);
    }
}

internal sealed class StepConfig : IEntityTypeConfiguration<CampaignStep>
{
    public void Configure(EntityTypeBuilder<CampaignStep> b)
    {
        b.ToTable("campaign_steps"); b.HasKey(x => x.Id);
        b.Property(x => x.Subject).HasMaxLength(200).IsRequired();
        b.Property(x => x.Body).HasMaxLength(8000).IsRequired();
    }
}

internal sealed class RecipientConfig : IEntityTypeConfiguration<CampaignRecipient>
{
    public void Configure(EntityTypeBuilder<CampaignRecipient> b)
    {
        b.ToTable("campaign_recipients"); b.HasKey(x => x.Id);
        b.Property(x => x.Email).HasMaxLength(320).IsRequired();
        b.Property(x => x.Status).HasMaxLength(14).IsRequired();
        b.Property(x => x.LastError).HasMaxLength(300);
        b.HasIndex(x => new { x.Status, x.NextSendAt });
        b.HasIndex(x => x.ProspectId);
        b.HasIndex(x => x.Email);
    }
}

internal sealed class ThreadConfig : IEntityTypeConfiguration<OutreachThread>
{
    public void Configure(EntityTypeBuilder<OutreachThread> b)
    {
        b.ToTable("threads"); b.HasKey(x => x.Id);
        b.Property(x => x.Counterparty).HasMaxLength(320).IsRequired();
        b.Property(x => x.Subject).HasMaxLength(300).IsRequired();
        b.Property(x => x.ProviderThreadId).HasMaxLength(200);
        b.Property(x => x.Classification).HasMaxLength(20).IsRequired();
        b.Property(x => x.AssignedName).HasMaxLength(200);
        b.Property(x => x.Snippet).HasMaxLength(200);
        b.HasIndex(x => new { x.MailboxId, x.Counterparty });
        b.HasIndex(x => x.LastMessageAt);
        b.HasIndex(x => x.ProviderThreadId);
    }
}

internal sealed class MessageConfig : IEntityTypeConfiguration<OutreachMessage>
{
    public void Configure(EntityTypeBuilder<OutreachMessage> b)
    {
        b.ToTable("messages"); b.HasKey(x => x.Id);
        b.Property(x => x.Direction).HasMaxLength(3).IsRequired();
        b.Property(x => x.Status).HasMaxLength(10).IsRequired();
        b.Property(x => x.FromAddress).HasMaxLength(320).IsRequired();
        b.Property(x => x.ToAddress).HasMaxLength(320).IsRequired();
        b.Property(x => x.Cc).HasMaxLength(1000);
        b.Property(x => x.Subject).HasMaxLength(300).IsRequired();
        b.Property(x => x.BodyText).HasColumnType("nvarchar(max)");
        b.Property(x => x.BodyHtml).HasColumnType("nvarchar(max)");
        b.Property(x => x.MessageIdHeader).HasMaxLength(300);
        b.Property(x => x.InReplyTo).HasMaxLength(300);
        b.Property(x => x.ProviderMessageId).HasMaxLength(200);
        b.Property(x => x.Error).HasMaxLength(400);
        b.HasIndex(x => x.ThreadId);
        b.HasIndex(x => x.MessageIdHeader);
        b.HasIndex(x => new { x.CampaignId, x.Status });
        b.HasIndex(x => x.OccurredAt);
    }
}

// ── Platform tables ──────────────────────────────────────────────────────────────────────────

internal sealed class PackConfig : IEntityTypeConfiguration<CreditPack>
{
    public void Configure(EntityTypeBuilder<CreditPack> b)
    {
        b.ToTable("credit_packs"); b.HasKey(x => x.Id);
        b.Property(x => x.Name).HasMaxLength(80).IsRequired();
        b.Property(x => x.Currency).HasMaxLength(3).IsRequired();
        b.Property(x => x.Badge).HasMaxLength(30);
    }
}

internal sealed class PlatformSettingsConfig : IEntityTypeConfiguration<PlatformSettings>
{
    public void Configure(EntityTypeBuilder<PlatformSettings> b)
    {
        b.ToTable("platform_settings"); b.HasKey(x => x.Id);
        b.Property(x => x.AllowedCountries).HasMaxLength(200).IsRequired();
    }
}

internal sealed class DirectoryConfig : IEntityTypeConfiguration<BusinessDirectoryEntry>
{
    public void Configure(EntityTypeBuilder<BusinessDirectoryEntry> b)
    {
        b.ToTable("business_directory"); b.HasKey(x => x.Id);
        b.Property(x => x.GooglePlaceId).HasMaxLength(200).IsRequired();
        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.NameKey).HasMaxLength(200).IsRequired();
        b.Property(x => x.Category).HasMaxLength(80);
        b.Property(x => x.PrimaryType).HasMaxLength(80);
        b.Property(x => x.CountryCode).HasMaxLength(2).IsRequired();
        b.Property(x => x.Region).HasMaxLength(80);
        b.Property(x => x.City).HasMaxLength(80);
        b.Property(x => x.Area).HasMaxLength(120);
        b.Property(x => x.Address).HasMaxLength(400);
        b.Property(x => x.Phone).HasMaxLength(40);
        b.Property(x => x.PhoneE164).HasMaxLength(24);
        b.Property(x => x.PhoneType).HasMaxLength(12);
        b.Property(x => x.Website).HasMaxLength(300);
        b.Property(x => x.Domain).HasMaxLength(200);
        b.Property(x => x.Email).HasMaxLength(320);
        b.Property(x => x.EmailStatus).HasMaxLength(12).IsRequired();
        b.Property(x => x.Social).HasMaxLength(1500);
        b.Property(x => x.Rating).HasPrecision(3, 2);
        b.Property(x => x.BusinessStatus).HasMaxLength(30);
        b.Property(x => x.GoogleMapsUri).HasMaxLength(400);
        b.Ignore(x => x.IsClosed);
        b.HasIndex(x => x.GooglePlaceId).IsUnique();
        b.HasIndex(x => new { x.CountryCode, x.Region });
    }
}

internal sealed class GlobalSuppressionConfig : IEntityTypeConfiguration<GlobalSuppression>
{
    public void Configure(EntityTypeBuilder<GlobalSuppression> b)
    {
        b.ToTable("global_suppressions"); b.HasKey(x => x.Id);
        b.Property(x => x.Kind).HasMaxLength(10).IsRequired();
        b.Property(x => x.Value).HasMaxLength(320).IsRequired();
        b.Property(x => x.Reason).HasMaxLength(30).IsRequired();
        b.HasIndex(x => new { x.Kind, x.Value }).IsUnique();
    }
}
