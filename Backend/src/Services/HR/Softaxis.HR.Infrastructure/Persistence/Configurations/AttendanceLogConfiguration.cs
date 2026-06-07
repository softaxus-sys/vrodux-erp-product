using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.HR.Domain.Entities;

namespace Softaxis.HR.Infrastructure.Persistence.Configurations;

internal sealed class AttendanceLogConfiguration : IEntityTypeConfiguration<AttendanceLog>
{
    public void Configure(EntityTypeBuilder<AttendanceLog> builder)
    {
        builder.ToTable("attendance_logs");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.EmployeeName).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Date).IsRequired().HasMaxLength(20);
        builder.Property(x => x.CheckIn).HasMaxLength(10);
        builder.Property(x => x.CheckOut).HasMaxLength(10);
        builder.Property(x => x.WorkingHours).HasPrecision(5, 2);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(30);
        builder.Property(x => x.Notes).HasMaxLength(500);
        builder.Property(x => x.CreatedAt).IsRequired();

        // Unique constraint: one record per employee per date
        builder.HasIndex(x => new { x.EmployeeId, x.Date }).IsUnique();
        builder.HasIndex(x => x.Date);
        builder.HasIndex(x => x.Status);

        builder.HasOne(x => x.Employee)
               .WithMany(x => x.AttendanceLogs)
               .HasForeignKey(x => x.EmployeeId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}
