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
