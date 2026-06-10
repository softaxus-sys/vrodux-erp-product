using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.HR.Domain.Entities;

namespace Softaxis.HR.Infrastructure.Persistence.Configurations;

internal sealed class JobPostingConfiguration : IEntityTypeConfiguration<JobPosting>
{
    public void Configure(EntityTypeBuilder<JobPosting> builder)
    {
        builder.ToTable("job_postings");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.Title).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Department).IsRequired().HasMaxLength(150);
        builder.Property(x => x.Branch).IsRequired().HasMaxLength(150);
        builder.Property(x => x.Type).IsRequired().HasMaxLength(30);
        builder.Property(x => x.ExperienceLevel).IsRequired().HasMaxLength(30);
        builder.Property(x => x.SalaryMin).HasPrecision(18, 2);
        builder.Property(x => x.SalaryMax).HasPrecision(18, 2);
        builder.Property(x => x.Currency).IsRequired().HasMaxLength(10);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20).HasDefaultValue("draft");
        builder.Property(x => x.PostedDate).IsRequired().HasMaxLength(10);
        builder.Property(x => x.ClosingDate).HasMaxLength(10);
        builder.Property(x => x.Description).IsRequired().HasMaxLength(4000);
        builder.Property(x => x.RequirementsText).HasMaxLength(4000);
        builder.Property(x => x.ResponsibilitiesText).HasMaxLength(4000);
        builder.Property(x => x.HiringManager).HasMaxLength(200);
        builder.Property(x => x.CreatedAt).IsRequired();
        builder.Property(x => x.IsDeleted).IsRequired().HasDefaultValue(false);

        builder.HasQueryFilter(x => !x.IsDeleted);

        builder.HasIndex(x => x.Status);
        builder.HasIndex(x => x.Department);
    }
}
