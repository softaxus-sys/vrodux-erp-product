using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.Recipe.Domain.Entities;
using Softaxis.Recipe.Infrastructure.Persistence.Configurations;

namespace Softaxis.Recipe.Infrastructure.Persistence;

public sealed class RecipeDbContext(DbContextOptions<RecipeDbContext> options) : DbContext(options), ITenantAmbientContext
{
    public DbSet<Recipe.Domain.Entities.Recipe> Recipes => Set<Recipe.Domain.Entities.Recipe>();
    public DbSet<RecipeIngredient> RecipeIngredients => Set<RecipeIngredient>();

    protected override void OnModelCreating(ModelBuilder mb)
    {
        mb.HasDefaultSchema("recipe");
        mb.ApplyConfigurationsFromAssembly(typeof(RecipeConfigurations).Assembly);
        TenantIsolation.ApplyTenantId(mb, this, "Softaxis.Recipe.Domain");
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        TenantIsolation.StampTenantId(ChangeTracker);
        return base.SaveChangesAsync(cancellationToken);
    }
}
