using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Softaxis.BuildingBlocks.Application.Behaviors;
using Softaxis.ProjectManagement.Application;
using Softaxis.ProjectManagement.Domain.Entities;
using Softaxis.ProjectManagement.Infrastructure.Persistence;
using Softaxis.ProjectManagement.Infrastructure.Services;

namespace Softaxis.ProjectManagement.Infrastructure.Extensions;

public static class InfrastructureExtensions
{
    public static IServiceCollection AddProjectManagementInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddDbContext<ProjectManagementDbContext>(opts =>
            opts.UseSqlServer(
                configuration.GetConnectionString("ProjectManagementDb"),
                sql => sql.MigrationsAssembly(typeof(ProjectManagementDbContext).Assembly.FullName)));

        // ── MediatR — scan Application + Infrastructure for handlers ─────────
        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssemblies(
                typeof(AssemblyMarker).Assembly,            // Application
                typeof(ProjectManagementDbContext).Assembly); // Infrastructure

            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(LoggingBehavior<,>));
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
        });

        // ── FluentValidation — register all validators from Application ───────
        services.AddValidatorsFromAssembly(typeof(AssemblyMarker).Assembly);

        services.AddScoped<IProjectAccessGuard, ProjectAccessGuard>();

        return services;
    }

    public static async Task MigrateAndSeedProjectManagementAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ProjectManagementDbContext>();
        await db.Database.MigrateAsync();
        await RepairProjectMemberTenantIdsAsync(db);
        await BackfillProjectMembersAsync(db);
    }

    /// <summary>
    /// One-time repair for ProjectMember rows inserted before the backfill stamped the
    /// shadow TenantId column (StampTenantId is a no-op outside an HTTP request, so the
    /// very first backfill run left TenantId NULL, which the tenant query filter then
    /// excludes from every read). Idempotent: no-op once all rows have a TenantId.
    /// </summary>
    private static async Task RepairProjectMemberTenantIdsAsync(ProjectManagementDbContext db)
    {
        var orphanMembers = await db.ProjectMembers
            .IgnoreQueryFilters()
            .Where(m => EF.Property<Guid?>(m, "TenantId") == null)
            .ToListAsync();

        if (orphanMembers.Count == 0) return;

        var projectTenantIds = await db.Projects
            .IgnoreQueryFilters()
            .Select(p => new { p.Id, TenantId = EF.Property<Guid?>(p, "TenantId") })
            .ToDictionaryAsync(p => p.Id, p => p.TenantId);

        foreach (var member in orphanMembers)
        {
            if (projectTenantIds.TryGetValue(member.ProjectId, out var tenantId))
                db.Entry(member).Property("TenantId").CurrentValue = tenantId;
        }

        await db.SaveChangesAsync();
    }

    /// <summary>
    /// One-time, self-limiting backfill: any project with zero members gets every
    /// tenant user holding "project-management.projects.edit" added as an "owner"
    /// member. Runs every startup but is a no-op once every project has at least
    /// one member.
    /// </summary>
    private static async Task BackfillProjectMembersAsync(ProjectManagementDbContext db)
    {
        var orphanProjects = await db.Projects
            .Select(p => new { p.Id, TenantId = EF.Property<Guid?>(p, "TenantId") })
            .Where(p => !db.ProjectMembers.Any(m => m.ProjectId == p.Id))
            .ToListAsync();

        if (orphanProjects.Count == 0) return;

        var added = false;
        foreach (var tenantGroup in orphanProjects.GroupBy(p => p.TenantId))
        {
            object tenantParam = tenantGroup.Key.HasValue ? tenantGroup.Key.Value : DBNull.Value;
            var editors = await db.Database.SqlQueryRaw<EditorRow>(
                """
                SELECT DISTINCT u.Id AS UserId,
                       COALESCE(u.Username, u.email, 'Unknown') AS UserName,
                       u.email AS UserEmail
                FROM [identity].users u
                JOIN [identity].user_roles ur ON ur.UserId = u.Id
                JOIN [identity].role_permissions rp ON rp.RoleId = ur.RoleId
                JOIN [identity].permissions p ON p.Id = rp.PermissionId
                WHERE u.IsDeleted = 0
                  AND p.ModuleId = 'project-management.projects'
                  AND p.Action = 'edit'
                  AND (({0} IS NULL) OR u.TenantId = {0})
                """, tenantParam).ToListAsync();

            foreach (var project in tenantGroup)
            {
                foreach (var editor in editors)
                {
                    var member = new ProjectMember(
                        project.Id, editor.UserId, editor.UserName, editor.UserEmail, "owner");
                    db.ProjectMembers.Add(member);
                    // StampTenantId only fires when TenantAmbient is resolved (HTTP request
                    // context); this seed step runs at startup with no ambient tenant, so
                    // stamp the shadow column directly from the project's own TenantId.
                    db.Entry(member).Property("TenantId").CurrentValue = project.TenantId;
                    added = true;
                }
            }
        }

        if (added) await db.SaveChangesAsync();
    }

    private sealed class EditorRow
    {
        public Guid UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string? UserEmail { get; set; }
    }
}
