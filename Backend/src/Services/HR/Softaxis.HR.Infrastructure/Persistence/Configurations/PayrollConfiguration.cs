using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.HR.Domain.Entities;

namespace Softaxis.HR.Infrastructure.Persistence.Configurations;

internal sealed class PayrollRunConfiguration : IEntityTypeConfiguration<PayrollRun>
{
    public void Configure(EntityTypeBuilder<PayrollRun> builder)
    {
        builder.ToTable("payroll_runs");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.RunNumber).IsRequired().HasMaxLength(50);
        builder.Property(x => x.Period).IsRequired().HasMaxLength(10);
        builder.Property(x => x.TotalBasicSalary).HasPrecision(18, 2);
        builder.Property(x => x.TotalAllowances).HasPrecision(18, 2);
        builder.Property(x => x.TotalDeductions).HasPrecision(18, 2);
        builder.Property(x => x.TotalNetSalary).HasPrecision(18, 2);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(30).HasDefaultValue("draft");
        builder.Property(x => x.Notes).HasMaxLength(1000);
        builder.Property(x => x.CreatedByUserId).HasMaxLength(100);
        builder.Property(x => x.CreatedByName).HasMaxLength(200);
        builder.Property(x => x.RejectionReason).HasMaxLength(1000);
        builder.Property(x => x.RejectedByName).HasMaxLength(200);
        builder.Property(x => x.CreatedAt).IsRequired();
        builder.Property(x => x.IsDeleted).IsRequired().HasDefaultValue(false);

        builder.HasQueryFilter(x => !x.IsDeleted);

        // Unique per tenant, live rows only — declared in HrDbContext (needs the TenantId shadow column).
        builder.HasIndex(x => x.Period);
        builder.HasIndex(x => x.Status);

        builder.HasMany(x => x.Slips)
               .WithOne(x => x.PayrollRun)
               .HasForeignKey(x => x.PayrollRunId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class PayrollSlipConfiguration : IEntityTypeConfiguration<PayrollSlip>
{
    public void Configure(EntityTypeBuilder<PayrollSlip> builder)
    {
        builder.ToTable("payroll_slips");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.EmployeeName).IsRequired().HasMaxLength(200);
        builder.Property(x => x.JobTitle).HasMaxLength(150);
        builder.Property(x => x.DepartmentName).HasMaxLength(200);
        builder.Property(x => x.BasicSalary).HasPrecision(18, 2);
        builder.Property(x => x.Allowances).HasPrecision(18, 2);
        builder.Property(x => x.Deductions).HasPrecision(18, 2);
        builder.Property(x => x.NetSalary).HasPrecision(18, 2);
        builder.Property(x => x.Notes).HasMaxLength(500);
        builder.Property(x => x.EmailSentAt);
        builder.Property(x => x.EmailSentTo).HasMaxLength(320);

        builder.HasIndex(x => x.PayrollRunId);
        builder.HasIndex(x => x.EmployeeId);
        // One slip per employee per payroll run
        builder.HasIndex(x => new { x.PayrollRunId, x.EmployeeId }).IsUnique();
    }
}
