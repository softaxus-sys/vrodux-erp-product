using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.HR.Domain.Entities;

namespace Softaxis.HR.Infrastructure.Persistence.Configurations;

internal sealed class WorkScheduleConfiguration : IEntityTypeConfiguration<WorkSchedule>
{
    public void Configure(EntityTypeBuilder<WorkSchedule> builder)
    {
        builder.ToTable("work_schedules");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.Name).IsRequired().HasMaxLength(80);
        builder.Property(x => x.StartTime).IsRequired().HasMaxLength(5);
        builder.Property(x => x.EndTime).IsRequired().HasMaxLength(5);
        builder.Property(x => x.GraceMinutes).IsRequired().HasDefaultValue(0);
        builder.Property(x => x.WorkingDays).IsRequired().HasMaxLength(20);
        builder.Property(x => x.TimeZoneId).IsRequired().HasMaxLength(80);
        builder.Property(x => x.IsDefault).IsRequired().HasDefaultValue(true);
        builder.Property(x => x.IsActive).IsRequired().HasDefaultValue(true);
        builder.Property(x => x.IsDeleted).IsRequired().HasDefaultValue(false);

        builder.HasIndex(x => x.IsDefault);

        // No IsDeleted query filter: TenantIsolation.ApplyTenantId runs last in OnModelCreating
        // and REPLACES any entity filter, so handlers filter !IsDeleted by hand.
    }
}
