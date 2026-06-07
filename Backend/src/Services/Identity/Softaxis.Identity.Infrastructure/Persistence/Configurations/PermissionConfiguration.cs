using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Identity.Domain.Entities;

namespace Softaxis.Identity.Infrastructure.Persistence.Configurations;

public sealed class PermissionConfiguration : IEntityTypeConfiguration<Permission>
{
    public void Configure(EntityTypeBuilder<Permission> builder)
    {
        builder.ToTable("permissions");
        builder.HasKey(p => p.Id);
        builder.Property(p => p.Id).ValueGeneratedNever();
        builder.Property(p => p.ModuleId).HasMaxLength(100).IsRequired();
        builder.Property(p => p.Action).HasMaxLength(50).IsRequired();
        builder.Property(p => p.Description).HasMaxLength(200);
        builder.HasIndex(p => new { p.ModuleId, p.Action }).IsUnique();

        // Ignore computed property Key — it's not persisted
        builder.Ignore(p => p.Key);
        builder.Ignore(p => p.RolePermissions);
    }
}
