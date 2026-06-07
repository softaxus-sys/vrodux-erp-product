using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Sales.Domain.Entities;

namespace Softaxis.Sales.Infrastructure.Persistence.Configurations;

internal sealed class SalesReturnConfiguration : IEntityTypeConfiguration<SalesReturn>
{
    public void Configure(EntityTypeBuilder<SalesReturn> builder)
    {
        builder.ToTable("sales_returns");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.ReturnNumber).IsRequired().HasMaxLength(50);
        builder.Property(x => x.OrderId).IsRequired().HasMaxLength(50);
        builder.Property(x => x.OrderNumber).IsRequired().HasMaxLength(50);
        builder.Property(x => x.CustomerId).IsRequired().HasMaxLength(50);
        builder.Property(x => x.CustomerName).IsRequired().HasMaxLength(200);
        builder.Property(x => x.RequestDate).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20).HasDefaultValue("pending");
        builder.Property(x => x.Reason).IsRequired().HasMaxLength(50);
        builder.Property(x => x.ReasonDetail).IsRequired().HasMaxLength(500);
        builder.Property(x => x.RefundAmount).HasPrecision(18, 2);
        builder.Property(x => x.Currency).HasMaxLength(10);
        builder.Property(x => x.CreditNote).HasMaxLength(50);
        builder.Property(x => x.ProcessedBy).HasMaxLength(200);
        builder.Property(x => x.ProcessedDate).HasMaxLength(20);
        builder.Property(x => x.RefundMethod).HasMaxLength(30);
        builder.Property(x => x.IsDeleted).HasDefaultValue(false);
        builder.HasMany(x => x.Items).WithOne(x => x.Return).HasForeignKey(x => x.ReturnId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class SalesReturnItemConfiguration : IEntityTypeConfiguration<SalesReturnItem>
{
    public void Configure(EntityTypeBuilder<SalesReturnItem> builder)
    {
        builder.ToTable("sales_return_items");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Description).IsRequired().HasMaxLength(500);
        builder.Property(x => x.Quantity).HasPrecision(18, 2);
        builder.Property(x => x.UnitPrice).HasPrecision(18, 2);
        builder.Ignore(x => x.Total);
    }
}
