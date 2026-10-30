using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Seo.Domain.Entities;

namespace Softaxis.Seo.Infrastructure.Persistence.Configurations;

internal sealed class SeoSiteConfiguration : IEntityTypeConfiguration<SeoSite>
{
    public void Configure(EntityTypeBuilder<SeoSite> builder)
    {
        builder.ToTable("seo_sites");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Domain).IsRequired().HasMaxLength(255);
        builder.Property(x => x.DisplayName).IsRequired().HasMaxLength(200);
        builder.Property(x => x.SnippetKey).IsRequired().HasMaxLength(60);
        // Looked up on every anonymous snippet load (IgnoreQueryFilters, no ambient tenant) — see
        // SeoSnippetController / GetSnippetRulesHandler.
        builder.HasIndex(x => x.SnippetKey);
        builder.Property(x => x.ScanFrequency).IsRequired().HasMaxLength(20).HasDefaultValue("weekly");
        builder.Property(x => x.VerificationStatus).IsRequired().HasMaxLength(20).HasDefaultValue("pending");
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20).HasDefaultValue("active");
        builder.Property(x => x.IsDeleted).HasDefaultValue(false);
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

internal sealed class SeoGoogleIntegrationConfiguration : IEntityTypeConfiguration<SeoGoogleIntegration>
{
    public void Configure(EntityTypeBuilder<SeoGoogleIntegration> builder)
    {
        builder.ToTable("seo_google_integrations");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.HasIndex(x => x.SiteId);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20).HasDefaultValue("disconnected");
        builder.Property(x => x.Credentials).HasColumnType("nvarchar(max)");
        builder.Property(x => x.LastError).HasMaxLength(500);
        builder.Property(x => x.IsDeleted).HasDefaultValue(false);
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

internal sealed class SeoGoogleResourceConfiguration : IEntityTypeConfiguration<SeoGoogleResource>
{
    public void Configure(EntityTypeBuilder<SeoGoogleResource> builder)
    {
        builder.ToTable("seo_google_resources");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.HasIndex(x => x.IntegrationId);
        builder.Property(x => x.ResourceType).IsRequired().HasMaxLength(20);
        builder.Property(x => x.ExternalId).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Name).IsRequired().HasMaxLength(200);
    }
}

internal sealed class SeoAuditConfiguration : IEntityTypeConfiguration<SeoAudit>
{
    public void Configure(EntityTypeBuilder<SeoAudit> builder)
    {
        builder.ToTable("seo_audits");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.HasIndex(x => x.SiteId);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20).HasDefaultValue("running");
        builder.Property(x => x.Error).HasMaxLength(1000);
        builder.HasIndex(x => new { x.SiteId, x.StartedAt });
    }
}

internal sealed class SeoIssueConfiguration : IEntityTypeConfiguration<SeoIssue>
{
    public void Configure(EntityTypeBuilder<SeoIssue> builder)
    {
        builder.ToTable("seo_issues");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.HasIndex(x => x.SiteId);
        builder.HasIndex(x => x.AuditId);
        builder.HasIndex(x => x.Status);
        builder.Property(x => x.Source).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Category).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Severity).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Title).IsRequired().HasMaxLength(300);
        builder.Property(x => x.Description).IsRequired().HasMaxLength(2000);
        builder.Property(x => x.PageUrl).HasMaxLength(1000);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20).HasDefaultValue("open");
        builder.Property(x => x.Code).IsRequired().HasMaxLength(60).HasDefaultValue("");
        builder.Property(x => x.Fingerprint).IsRequired().HasMaxLength(200).HasDefaultValue("");
        builder.Property(x => x.AffectedCount).HasDefaultValue(1);
        builder.Property(x => x.DetailsJson).HasColumnType("nvarchar(max)");
        builder.Ignore(x => x.IsClosed);
        // Matching the same problem across scans is the hot path of every audit.
        builder.HasIndex(x => new { x.SiteId, x.Fingerprint });
    }
}

internal sealed class SeoPageConfiguration : IEntityTypeConfiguration<SeoPage>
{
    public void Configure(EntityTypeBuilder<SeoPage> builder)
    {
        builder.ToTable("seo_pages");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.HasIndex(x => x.AuditId);
        builder.HasIndex(x => new { x.SiteId, x.AuditId });
        builder.Property(x => x.Url).IsRequired().HasMaxLength(1000);
        builder.Property(x => x.FinalUrl).HasMaxLength(1000);
        builder.Property(x => x.Title).HasMaxLength(500);
        builder.Property(x => x.MetaDescription).HasMaxLength(1000);
        builder.Property(x => x.H1).HasMaxLength(500);
        builder.Property(x => x.Error).HasMaxLength(500);
    }
}

internal sealed class SeoWalletConfiguration : IEntityTypeConfiguration<SeoWallet>
{
    public void Configure(EntityTypeBuilder<SeoWallet> builder)
    {
        builder.ToTable("seo_wallets");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
    }
}

internal sealed class SeoCreditEntryConfiguration : IEntityTypeConfiguration<SeoCreditEntry>
{
    public void Configure(EntityTypeBuilder<SeoCreditEntry> builder)
    {
        builder.ToTable("seo_credit_ledger");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Type).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Reason).IsRequired().HasMaxLength(300);
        builder.Property(x => x.RefType).HasMaxLength(40);
        builder.Property(x => x.IdempotencyKey).IsRequired().HasMaxLength(120);
        builder.Property(x => x.ActorName).HasMaxLength(200);
    }
}

internal sealed class SeoFixConfiguration : IEntityTypeConfiguration<SeoFix>
{
    public void Configure(EntityTypeBuilder<SeoFix> builder)
    {
        builder.ToTable("seo_fixes");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.HasIndex(x => x.IssueId);
        builder.HasIndex(x => x.Status);
        // The hot path — the snippet's rules endpoint filters by (site, applied) on every page load.
        builder.HasIndex(x => new { x.SiteId, x.Status });
        builder.Property(x => x.PageUrl).HasMaxLength(1000);
        builder.Property(x => x.ChangeType).IsRequired().HasMaxLength(30);
        builder.Property(x => x.ProposedValueJson).IsRequired().HasColumnType("nvarchar(max)");
        builder.Property(x => x.Rationale).IsRequired().HasMaxLength(1000);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20).HasDefaultValue("pending_review");
        builder.Property(x => x.ReviewedByName).HasMaxLength(200);
    }
}

internal sealed class SeoArticleConfiguration : IEntityTypeConfiguration<SeoArticle>
{
    public void Configure(EntityTypeBuilder<SeoArticle> builder)
    {
        builder.ToTable("seo_articles");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.HasIndex(x => x.SiteId);
        builder.HasIndex(x => new { x.SiteId, x.Status });
        builder.Property(x => x.Title).IsRequired().HasMaxLength(300);
        builder.Property(x => x.Slug).IsRequired().HasMaxLength(200);
        builder.Property(x => x.MetaDescription).IsRequired().HasMaxLength(320);
        builder.Property(x => x.TargetKeyword).IsRequired().HasMaxLength(200);
        builder.Property(x => x.BodyMarkdown).IsRequired().HasColumnType("nvarchar(max)");
        builder.Property(x => x.SourceSignalsJson).IsRequired().HasColumnType("nvarchar(max)").HasDefaultValue("[]");
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20).HasDefaultValue("pending_review");
        builder.Property(x => x.ReviewedByName).HasMaxLength(200);
    }
}

internal sealed class SeoContentSettingsConfiguration : IEntityTypeConfiguration<SeoContentSettings>
{
    public void Configure(EntityTypeBuilder<SeoContentSettings> builder)
    {
        builder.ToTable("seo_content_settings");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.HasIndex(x => x.SiteId).IsUnique();
        builder.Property(x => x.Frequency).IsRequired().HasMaxLength(20).HasDefaultValue("weekly");
        builder.Property(x => x.NicheHint).HasMaxLength(1000);
        builder.Property(x => x.CompetitorDomainsCsv).HasMaxLength(1000);
    }
}

internal sealed class SeoWordPressConnectionConfiguration : IEntityTypeConfiguration<SeoWordPressConnection>
{
    public void Configure(EntityTypeBuilder<SeoWordPressConnection> builder)
    {
        builder.ToTable("seo_wordpress_connections");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.HasIndex(x => x.SiteId).IsUnique();
        builder.Property(x => x.SiteUrl).IsRequired().HasMaxLength(500);
        builder.Property(x => x.Username).IsRequired().HasMaxLength(200);
        builder.Property(x => x.AppPassword).IsRequired().HasColumnType("nvarchar(max)");
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20).HasDefaultValue("connected");
        builder.Property(x => x.LastError).HasMaxLength(500);
        builder.Property(x => x.IsDeleted).HasDefaultValue(false);
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

internal sealed class SeoCompetitorConfiguration : IEntityTypeConfiguration<SeoCompetitor>
{
    public void Configure(EntityTypeBuilder<SeoCompetitor> builder)
    {
        builder.ToTable("seo_competitors");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Domain).IsRequired().HasMaxLength(255);
        builder.HasIndex(x => new { x.SiteId, x.Domain });
    }
}

internal sealed class SeoKeywordSnapshotConfiguration : IEntityTypeConfiguration<SeoKeywordSnapshot>
{
    public void Configure(EntityTypeBuilder<SeoKeywordSnapshot> builder)
    {
        builder.ToTable("seo_keyword_snapshots");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Domain).IsRequired().HasMaxLength(255);
        builder.Property(x => x.ItemsJson).IsRequired().HasColumnType("nvarchar(max)");
        builder.HasIndex(x => new { x.SiteId, x.Domain, x.LocationCode, x.FetchedAt });
    }
}

internal sealed class SeoCompetitorScanConfiguration : IEntityTypeConfiguration<SeoCompetitorScan>
{
    public void Configure(EntityTypeBuilder<SeoCompetitorScan> builder)
    {
        builder.ToTable("seo_competitor_scans");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20);
        builder.Property(x => x.CompetitorsJson).IsRequired().HasColumnType("nvarchar(max)");
        builder.Property(x => x.TopicGapsJson).IsRequired().HasColumnType("nvarchar(max)");
        builder.Property(x => x.KeywordGapsJson).IsRequired().HasColumnType("nvarchar(max)");
        builder.Property(x => x.KeywordDataNote).HasMaxLength(500);
        builder.Property(x => x.Error).HasMaxLength(500);
        builder.HasIndex(x => new { x.SiteId, x.CreatedAt });
    }
}

internal sealed class SeoPlanItemConfiguration : IEntityTypeConfiguration<SeoPlanItem>
{
    public void Configure(EntityTypeBuilder<SeoPlanItem> builder)
    {
        builder.ToTable("seo_plan_items");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.PlannedDate).IsRequired().HasMaxLength(10);
        builder.Property(x => x.Title).IsRequired().HasMaxLength(300);
        builder.Property(x => x.TargetKeyword).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Reason).IsRequired().HasMaxLength(600);
        builder.Property(x => x.Source).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20);
        builder.HasIndex(x => new { x.SiteId, x.ScanId });
    }
}
