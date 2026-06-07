using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Purchase.Domain.Entities;

namespace Softaxis.Purchase.Infrastructure.Persistence.Configurations;

internal sealed class PurchaseApprovalConfiguration : IEntityTypeConfiguration<PurchaseApproval>
{
    public void Configure(EntityTypeBuilder<PurchaseApproval> builder)
    {
        builder.ToTable("purchase_approvals");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.RequestNumber).IsRequired().HasMaxLength(50);
        builder.Property(x => x.Title).IsRequired().HasMaxLength(300);
        builder.Property(x => x.RequestedBy).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Department).IsRequired().HasMaxLength(100);
        builder.Property(x => x.RequestDate).IsRequired().HasMaxLength(20);
        builder.Property(x => x.RequiredBy).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20).HasDefaultValue("pending");
        builder.Property(x => x.Priority).IsRequired().HasMaxLength(20).HasDefaultValue("medium");
        builder.Property(x => x.Category).IsRequired().HasMaxLength(50);
        builder.Property(x => x.VendorSuggestion).HasMaxLength(200);
        builder.Property(x => x.TotalAmount).HasPrecision(18, 2);
        builder.Property(x => x.Currency).HasMaxLength(10);
        builder.Property(x => x.Justification).IsRequired().HasMaxLength(1000);
        builder.Property(x => x.ApprovedBy).HasMaxLength(200);
        builder.Property(x => x.ApprovedDate).HasMaxLength(20);
        builder.Property(x => x.RejectionReason).HasMaxLength(500);
        builder.Property(x => x.ConvertedToPO).HasMaxLength(50);
        builder.Property(x => x.IsDeleted).HasDefaultValue(false);
        builder.HasMany(x => x.Items).WithOne(x => x.Approval).HasForeignKey(x => x.ApprovalId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class PurchaseApprovalItemConfiguration : IEntityTypeConfiguration<PurchaseApprovalItem>
{
    public void Configure(EntityTypeBuilder<PurchaseApprovalItem> builder)
    {
        builder.ToTable("purchase_approval_items");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Description).IsRequired().HasMaxLength(500);
        builder.Property(x => x.Quantity).HasPrecision(18, 2);
        builder.Property(x => x.EstimatedUnitPrice).HasPrecision(18, 2);
        builder.Ignore(x => x.Total);
    }
}
