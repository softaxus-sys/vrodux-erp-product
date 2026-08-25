using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Finance.Domain.Entities;

namespace Softaxis.Finance.Infrastructure.Persistence.Configurations;

internal sealed class PaymentVoucherConfiguration : IEntityTypeConfiguration<PaymentVoucher>
{
    public void Configure(EntityTypeBuilder<PaymentVoucher> builder)
    {
        builder.ToTable("payment_vouchers");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.VoucherNumber).IsRequired().HasMaxLength(50);
        builder.Property(x => x.SupplierName).IsRequired().HasMaxLength(200);
        builder.Property(x => x.PaymentDate).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Amount).HasPrecision(18, 2);
        builder.Property(x => x.PaymentMethod).HasMaxLength(30);
        builder.Property(x => x.Reference).HasMaxLength(100);
        builder.Property(x => x.Notes).HasMaxLength(1000);
        builder.Property(x => x.CurrencyCode).IsRequired().HasMaxLength(3).HasDefaultValue("AED");
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20).HasDefaultValue("draft");
        builder.Property(x => x.CreatedAt).IsRequired();
        builder.Property(x => x.IsDeleted).IsRequired().HasDefaultValue(false);

        builder.Ignore(x => x.AllocatedTotal);

        builder.HasQueryFilter(x => !x.IsDeleted);

        // Unique per tenant, live rows only — declared in FinanceDbContext (needs the TenantId shadow column).
        builder.HasIndex(x => x.Status);
        builder.HasIndex(x => x.SupplierId);

        builder.HasMany(x => x.Allocations)
               .WithOne(x => x.PaymentVoucher)
               .HasForeignKey(x => x.PaymentVoucherId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<Supplier>()
               .WithMany()
               .HasForeignKey(x => x.SupplierId)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<Account>()
               .WithMany()
               .HasForeignKey(x => x.BankAccountId)
               .OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class PaymentAllocationConfiguration : IEntityTypeConfiguration<PaymentAllocation>
{
    public void Configure(EntityTypeBuilder<PaymentAllocation> builder)
    {
        builder.ToTable("payment_allocations");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.AmountApplied).HasPrecision(18, 2);

        builder.HasIndex(x => x.PaymentVoucherId);
        builder.HasIndex(x => x.BillId);

        builder.HasOne(x => x.Bill)
               .WithMany()
               .HasForeignKey(x => x.BillId)
               .OnDelete(DeleteBehavior.Restrict);
    }
}
