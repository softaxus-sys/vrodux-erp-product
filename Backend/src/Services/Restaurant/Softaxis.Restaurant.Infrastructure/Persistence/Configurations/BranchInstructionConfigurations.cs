using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Restaurant.Domain.Entities;

namespace Softaxis.Restaurant.Infrastructure.Persistence.Configurations;

internal sealed class BranchInstructionConfiguration : IEntityTypeConfiguration<BranchInstruction>
{
    public void Configure(EntityTypeBuilder<BranchInstruction> b)
    {
        b.ToTable("BranchInstructions");
        b.HasKey(x => x.Id);
        b.Property(x => x.Kind).HasMaxLength(30).IsRequired();
        b.Property(x => x.Reason).HasMaxLength(500).IsRequired();
        b.Property(x => x.Method).HasMaxLength(30);
        b.Property(x => x.Amount).HasPrecision(18, 2);
        b.Property(x => x.RequestedByName).HasMaxLength(200).IsRequired();
        b.HasIndex(x => new { x.BranchId, x.RequestedAt });
        b.HasIndex(x => x.OrderId);
    }
}

internal sealed class BranchInstructionResultConfiguration : IEntityTypeConfiguration<BranchInstructionResult>
{
    public void Configure(EntityTypeBuilder<BranchInstructionResult> b)
    {
        b.ToTable("BranchInstructionResults");
        b.HasKey(x => x.Id);
        b.Property(x => x.Status).HasMaxLength(20).IsRequired();
        b.Property(x => x.Message).HasMaxLength(500);
        b.HasIndex(x => x.BranchId);
    }
}

internal sealed class RelayedOrderConfiguration : IEntityTypeConfiguration<RelayedOrder>
{
    public void Configure(EntityTypeBuilder<RelayedOrder> b)
    {
        b.ToTable("RelayedOrders");
        b.HasKey(x => x.Id);
        b.Property(x => x.Kind).HasMaxLength(30).IsRequired();
        b.Property(x => x.Payload).IsRequired();
        b.Property(x => x.ExternalRef).HasMaxLength(200);
        b.HasIndex(x => new { x.BranchId, x.ReceivedAt });
        b.HasIndex(x => x.ExternalRef);
    }
}

internal sealed class RelayedOrderResultConfiguration : IEntityTypeConfiguration<RelayedOrderResult>
{
    public void Configure(EntityTypeBuilder<RelayedOrderResult> b)
    {
        b.ToTable("RelayedOrderResults");
        b.HasKey(x => x.Id);
        b.Property(x => x.Status).HasMaxLength(20).IsRequired();
        b.Property(x => x.OrderNumber).HasMaxLength(50);
        b.Property(x => x.Message).HasMaxLength(500);
        b.HasIndex(x => x.BranchId);
    }
}

internal sealed class PlatformActionRequestConfiguration : IEntityTypeConfiguration<PlatformActionRequest>
{
    public void Configure(EntityTypeBuilder<PlatformActionRequest> b)
    {
        b.ToTable("PlatformActionRequests");
        b.HasKey(x => x.Id);
        b.Property(x => x.Action).HasMaxLength(20).IsRequired();
        b.Property(x => x.Reason).HasMaxLength(60);
        b.Property(x => x.Message).HasMaxLength(500);
        b.HasIndex(x => new { x.BranchId, x.RequestedAt });
        b.HasIndex(x => x.OrderId);
    }
}

internal sealed class PlatformActionResultConfiguration : IEntityTypeConfiguration<PlatformActionResult>
{
    public void Configure(EntityTypeBuilder<PlatformActionResult> b)
    {
        b.ToTable("PlatformActionResults");
        b.HasKey(x => x.Id);
        b.Property(x => x.Status).HasMaxLength(20).IsRequired();
        b.Property(x => x.Message).HasMaxLength(500);
        b.HasIndex(x => x.BranchId);
    }
}
