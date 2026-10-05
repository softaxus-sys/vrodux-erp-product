using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Restaurant.Domain.Entities;

namespace Softaxis.Restaurant.Infrastructure.Persistence.Configurations;

public sealed class MenuItemImageConfiguration : IEntityTypeConfiguration<MenuItemImage>
{
    public void Configure(EntityTypeBuilder<MenuItemImage> b)
    {
        b.ToTable("MenuItemImages");
        b.HasKey(x => x.Id);
        b.Property(x => x.ObjectKey).HasMaxLength(400);
        b.Property(x => x.ContentType).HasMaxLength(100).IsRequired();
        b.Property(x => x.FileName).HasMaxLength(260);
        b.HasIndex(x => x.MenuItemId);
    }
}
