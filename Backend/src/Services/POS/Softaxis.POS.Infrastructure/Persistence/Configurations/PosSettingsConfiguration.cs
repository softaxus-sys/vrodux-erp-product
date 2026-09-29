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
        builder.Property(s => s.AllowOutOfStockSales).HasDefaultValue(false);
        builder.Property(s => s.PrinterMode).HasMaxLength(20);
        builder.Property(s => s.PrinterName).HasMaxLength(256);
        builder.Property(s => s.PrinterIp).HasMaxLength(100);
        builder.Property(s => s.FbrEnabled).HasDefaultValue(false);
        builder.Property(s => s.FbrEnvironment).HasMaxLength(20).HasDefaultValue("sandbox");
        builder.Property(s => s.FbrTokenProtected).HasMaxLength(4000);
        builder.Property(s => s.FbrServiceFee).HasPrecision(18, 2).HasDefaultValue(1m);
        builder.Property(s => s.FbrDefaultPctCode).HasMaxLength(20);
        builder.Ignore(s => s.FbrReady);
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
