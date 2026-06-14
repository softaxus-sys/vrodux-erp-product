using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.ProjectManagement.Domain.Entities;

namespace Softaxis.ProjectManagement.Infrastructure.Persistence.Configurations;

internal sealed class IssueConfiguration : IEntityTypeConfiguration<Issue>
{
    public void Configure(EntityTypeBuilder<Issue> builder)
    {
        builder.ToTable("issues");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.IssueKey).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Title).IsRequired().HasMaxLength(500);
        builder.Property(x => x.Description).HasMaxLength(4000);
        builder.Property(x => x.Type).IsRequired().HasMaxLength(20).HasDefaultValue("task");
        builder.Property(x => x.Priority).IsRequired().HasMaxLength(20).HasDefaultValue("medium");
        builder.Property(x => x.AssigneeName).HasMaxLength(200);
        builder.Property(x => x.ReporterName).IsRequired().HasMaxLength(200);
        builder.Property(x => x.DueDate).HasMaxLength(20);
        builder.Property(x => x.StoryPoints).HasPrecision(6, 2);
        builder.Property(x => x.SortOrder).IsRequired().HasDefaultValue(0);
        builder.Property(x => x.CreatedAt).IsRequired();
        builder.Property(x => x.IsDeleted).IsRequired().HasDefaultValue(false);

        builder.HasQueryFilter(x => !x.IsDeleted);

        builder.HasIndex(x => new { x.ProjectId, x.IssueKey }).IsUnique();
        builder.HasIndex(x => x.BoardColumnId);
        builder.HasIndex(x => x.SprintId);
        builder.HasIndex(x => x.EpicId);

        builder.HasOne(x => x.Project)
               .WithMany(x => x.Issues)
               .HasForeignKey(x => x.ProjectId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.BoardColumn)
               .WithMany(x => x.Issues)
               .HasForeignKey(x => x.BoardColumnId)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(x => x.Sprint)
               .WithMany(x => x.Issues)
               .HasForeignKey(x => x.SprintId)
               .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(x => x.Epic)
               .WithMany()
               .HasForeignKey(x => x.EpicId)
               .OnDelete(DeleteBehavior.SetNull);

        builder.HasMany(x => x.IssueLabels)
               .WithOne(x => x.Issue!)
               .HasForeignKey(x => x.IssueId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(x => x.Comments)
               .WithOne(x => x.Issue!)
               .HasForeignKey(x => x.IssueId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class IssueLabelConfiguration : IEntityTypeConfiguration<IssueLabel>
{
    public void Configure(EntityTypeBuilder<IssueLabel> builder)
    {
        builder.ToTable("issue_labels");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.HasIndex(x => new { x.IssueId, x.LabelId }).IsUnique();

        builder.HasOne(x => x.Label)
               .WithMany(x => x.IssueLabels)
               .HasForeignKey(x => x.LabelId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class IssueCommentConfiguration : IEntityTypeConfiguration<IssueComment>
{
    public void Configure(EntityTypeBuilder<IssueComment> builder)
    {
        builder.ToTable("issue_comments");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.AuthorName).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Body).IsRequired().HasMaxLength(4000);
        builder.Property(x => x.CreatedAt).IsRequired();
        builder.Property(x => x.IsDeleted).IsRequired().HasDefaultValue(false);

        builder.HasQueryFilter(x => !x.IsDeleted);

        builder.HasIndex(x => x.IssueId);
    }
}
