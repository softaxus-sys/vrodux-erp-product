using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Finance.Domain.Entities;

namespace Softaxis.Finance.Infrastructure.Persistence.Configurations;

internal sealed class RecurringExpenseConfiguration : IEntityTypeConfiguration<RecurringExpense>
{
    public void Configure(EntityTypeBuilder<RecurringExpense> b)
    {
        b.ToTable("recurring_expenses");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).ValueGeneratedNever();

        b.Property(x => x.TemplateName).IsRequired().HasMaxLength(150);
        b.Property(x => x.Category).IsRequired().HasMaxLength(50);
        b.Property(x => x.Amount).HasPrecision(18, 2);
        b.Property(x => x.Vendor).HasMaxLength(200);
        b.Property(x => x.PaymentMethod).IsRequired().HasMaxLength(30);
        b.Property(x => x.Frequency).IsRequired().HasMaxLength(20);
        b.Property(x => x.Reference).HasMaxLength(100);
        b.Property(x => x.Notes).HasMaxLength(1000);

        b.HasQueryFilter(x => !x.IsDeleted);
        b.HasIndex(x => new { x.IsActive, x.NextRunDate });
    }
}
