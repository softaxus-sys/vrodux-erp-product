using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.ProjectManagement.Domain.Entities;

namespace Softaxis.ProjectManagement.Infrastructure.Persistence.Configurations;

internal sealed class SprintConfiguration : IEntityTypeConfiguration<Sprint>
{
    public void Configure(EntityTypeBuilder<Sprint> builder)
    {
        builder.ToTable("sprints");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.Name).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Goal).HasMaxLength(2000);
        builder.Property(x => x.StartDate).HasMaxLength(20);
        builder.Property(x => x.EndDate).HasMaxLength(20);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20).HasDefaultValue("planned");
        builder.Property(x => x.SortOrder).IsRequired().HasDefaultValue(0);
        builder.Property(x => x.CreatedAt).IsRequired();
        builder.Property(x => x.IsDeleted).IsRequired().HasDefaultValue(false);

        builder.HasQueryFilter(x => !x.IsDeleted);

        builder.HasIndex(x => x.ProjectId);

        builder.HasOne(x => x.Project)
               .WithMany(x => x.Sprints)
               .HasForeignKey(x => x.ProjectId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}
