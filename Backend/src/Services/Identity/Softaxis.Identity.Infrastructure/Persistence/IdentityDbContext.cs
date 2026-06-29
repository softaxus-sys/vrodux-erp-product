using MediatR;
using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.Identity.Application.Seed;
using Softaxis.Identity.Domain.Entities;

namespace Softaxis.Identity.Infrastructure.Persistence;

public sealed class IdentityDbContext(DbContextOptions<IdentityDbContext> options, IMediator mediator)
    : BaseDbContext(options, mediator)
{
    public DbSet<User>           Users           => Set<User>();
    public DbSet<Role>           Roles           => Set<Role>();
    public DbSet<Permission>     Permissions     => Set<Permission>();
    public DbSet<UserRole>       UserRoles       => Set<UserRole>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<UserPermission> UserPermissions => Set<UserPermission>();
    public DbSet<RefreshToken>   RefreshTokens   => Set<RefreshToken>();
    public DbSet<AuditLog>       AuditLogs       => Set<AuditLog>();
    public DbSet<Branch>         Branches        => Set<Branch>();
    public DbSet<AppSetting>     AppSettings     => Set<AppSetting>();
    public DbSet<Tenant>         Tenants         => Set<Tenant>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("identity");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(IdentityDbContext).Assembly);

        // Global soft-delete filter
        modelBuilder.Entity<User>().HasQueryFilter(u => !u.IsDeleted);
        modelBuilder.Entity<Role>().HasQueryFilter(r => !r.IsDeleted);

        // Seed permissions
        var permissions = PermissionSeedData.GetPermissions();
        modelBuilder.Entity<Permission>().HasData(permissions);

        base.OnModelCreating(modelBuilder);
    }
}
