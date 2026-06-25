using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.ProjectManagement.Domain.Entities;

namespace Softaxis.ProjectManagement.Infrastructure.Persistence.Configurations;

internal sealed class ProjectMemberConfiguration : IEntityTypeConfiguration<ProjectMember>
{
    public void Configure(EntityTypeBuilder<ProjectMember> builder)
    {
        builder.ToTable("project_members");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.UserId).IsRequired();
        builder.Property(x => x.UserName).IsRequired().HasMaxLength(200);
        builder.Property(x => x.UserEmail).HasMaxLength(320);
        builder.Property(x => x.Role).IsRequired().HasMaxLength(20).HasDefaultValue("member");
        builder.Property(x => x.CreatedAt).IsRequired();

        builder.HasIndex(x => new { x.ProjectId, x.UserId }).IsUnique();
        builder.HasIndex(x => x.UserId);
    }
}
