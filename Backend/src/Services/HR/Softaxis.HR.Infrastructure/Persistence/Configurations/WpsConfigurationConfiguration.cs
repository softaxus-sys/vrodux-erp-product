using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.HR.Domain.Entities;

namespace Softaxis.HR.Infrastructure.Persistence.Configurations;

internal sealed class WpsConfigurationConfiguration : IEntityTypeConfiguration<WpsConfiguration>
{
    public void Configure(EntityTypeBuilder<WpsConfiguration> builder)
    {
        builder.ToTable("wps_configurations");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        // Stored as text, not numbers: these identifiers carry leading zeros.
        builder.Property(x => x.EmployerUniqueId).IsRequired().HasMaxLength(20);
        builder.Property(x => x.EmployerBankRoutingCode).IsRequired().HasMaxLength(20);
        builder.Property(x => x.FileSequence).IsRequired().HasDefaultValue(0);
        builder.Property(x => x.IsDeleted).IsRequired().HasDefaultValue(false);

        // No IsDeleted query filter: TenantIsolation.ApplyTenantId runs last in OnModelCreating
        // and REPLACES any entity filter, so handlers filter !IsDeleted by hand.
    }
}
