using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Identity.Domain.Entities;

namespace Softaxis.Identity.Infrastructure.Persistence.Configurations;

public sealed class UserRoleConfiguration : IEntityTypeConfiguration<UserRole>
{
    public void Configure(EntityTypeBuilder<UserRole> builder)
    {
        builder.ToTable("user_roles");
        builder.HasKey(ur => new { ur.UserId, ur.RoleId });
        builder.Property(ur => ur.AssignedBy).HasMaxLength(100).HasDefaultValue("system");
    }
}

public sealed class RolePermissionConfiguration : IEntityTypeConfiguration<RolePermission>
{
    public void Configure(EntityTypeBuilder<RolePermission> builder)
    {
        builder.ToTable("role_permissions");
        builder.HasKey(rp => new { rp.RoleId, rp.PermissionId });

        builder.HasOne(rp => rp.Permission)
            .WithMany()
            .HasForeignKey(rp => rp.PermissionId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class UserPermissionConfiguration : IEntityTypeConfiguration<UserPermission>
{
    public void Configure(EntityTypeBuilder<UserPermission> builder)
    {
        builder.ToTable("user_permissions");
        builder.HasKey(up => new { up.UserId, up.PermissionId });
        builder.Property(up => up.AssignedBy).HasMaxLength(100).HasDefaultValue("system");

        builder.HasOne(up => up.User)
            .WithMany(u => u.UserPermissions)
            .HasForeignKey(up => up.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(up => up.Permission)
            .WithMany()
            .HasForeignKey(up => up.PermissionId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
