using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.CRM.Domain.Entities;

namespace Softaxis.CRM.Infrastructure.Persistence.Configurations;

internal sealed class PortalListingConfiguration : IEntityTypeConfiguration<PortalListing>
{
    public void Configure(EntityTypeBuilder<PortalListing> builder)
    {
        builder.ToTable("portal_listings");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Portal).IsRequired().HasMaxLength(30);
        builder.Property(x => x.Reference).HasMaxLength(60);
        builder.Property(x => x.ListingId).HasMaxLength(20);
        builder.Property(x => x.Url).HasMaxLength(500);
        builder.Property(x => x.Title).HasMaxLength(200);
        builder.Property(x => x.AgentName).IsRequired().HasMaxLength(200);
        // "My listings" is the common read.
        builder.HasIndex(x => x.AgentUserId);
        // The tenant-scoped unique indexes on (Portal, Reference) and (Portal, ListingId) are declared
        // in CrmDbContext: TenantId is a shadow column that does not exist inside a configuration.
    }
}
