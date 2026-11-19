using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.Workflow.Domain.Entities;

namespace Softaxis.Workflow.Infrastructure.Persistence;

public sealed class WorkflowDbContext(DbContextOptions<WorkflowDbContext> options)
    : DbContext(options), ITenantAmbientContext
{
    public DbSet<WfSettings>       Settings    => Set<WfSettings>();
    public DbSet<WfBase>           Bases       => Set<WfBase>();
    public DbSet<WfUnit>           Units       => Set<WfUnit>();
    public DbSet<WfPosition>       Positions   => Set<WfPosition>();
    public DbSet<WfPositionHolder> Holders     => Set<WfPositionHolder>();
    public DbSet<WfBaseAccess>     BaseAccess  => Set<WfBaseAccess>();
    public DbSet<WfForm>           Forms       => Set<WfForm>();
    public DbSet<WfFlow>           Flows       => Set<WfFlow>();
    public DbSet<WfFlowStep>       FlowSteps   => Set<WfFlowStep>();
    public DbSet<WfRequest>        Requests    => Set<WfRequest>();
    public DbSet<WfRequestStep>    Steps       => Set<WfRequestStep>();
    public DbSet<WfStepAssignee>   Assignees   => Set<WfStepAssignee>();
    public DbSet<WfAttachment>     Attachments => Set<WfAttachment>();
    public DbSet<WfComment>        Comments    => Set<WfComment>();
    public DbSet<WfAudit>          Audit       => Set<WfAudit>();
    public DbSet<WfDocType>        DocTypes    => Set<WfDocType>();
    public DbSet<WfRepoDocument>   RepoDocs    => Set<WfRepoDocument>();
    public DbSet<WfEmployee>       Employees   => Set<WfEmployee>();

    // Free-text columns that must not be capped at the default length.
    private static readonly HashSet<string> Unbounded =
        ["FieldsJson", "DataJson", "Detail", "Comment", "Text", "Notes", "Description", "FinalReason", "SkipReason"];

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("workflow");

        foreach (var entity in modelBuilder.Model.GetEntityTypes())
        {
            // Ids are set in the constructors; EF must never think a new child row already exists.
            entity.FindProperty("Id")?.ValueGenerated = Microsoft.EntityFrameworkCore.Metadata.ValueGenerated.Never;
            foreach (var p in entity.GetProperties())
            {
                if (p.ClrType == typeof(decimal) || p.ClrType == typeof(decimal?)) { p.SetPrecision(18); p.SetScale(2); }
                if (p.ClrType != typeof(string)) continue;
                if (Unbounded.Contains(p.Name)) continue;
                p.SetMaxLength(p.Name is "Email" or "UserName" ? 320 : 300);
            }
        }

        modelBuilder.Entity<WfRequest>().Property(r => r.RowVersion).IsRowVersion();
        modelBuilder.Entity<WfRequest>().HasMany(r => r.Steps).WithOne().HasForeignKey(s => s.RequestId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<WfRequestStep>().HasMany(s => s.Assignees).WithOne().HasForeignKey(a => a.StepId).OnDelete(DeleteBehavior.Cascade);

        // Shadow TenantId + query filter on every table. This replaces any entity-level soft-delete
        // filter, so handlers apply !IsDeleted themselves.
        TenantIsolation.ApplyTenantId(modelBuilder, this, "Softaxis.Workflow.Domain");

        TenantIsolation.TenantUniqueIndex<WfSettings>(modelBuilder, [], excludeSoftDeleted: false);
        TenantIsolation.TenantUniqueIndex<WfBase>(modelBuilder, [nameof(WfBase.Code)]);
        TenantIsolation.TenantUniqueIndex<WfPosition>(modelBuilder, [nameof(WfPosition.Name)]);
        TenantIsolation.TenantUniqueIndex<WfForm>(modelBuilder, [nameof(WfForm.Key)]);
        TenantIsolation.TenantUniqueIndex<WfRequest>(modelBuilder, [nameof(WfRequest.Number)]);

        modelBuilder.Entity<WfRequest>().HasIndex(r => new { r.Status, r.BaseId });
        modelBuilder.Entity<WfRequest>().HasIndex(r => r.RequesterId);
        modelBuilder.Entity<WfRequest>().HasIndex(r => r.FormId);
        modelBuilder.Entity<WfRequestStep>().HasIndex(s => new { s.RequestId, s.Order });
        modelBuilder.Entity<WfStepAssignee>().HasIndex(a => a.UserId);
        modelBuilder.Entity<WfStepAssignee>().HasIndex(a => a.RequestId);
        modelBuilder.Entity<WfPositionHolder>().HasIndex(h => new { h.PositionId, h.BaseId, h.UnitId });
        modelBuilder.Entity<WfPositionHolder>().HasIndex(h => h.UserId);
        modelBuilder.Entity<WfBaseAccess>().HasIndex(a => new { a.BaseId, a.UserId });
        modelBuilder.Entity<WfBaseAccess>().HasIndex(a => a.UserId);
        modelBuilder.Entity<WfFlow>().HasIndex(f => new { f.FormId, f.BaseId, f.UnitId });
        modelBuilder.Entity<WfFlowStep>().HasIndex(s => new { s.FlowId, s.Order });
        modelBuilder.Entity<WfAudit>().HasIndex(a => a.At);
        modelBuilder.Entity<WfAudit>().HasIndex(a => a.RequestId);
        modelBuilder.Entity<WfAudit>().HasIndex(a => a.UserId);
        modelBuilder.Entity<WfComment>().HasIndex(c => c.RequestId);
        modelBuilder.Entity<WfAttachment>().HasIndex(a => a.RequestId);
        modelBuilder.Entity<WfRepoDocument>().HasIndex(d => new { d.BaseId, d.DocTypeId, d.PeriodDate });
        modelBuilder.Entity<WfEmployee>().HasIndex(e => e.Email);

        base.OnModelCreating(modelBuilder);
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        TenantIsolation.StampTenantId(ChangeTracker);
        return base.SaveChangesAsync(cancellationToken);
    }
}
