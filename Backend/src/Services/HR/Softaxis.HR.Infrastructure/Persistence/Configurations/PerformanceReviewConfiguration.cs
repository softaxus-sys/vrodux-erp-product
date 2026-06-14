using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.HR.Domain.Entities;

namespace Softaxis.HR.Infrastructure.Persistence.Configurations;

internal sealed class PerformanceReviewConfiguration : IEntityTypeConfiguration<PerformanceReview>
{
    public void Configure(EntityTypeBuilder<PerformanceReview> builder)
    {
        builder.ToTable("performance_reviews");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.EmployeeName).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Department).HasMaxLength(150);
        builder.Property(x => x.Designation).HasMaxLength(150);
        builder.Property(x => x.ReviewPeriod).IsRequired().HasMaxLength(50);
        builder.Property(x => x.ReviewType).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20).HasDefaultValue("pending");
        builder.Property(x => x.ReviewedBy).IsRequired().HasMaxLength(200);
        builder.Property(x => x.DueDate).IsRequired().HasMaxLength(10);
        builder.Property(x => x.CompletedDate).HasMaxLength(10);
        builder.Property(x => x.Strengths).HasMaxLength(2000);
        builder.Property(x => x.Improvements).HasMaxLength(2000);
        builder.Property(x => x.CreatedAt).IsRequired();
        builder.Property(x => x.IsDeleted).IsRequired().HasDefaultValue(false);

        builder.HasQueryFilter(x => !x.IsDeleted);

        builder.HasIndex(x => x.EmployeeId);
        builder.HasIndex(x => x.Status);

        builder.HasMany(x => x.Goals)
               .WithOne(x => x.PerformanceReview)
               .HasForeignKey(x => x.PerformanceReviewId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class PerformanceGoalConfiguration : IEntityTypeConfiguration<PerformanceGoal>
{
    public void Configure(EntityTypeBuilder<PerformanceGoal> builder)
    {
        builder.ToTable("performance_goals");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.Title).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Target).IsRequired().HasMaxLength(500);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20).HasDefaultValue("on_track");
        builder.Property(x => x.DueDate).IsRequired().HasMaxLength(10);

        builder.HasIndex(x => x.PerformanceReviewId);
    }
}
