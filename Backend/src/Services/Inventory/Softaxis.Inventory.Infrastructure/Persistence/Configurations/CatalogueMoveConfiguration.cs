using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Inventory.Domain.Entities;

namespace Softaxis.Inventory.Infrastructure.Persistence.Configurations;

internal sealed class CatalogueMoveConfiguration : IEntityTypeConfiguration<CatalogueMove>
{
    public void Configure(EntityTypeBuilder<CatalogueMove> b)
    {
        b.ToTable("catalogue_moves");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.MovedBy).IsRequired().HasMaxLength(200);
        b.Property(x => x.Report);   // nvarchar(max)
    }
}
