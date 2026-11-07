using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Inventory.Domain.Entities;

namespace Softaxis.Inventory.Infrastructure.Persistence.Configurations;

internal sealed class PendingProductPhotoConfiguration : IEntityTypeConfiguration<PendingProductPhoto>
{
    public void Configure(EntityTypeBuilder<PendingProductPhoto> b)
    {
        b.ToTable("pending_product_photos");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.Url).IsRequired().HasMaxLength(2000);
        b.Property(x => x.Status).IsRequired().HasMaxLength(10);
        b.Property(x => x.Error).HasMaxLength(300);
        b.HasIndex(x => new { x.Status, x.NextAttemptAt });
        b.HasIndex(x => x.ProductId);
    }
}
