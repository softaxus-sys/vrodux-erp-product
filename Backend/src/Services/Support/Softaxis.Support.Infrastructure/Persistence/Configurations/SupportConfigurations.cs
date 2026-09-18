using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Support.Domain.Entities;

namespace Softaxis.Support.Infrastructure.Persistence.Configurations;

public sealed class SupportTicketConfiguration : IEntityTypeConfiguration<SupportTicket>
{
    public void Configure(EntityTypeBuilder<SupportTicket> b)
    {
        b.ToTable("support_tickets");
        b.HasKey(x => x.Id);

        // Globally unique on purpose — one operator, one ticket number space (same as one
        // company's own numbering), no tenant scoping applicable since this table has none.
        b.HasIndex(x => x.TicketNumber).IsUnique();
        b.Property(x => x.TicketNumber).HasMaxLength(30).IsRequired();

        b.HasIndex(x => x.RequestingTenantId);
        b.HasIndex(x => x.AssignedToUserId);
        b.HasIndex(x => x.Status);

        b.Property(x => x.RequestingTenantName).HasMaxLength(200).IsRequired();
        b.Property(x => x.RequestingUserName).HasMaxLength(200).IsRequired();
        b.Property(x => x.RequestingUserEmail).HasMaxLength(320).IsRequired();
        b.Property(x => x.Subject).HasMaxLength(200).IsRequired();
        b.Property(x => x.Category).HasMaxLength(30).IsRequired();
        b.Property(x => x.Priority).HasMaxLength(20).IsRequired();
        b.Property(x => x.Status).HasMaxLength(30).IsRequired();
        b.Property(x => x.AssignedToUserName).HasMaxLength(200);

        b.HasQueryFilter(x => !x.IsDeleted);
    }
}

public sealed class TicketMessageConfiguration : IEntityTypeConfiguration<TicketMessage>
{
    public void Configure(EntityTypeBuilder<TicketMessage> b)
    {
        b.ToTable("support_ticket_messages");
        b.HasKey(x => x.Id);
        b.HasIndex(x => x.TicketId);
        b.Property(x => x.AuthorName).HasMaxLength(200).IsRequired();
        b.Property(x => x.Body).HasMaxLength(5000).IsRequired();
    }
}

public sealed class TicketAssignmentConfiguration : IEntityTypeConfiguration<TicketAssignment>
{
    public void Configure(EntityTypeBuilder<TicketAssignment> b)
    {
        b.ToTable("support_ticket_assignments");
        b.HasKey(x => x.Id);
        b.HasIndex(x => x.TicketId);
        b.Property(x => x.FromUserName).HasMaxLength(200);
        b.Property(x => x.ToUserName).HasMaxLength(200);
        b.Property(x => x.ChangedByName).HasMaxLength(200).IsRequired();
        b.Property(x => x.Note).HasMaxLength(500);
    }
}

public sealed class TicketAttachmentConfiguration : IEntityTypeConfiguration<TicketAttachment>
{
    public void Configure(EntityTypeBuilder<TicketAttachment> b)
    {
        b.ToTable("support_ticket_attachments");
        b.HasKey(x => x.Id);
        b.HasIndex(x => x.TicketId);
        b.HasIndex(x => x.MessageId);
        b.Property(x => x.FileName).HasMaxLength(255).IsRequired();
        b.Property(x => x.ContentType).HasMaxLength(100).IsRequired();
        // A 3 MB file limit (TicketAttachmentLimits) base64-encodes to ~4 MB of text — nvarchar(max)
        // is the only column type that fits without raising the limit again here to keep in sync.
        b.Property(x => x.DataUri).HasColumnType("nvarchar(max)").IsRequired();
        b.Property(x => x.UploadedByName).HasMaxLength(200).IsRequired();
    }
}
