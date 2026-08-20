using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Identity.Domain.Entities;

namespace Softaxis.Identity.Infrastructure.Persistence.Configurations;

public sealed class TeamConfiguration : IEntityTypeConfiguration<Team>
{
    public void Configure(EntityTypeBuilder<Team> builder)
    {
        builder.ToTable("teams");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Name).IsRequired().HasMaxLength(150);
        builder.Property(x => x.Description).HasMaxLength(500);
        builder.Property(x => x.IsActive).HasDefaultValue(true);
        builder.Property(x => x.IsDeleted).HasDefaultValue(false);

        builder.HasIndex(x => x.TenantId);
        builder.HasIndex(x => x.TeamLeadUserId);

        // Unique per tenant, not globally — the same lesson as roles (IX_roles_TenantId_Name) and
        // finance accounts: a global unique name makes it impossible for a second tenant to have
        // its own "Sales Team". Filtered so legacy/global (NULL tenant) rows are exempt.
        builder.HasIndex(x => new { x.TenantId, x.Name })
               .IsUnique()
               .HasFilter("[TenantId] IS NOT NULL");

        builder.HasMany(x => x.Members)
               .WithOne()
               .HasForeignKey(m => m.TeamId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(x => x.Members).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

public sealed class TeamMemberConfiguration : IEntityTypeConfiguration<TeamMember>
{
    public void Configure(EntityTypeBuilder<TeamMember> builder)
    {
        builder.ToTable("team_members");
        builder.HasKey(x => new { x.TeamId, x.UserId });
        builder.HasIndex(x => x.UserId);

        // No FK to User: a user row being removed should not silently cascade-delete team history,
        // and Identity already keeps user references loose elsewhere (e.g. Team.TeamLeadUserId).
    }
}
