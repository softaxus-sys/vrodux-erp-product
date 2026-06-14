using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Finance.Domain.Entities;

namespace Softaxis.Finance.Infrastructure.Persistence.Configurations;

internal sealed class ReceiptVoucherConfiguration : IEntityTypeConfiguration<ReceiptVoucher>
{
    public void Configure(EntityTypeBuilder<ReceiptVoucher> builder)
    {
        builder.ToTable("receipt_vouchers");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.VoucherNumber).IsRequired().HasMaxLength(50);
        builder.Property(x => x.CustomerName).IsRequired().HasMaxLength(200);
        builder.Property(x => x.ReceiptDate).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Amount).HasPrecision(18, 2);
        builder.Property(x => x.ReceiptMethod).HasMaxLength(30);
        builder.Property(x => x.Reference).HasMaxLength(100);
        builder.Property(x => x.Notes).HasMaxLength(1000);
        builder.Property(x => x.CurrencyCode).IsRequired().HasMaxLength(3).HasDefaultValue("AED");
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20).HasDefaultValue("draft");
        builder.Property(x => x.CreatedAt).IsRequired();
        builder.Property(x => x.IsDeleted).IsRequired().HasDefaultValue(false);

        builder.Ignore(x => x.AllocatedTotal);

        builder.HasQueryFilter(x => !x.IsDeleted);

        builder.HasIndex(x => x.VoucherNumber).IsUnique();
        builder.HasIndex(x => x.Status);
        builder.HasIndex(x => x.CustomerId);

        builder.HasMany(x => x.Allocations)
               .WithOne(x => x.ReceiptVoucher)
               .HasForeignKey(x => x.ReceiptVoucherId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<Customer>()
               .WithMany()
               .HasForeignKey(x => x.CustomerId)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<Account>()
               .WithMany()
               .HasForeignKey(x => x.BankAccountId)
               .OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class ReceiptAllocationConfiguration : IEntityTypeConfiguration<ReceiptAllocation>
{
    public void Configure(EntityTypeBuilder<ReceiptAllocation> builder)
    {
        builder.ToTable("receipt_allocations");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.AmountApplied).HasPrecision(18, 2);

        builder.HasIndex(x => x.ReceiptVoucherId);
        builder.HasIndex(x => x.InvoiceId);

        builder.HasOne(x => x.Invoice)
               .WithMany()
               .HasForeignKey(x => x.InvoiceId)
               .OnDelete(DeleteBehavior.Restrict);
    }
}
