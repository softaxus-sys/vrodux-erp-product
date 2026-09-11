using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.CRM.Domain.Entities;

namespace Softaxis.CRM.Infrastructure.Persistence.Configurations;

internal sealed class CrmNotificationConfiguration : IEntityTypeConfiguration<CrmNotification>
{
    public void Configure(EntityTypeBuilder<CrmNotification> builder)
    {
        builder.ToTable("notifications");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Type).IsRequired().HasMaxLength(30);
        builder.Property(x => x.Title).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Message).IsRequired().HasMaxLength(1000);
        builder.Property(x => x.Link).HasMaxLength(500);
        builder.Property(x => x.RelatedToType).HasMaxLength(30);
        // The bell asks "my newest notifications" on every poll — this is that access path.
        builder.HasIndex(x => new { x.UserId, x.CreatedAt });
    }
}
