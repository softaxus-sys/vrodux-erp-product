using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Finance.Domain.Entities;

namespace Softaxis.Finance.Infrastructure.Persistence.Configurations;

internal sealed class BudgetConfiguration : IEntityTypeConfiguration<Budget>
{
    public void Configure(EntityTypeBuilder<Budget> builder)
    {
        builder.ToTable("budgets");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.Name).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Period).IsRequired().HasMaxLength(10);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20).HasDefaultValue("active");
        builder.Property(x => x.Notes).HasMaxLength(1000);
        builder.Property(x => x.CreatedAt).IsRequired();
        builder.Property(x => x.IsDeleted).IsRequired().HasDefaultValue(false);

        // Computed — not mapped
        builder.Ignore(x => x.TotalBudgeted);
        builder.Ignore(x => x.TotalActual);
        builder.Ignore(x => x.Variance);

        builder.HasQueryFilter(x => !x.IsDeleted);

        builder.HasIndex(x => x.Period);
        builder.HasIndex(x => x.Status);

        builder.HasMany(x => x.Lines)
               .WithOne(x => x.Budget)
               .HasForeignKey(x => x.BudgetId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class BudgetLineConfiguration : IEntityTypeConfiguration<BudgetLine>
{
    public void Configure(EntityTypeBuilder<BudgetLine> builder)
    {
        builder.ToTable("budget_lines");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.Category).IsRequired().HasMaxLength(100);
        builder.Property(x => x.AccountName).HasMaxLength(200);
        builder.Property(x => x.BudgetedAmount).HasPrecision(18, 2);
        builder.Property(x => x.ActualAmount).HasPrecision(18, 2);

        // Computed — not mapped
        builder.Ignore(x => x.Variance);

        builder.HasIndex(x => x.BudgetId);
    }
}
