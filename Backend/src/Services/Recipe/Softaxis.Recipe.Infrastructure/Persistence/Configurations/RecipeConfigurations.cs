using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Recipe.Domain.Entities;

namespace Softaxis.Recipe.Infrastructure.Persistence.Configurations;

public sealed class RecipeConfigurations :
    IEntityTypeConfiguration<Recipe.Domain.Entities.Recipe>,
    IEntityTypeConfiguration<RecipeIngredient>
{
    public void Configure(EntityTypeBuilder<Recipe.Domain.Entities.Recipe> b)
    {
        b.ToTable("Recipes");
        b.HasKey(x => x.Id);
        b.Ignore(x => x.CostPerServing);
        b.Property(x => x.RecipeNumber).HasMaxLength(50).IsRequired();
        b.Property(x => x.MenuItemName).HasMaxLength(200).IsRequired();
        b.Property(x => x.Description).HasMaxLength(1000);
        b.Property(x => x.Status).HasMaxLength(30).IsRequired();
        b.Property(x => x.Instructions).HasMaxLength(4000);
        b.Property(x => x.Notes).HasMaxLength(1000);
        b.HasMany(x => x.Ingredients).WithOne()
            .HasForeignKey(i => i.RecipeId).OnDelete(DeleteBehavior.Cascade);
        b.HasQueryFilter(x => !x.IsDeleted);
    }

    public void Configure(EntityTypeBuilder<RecipeIngredient> b)
    {
        b.ToTable("RecipeIngredients");
        b.HasKey(x => x.Id);
        b.Ignore(x => x.LineTotal);
        b.Property(x => x.ProductName).HasMaxLength(200).IsRequired();
        b.Property(x => x.Quantity).HasPrecision(18, 4);
        b.Property(x => x.Unit).HasMaxLength(30).IsRequired();
        b.Property(x => x.CostPerUnit).HasPrecision(18, 4);
        b.HasQueryFilter(x => !x.IsDeleted);
    }
}
