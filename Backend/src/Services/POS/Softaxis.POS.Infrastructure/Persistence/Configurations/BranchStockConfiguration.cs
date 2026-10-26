using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.POS.Domain.Entities;

namespace Softaxis.POS.Infrastructure.Persistence.Configurations;

public sealed class BranchStockConfiguration : IEntityTypeConfiguration<BranchStock>
{
    public void Configure(EntityTypeBuilder<BranchStock> builder)
    {
        builder.ToTable("branch_stock");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.StockQuantity).HasPrecision(18, 3);
        builder.HasIndex(x => x.BranchId);
        builder.HasIndex(x => x.ProductId);
    }
}
