using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Inventory.Domain.Entities;

namespace Softaxis.Inventory.Infrastructure.Persistence.Configurations;

internal sealed class ProductTemplateConfiguration : IEntityTypeConfiguration<ProductTemplate>
{
    public void Configure(EntityTypeBuilder<ProductTemplate> b)
    {
        b.ToTable("product_templates");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).ValueGeneratedNever();

        b.Property(x => x.Name).IsRequired().HasMaxLength(200);
        b.Property(x => x.Description);                       // nvarchar(max): a product page can be long
        b.Property(x => x.ShortDescription).HasMaxLength(500);
        b.Property(x => x.Slug).IsRequired().HasMaxLength(160);
        b.Property(x => x.SeoTitle).HasMaxLength(200);
        b.Property(x => x.MetaDescription).HasMaxLength(320);
        b.Property(x => x.Tags).HasMaxLength(500);
        b.Property(x => x.OptionsJson).HasMaxLength(4000);
        b.Property(x => x.IsActive).IsRequired();
        b.Property(x => x.IsDeleted).IsRequired().HasDefaultValue(false);
        b.Ignore(x => x.Options);

        b.HasQueryFilter(x => !x.IsDeleted);
        b.HasIndex(x => x.CategoryId);
        b.HasIndex(x => x.PublishedOnline);
        // The slug is unique per workspace among live rows — declared in InventoryDbContext (needs TenantId).

        b.HasOne(x => x.Category).WithMany().HasForeignKey(x => x.CategoryId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Brand).WithMany().HasForeignKey(x => x.BrandId).OnDelete(DeleteBehavior.SetNull);

        b.HasMany(x => x.Variants).WithOne(x => x.Template).HasForeignKey(x => x.TemplateId)
         .OnDelete(DeleteBehavior.SetNull);                   // deleting a listing never deletes a product
        b.HasMany(x => x.Images).WithOne().HasForeignKey(x => x.TemplateId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class ProductImageConfiguration : IEntityTypeConfiguration<ProductImage>
{
    public void Configure(EntityTypeBuilder<ProductImage> b)
    {
        b.ToTable("product_images");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).ValueGeneratedNever();

        b.Property(x => x.ObjectKey).HasMaxLength(400);
        b.Property(x => x.ContentType).IsRequired().HasMaxLength(100);
        b.Property(x => x.FileName).HasMaxLength(260);
        b.Property(x => x.AltText).HasMaxLength(300);
        b.Property(x => x.IsDeleted).IsRequired().HasDefaultValue(false);

        b.HasQueryFilter(x => !x.IsDeleted);
        b.HasIndex(x => x.TemplateId);
        b.HasIndex(x => x.ProductId);
    }
}
