using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.POS.Domain.Entities;

namespace Softaxis.POS.Infrastructure.Persistence.Configurations;

public sealed class PosSettingsConfiguration : IEntityTypeConfiguration<PosSettings>
{
    public void Configure(EntityTypeBuilder<PosSettings> builder)
    {
        builder.ToTable("pos_settings");
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).ValueGeneratedNever();
        builder.Property(s => s.OfflineModeEnabled).HasDefaultValue(false);
    }
}

public sealed class OfflineSyncBatchConfiguration : IEntityTypeConfiguration<OfflineSyncBatch>
{
    public void Configure(EntityTypeBuilder<OfflineSyncBatch> builder)
    {
        builder.ToTable("offline_sync_batches");
        builder.HasKey(b => b.Id);
        builder.Property(b => b.Id).ValueGeneratedNever();
        builder.Property(b => b.RegisterId).IsRequired().HasMaxLength(50);
        builder.HasIndex(b => b.LastSyncedAt);
    }
}

public sealed class PosTillStatusConfiguration : IEntityTypeConfiguration<PosTillStatus>
{
    public void Configure(EntityTypeBuilder<PosTillStatus> builder)
    {
        builder.ToTable("pos_till_status");
        builder.HasKey(t => t.Id);
        builder.Property(t => t.Id).ValueGeneratedNever();
        builder.Property(t => t.DeviceId).IsRequired().HasMaxLength(64);
        builder.Property(t => t.RegisterId).HasMaxLength(50);
        builder.Property(t => t.UserName).HasMaxLength(200);
        builder.Ignore(t => t.HasUnsyncedWork);
        // Unique (TenantId, DeviceId) declared in POSDbContext — needs the TenantId shadow column.
    }
}
