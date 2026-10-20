using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Finance.Domain.Entities;

namespace Softaxis.Finance.Infrastructure.Persistence.Configurations;

// Unique indexes for these three are declared in FinanceDbContext, after the tenant column exists.

internal sealed class IntegrationSettingConfiguration : IEntityTypeConfiguration<IntegrationSetting>
{
    public void Configure(EntityTypeBuilder<IntegrationSetting> builder)
    {
        builder.ToTable("integration_settings");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.IntegrationKey).IsRequired().HasMaxLength(60);
        builder.Property(x => x.Mode).IsRequired().HasMaxLength(10);
        builder.Property(x => x.StartDate).HasMaxLength(10);
        builder.Property(x => x.LastSyncError).HasMaxLength(1000);
        builder.Property(x => x.UpdatedByName).HasMaxLength(200);
        builder.Property(x => x.ApprovalLimit).HasPrecision(18, 2);
    }
}

internal sealed class AccountMappingConfiguration : IEntityTypeConfiguration<AccountMapping>
{
    public void Configure(EntityTypeBuilder<AccountMapping> builder)
    {
        builder.ToTable("integration_account_mappings");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.IntegrationKey).IsRequired().HasMaxLength(60);
        builder.Property(x => x.Role).IsRequired().HasMaxLength(40);
    }
}

internal sealed class PostingItemConfiguration : IEntityTypeConfiguration<PostingItem>
{
    public void Configure(EntityTypeBuilder<PostingItem> builder)
    {
        builder.ToTable("posting_items");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.IntegrationKey).IsRequired().HasMaxLength(60);
        builder.Property(x => x.SourceModule).IsRequired().HasMaxLength(40);
        builder.Property(x => x.SourceNumber).IsRequired().HasMaxLength(100);
        builder.Property(x => x.SourceDate).IsRequired().HasMaxLength(10);
        builder.Property(x => x.Description).IsRequired().HasMaxLength(500);
        builder.Property(x => x.CurrencyCode).IsRequired().HasMaxLength(3);
        builder.Property(x => x.AmountsJson).IsRequired().HasMaxLength(2000);
        builder.Property(x => x.TotalAmount).HasPrecision(18, 2);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(10);
        builder.Property(x => x.LastError).HasMaxLength(1000);
        builder.Property(x => x.JournalEntryNumber).HasMaxLength(50);
        builder.Property(x => x.PostedByName).HasMaxLength(200);
        builder.Property(x => x.SubmittedByName).HasMaxLength(200);

        builder.Ignore(x => x.CanPost);
        builder.Ignore(x => x.CanSkip);
        builder.Ignore(x => x.CanRequeue);
        builder.Ignore(x => x.CanReverse);

        builder.HasIndex(x => x.Status);
        builder.HasIndex(x => x.JournalEntryId);
    }
}
