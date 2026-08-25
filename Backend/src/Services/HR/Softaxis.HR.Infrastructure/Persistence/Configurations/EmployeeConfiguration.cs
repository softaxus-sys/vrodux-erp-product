using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.HR.Domain.Entities;

namespace Softaxis.HR.Infrastructure.Persistence.Configurations;

internal sealed class EmployeeConfiguration : IEntityTypeConfiguration<Employee>
{
    public void Configure(EntityTypeBuilder<Employee> builder)
    {
        builder.ToTable("employees");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.EmployeeNumber).IsRequired().HasMaxLength(50);
        builder.Property(x => x.FirstName).IsRequired().HasMaxLength(100);
        builder.Property(x => x.LastName).IsRequired().HasMaxLength(100);
        builder.Property(x => x.Email).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Phone).HasMaxLength(30);
        builder.Property(x => x.JobTitle).HasMaxLength(150);
        builder.Property(x => x.DepartmentName).HasMaxLength(200);
        builder.Property(x => x.EmploymentType).IsRequired().HasMaxLength(30).HasDefaultValue("full-time");
        builder.Property(x => x.BasicSalary).HasPrecision(18, 2);
        builder.Property(x => x.JoiningDate).IsRequired().HasMaxLength(20);
        builder.Property(x => x.TerminationDate).HasMaxLength(20);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(30).HasDefaultValue("active");
        builder.Property(x => x.Notes).HasMaxLength(1000);
        // Data URI for the profile photo; the API caps uploads at 2 MB so nvarchar(max) is the right fit.
        builder.Property(x => x.AvatarData).HasColumnType("nvarchar(max)");
        builder.Property(x => x.Nationality).HasMaxLength(100);
        builder.Property(x => x.EmiratesId).HasMaxLength(30);
        builder.Property(x => x.PassportNumber).HasMaxLength(30);
        builder.Property(x => x.VisaExpiry).HasMaxLength(20);
        builder.Property(x => x.ReportingTo).HasMaxLength(200);
        builder.Property(x => x.BankAccount).HasMaxLength(120);
        builder.Property(x => x.Iban).HasMaxLength(40);
        builder.Property(x => x.LabourCardNumber).HasMaxLength(20);
        builder.Property(x => x.BankRoutingCode).HasMaxLength(20);
        builder.Property(x => x.MedicalInsurance).HasMaxLength(150);
        builder.Property(x => x.CreatedAt).IsRequired();
        builder.Property(x => x.IsDeleted).IsRequired().HasDefaultValue(false);

        // Computed property — not mapped
        builder.Ignore(x => x.FullName);

        builder.HasQueryFilter(x => !x.IsDeleted);

        // EmployeeNumber/Email uniqueness is declared in HrDbContext instead: it must be
        // scoped to (TenantId, …) and filtered on IsDeleted, and TenantId is a shadow
        // property that only exists after TenantIsolation.ApplyTenantId has run.
        builder.HasIndex(x => x.Status);
        builder.HasIndex(x => x.DepartmentId);

        builder.HasOne(x => x.Department)
               .WithMany(x => x.Employees)
               .HasForeignKey(x => x.DepartmentId)
               .OnDelete(DeleteBehavior.SetNull);

        builder.HasMany(x => x.Leaves)
               .WithOne(x => x.Employee)
               .HasForeignKey(x => x.EmployeeId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(x => x.AttendanceLogs)
               .WithOne(x => x.Employee)
               .HasForeignKey(x => x.EmployeeId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}
