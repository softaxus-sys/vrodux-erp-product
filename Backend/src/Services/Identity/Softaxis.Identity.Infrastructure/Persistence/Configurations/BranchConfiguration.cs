using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Identity.Domain.Entities;

namespace Softaxis.Identity.Infrastructure.Persistence.Configurations;

public sealed class BranchConfiguration : IEntityTypeConfiguration<Branch>
{
    public void Configure(EntityTypeBuilder<Branch> builder)
    {
        builder.ToTable("branches");
        builder.HasKey(b => b.Id);
        builder.Property(b => b.Id).ValueGeneratedNever();

        builder.Property(b => b.Code).HasMaxLength(20).IsRequired();
        builder.HasIndex(b => b.Code).IsUnique().HasFilter("[IsDeleted] = 0");

        builder.Property(b => b.Name).HasMaxLength(150).IsRequired();
        builder.Property(b => b.Type).HasMaxLength(30).IsRequired();
        builder.Property(b => b.City).HasMaxLength(100).IsRequired();
        builder.Property(b => b.Country).HasMaxLength(100).IsRequired();
        builder.Property(b => b.Flag).HasMaxLength(10);
        builder.Property(b => b.Address).HasMaxLength(500);
        builder.Property(b => b.Phone).HasMaxLength(30);
        builder.Property(b => b.Email).HasMaxLength(254);
        builder.Property(b => b.Manager).HasMaxLength(150);
        builder.Property(b => b.Status).HasMaxLength(20).IsRequired();
        builder.Property(b => b.Currency).HasMaxLength(10).IsRequired();
        builder.Property(b => b.Timezone).HasMaxLength(80);
        builder.Property(b => b.OpenedDate).HasMaxLength(20);

        builder.HasQueryFilter(b => !b.IsDeleted);
    }
}
