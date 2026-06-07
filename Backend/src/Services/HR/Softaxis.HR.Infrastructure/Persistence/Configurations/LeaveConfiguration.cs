using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.HR.Domain.Entities;

namespace Softaxis.HR.Infrastructure.Persistence.Configurations;

internal sealed class LeaveConfiguration : IEntityTypeConfiguration<Leave>
{
    public void Configure(EntityTypeBuilder<Leave> builder)
    {
        builder.ToTable("leaves");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.LeaveNumber).IsRequired().HasMaxLength(50);
        builder.Property(x => x.EmployeeName).IsRequired().HasMaxLength(200);
        builder.Property(x => x.LeaveType).IsRequired().HasMaxLength(30);
        builder.Property(x => x.StartDate).IsRequired().HasMaxLength(20);
        builder.Property(x => x.EndDate).IsRequired().HasMaxLength(20);
        builder.Property(x => x.TotalDays).HasPrecision(5, 1);
        builder.Property(x => x.Reason).HasMaxLength(1000);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(30).HasDefaultValue("pending");
        builder.Property(x => x.ApproverNotes).HasMaxLength(500);
        builder.Property(x => x.CreatedAt).IsRequired();
        builder.Property(x => x.IsDeleted).IsRequired().HasDefaultValue(false);

        builder.HasQueryFilter(x => !x.IsDeleted);

        builder.HasIndex(x => x.LeaveNumber).IsUnique();
        builder.HasIndex(x => x.Status);
        builder.HasIndex(x => x.EmployeeId);

        builder.HasOne(x => x.Employee)
               .WithMany(x => x.Leaves)
               .HasForeignKey(x => x.EmployeeId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}
