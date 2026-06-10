using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.HR.Domain.Entities;

namespace Softaxis.HR.Infrastructure.Persistence.Configurations;

internal sealed class ApplicantConfiguration : IEntityTypeConfiguration<Applicant>
{
    public void Configure(EntityTypeBuilder<Applicant> builder)
    {
        builder.ToTable("applicants");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.JobTitle).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Name).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Email).IsRequired().HasMaxLength(320);
        builder.Property(x => x.Phone).HasMaxLength(50);
        builder.Property(x => x.Nationality).HasMaxLength(100);
        builder.Property(x => x.CurrentRole).HasMaxLength(200);
        builder.Property(x => x.CurrentCompany).HasMaxLength(200);
        builder.Property(x => x.Stage).IsRequired().HasMaxLength(20).HasDefaultValue("applied");
        builder.Property(x => x.AppliedDate).IsRequired().HasMaxLength(10);
        builder.Property(x => x.Notes).HasMaxLength(2000);
        builder.Property(x => x.Source).HasMaxLength(100);
        builder.Property(x => x.CreatedAt).IsRequired();
        builder.Property(x => x.IsDeleted).IsRequired().HasDefaultValue(false);

        builder.HasQueryFilter(x => !x.IsDeleted);

        builder.HasIndex(x => x.JobPostingId);
        builder.HasIndex(x => x.Stage);

        builder.HasOne(x => x.JobPosting)
               .WithMany()
               .HasForeignKey(x => x.JobPostingId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}
