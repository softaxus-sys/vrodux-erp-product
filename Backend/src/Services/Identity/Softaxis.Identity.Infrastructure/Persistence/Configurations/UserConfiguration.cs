using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Identity.Domain.Entities;

namespace Softaxis.Identity.Infrastructure.Persistence.Configurations;

public sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("users");

        builder.HasKey(u => u.Id);
        builder.Property(u => u.Id).ValueGeneratedNever();

        // Email value object — stored as a simple string column
        builder.Property(u => u.Email)
            .HasConversion(e => e.Value, v => Domain.ValueObjects.Email.Create(v).Value)
            .HasColumnName("email")
            .HasMaxLength(254)
            .IsRequired();

        builder.HasIndex(u => u.Email).IsUnique();
        builder.HasIndex(u => u.Username).IsUnique();

        builder.Property(u => u.Username).HasMaxLength(50).IsRequired();
        builder.Property(u => u.FirstName).HasMaxLength(100).IsRequired();
        builder.Property(u => u.LastName).HasMaxLength(100).IsRequired();
        builder.Property(u => u.PasswordHash).HasMaxLength(500).IsRequired();
        builder.Property(u => u.AvatarUrl).HasMaxLength(500);
        builder.Property(u => u.PhoneNumber).HasMaxLength(20);
        builder.Property(u => u.CreatedBy).HasMaxLength(100).HasDefaultValue("system");
        builder.Property(u => u.UpdatedBy).HasMaxLength(100);
        builder.Property(u => u.DeletedBy).HasMaxLength(100);
        builder.Property(u => u.Status).HasConversion<string>().HasMaxLength(30);

        builder.Property(u => u.TenantId).IsRequired(false);
        builder.Property(u => u.IsSuperAdmin).HasDefaultValue(false);

        // Optional FK to tenant — super-admin users have TenantId = null
        builder.HasOne<Tenant>()
               .WithMany()
               .HasForeignKey(u => u.TenantId)
               .IsRequired(false)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(u => u.UserRoles)
            .WithOne(ur => ur.User)
            .HasForeignKey(ur => ur.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
