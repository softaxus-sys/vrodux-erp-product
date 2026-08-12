using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Identity.Domain.Entities;

namespace Softaxis.Identity.Infrastructure.Persistence.Configurations;

public sealed class TenantConfiguration : IEntityTypeConfiguration<Tenant>
{
    public void Configure(EntityTypeBuilder<Tenant> builder)
    {
        builder.ToTable("tenants");
        builder.HasKey(t => t.Id);
        builder.Property(t => t.Id).ValueGeneratedNever();

        builder.Property(t => t.Name).HasMaxLength(200).IsRequired();
        builder.Property(t => t.Slug).HasMaxLength(100).IsRequired();
        // Filtered unique index: only live (non-soft-deleted) tenants are constrained,
        // so re-using the slug of a deleted tenant doesn't collide.
        builder.HasIndex(t => t.Slug).IsUnique().HasFilter("[IsDeleted] = 0");

        builder.Property(t => t.Plan)
               .HasConversion<string>()
               .HasMaxLength(30)
               .IsRequired();

        builder.Property(t => t.DeploymentType)
               .HasConversion<string>()
               .HasMaxLength(30)
               .IsRequired();

        builder.Property(t => t.Status)
               .HasConversion<string>()
               .HasMaxLength(30)
               .IsRequired();

        builder.Property(t => t.ContactEmail).HasMaxLength(254);
        builder.Property(t => t.ContactPhone).HasMaxLength(30);
        builder.Property(t => t.Country).HasMaxLength(100);
        builder.Property(t => t.PrimaryColor).HasMaxLength(20);
        builder.Property(t => t.Industry).HasMaxLength(50);

        // Pricing-page attribution captured at signup (?plan=&billing=&intent=&utm_source=).
        builder.Property(t => t.UtmSource).HasMaxLength(200);
        builder.Property(t => t.SignupIntent).HasMaxLength(20);
        builder.Property(t => t.SignupBillingPeriod)
               .HasConversion<string>()
               .HasMaxLength(20);

        builder.Property(t => t.LicenseKey).HasColumnType("nvarchar(max)");
        builder.Property(t => t.ConnectionStrings).HasColumnType("nvarchar(max)");
        builder.Property(t => t.EnabledModules).HasColumnType("nvarchar(max)");

        builder.Property(t => t.CreatedBy).HasMaxLength(100).HasDefaultValue("system");
        builder.Property(t => t.UpdatedBy).HasMaxLength(100);
        builder.Property(t => t.DeletedBy).HasMaxLength(100);

        builder.HasQueryFilter(t => !t.IsDeleted);
    }
}
