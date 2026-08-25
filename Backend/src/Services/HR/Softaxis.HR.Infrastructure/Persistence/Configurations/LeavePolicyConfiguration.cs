using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.HR.Domain.Entities;

namespace Softaxis.HR.Infrastructure.Persistence.Configurations;

internal sealed class LeavePolicyConfiguration : IEntityTypeConfiguration<LeavePolicy>
{
    public void Configure(EntityTypeBuilder<LeavePolicy> builder)
    {
        builder.ToTable("leave_policies");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.LeaveType).IsRequired().HasMaxLength(40);
        builder.Property(x => x.AnnualEntitlementDays).HasPrecision(6, 1);
        builder.Property(x => x.IsPaid).IsRequired().HasDefaultValue(true);
        builder.Property(x => x.Description).HasMaxLength(300);
        builder.Property(x => x.IsActive).IsRequired().HasDefaultValue(true);
        builder.Property(x => x.IsDeleted).IsRequired().HasDefaultValue(false);

        // Not unique: policies are per tenant, and the tenant column is a shadow property,
        // so uniqueness on LeaveType alone would collide across tenants.
        builder.HasIndex(x => x.LeaveType);

        // No IsDeleted query filter here: TenantIsolation.ApplyTenantId runs last in
        // OnModelCreating and REPLACES any entity filter, so handlers filter !IsDeleted manually.
    }
}
