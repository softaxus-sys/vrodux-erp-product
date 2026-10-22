using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Finance.Domain.Entities;

namespace Softaxis.Finance.Infrastructure.Persistence.Configurations;

internal sealed class EInvoiceSubmissionConfiguration : IEntityTypeConfiguration<EInvoiceSubmission>
{
    public void Configure(EntityTypeBuilder<EInvoiceSubmission> b)
    {
        b.ToTable("einvoice_submissions");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.InvoiceNumber).HasMaxLength(50).IsRequired();
        b.Property(x => x.XmlSnapshot).IsRequired();
        b.Property(x => x.Provider).HasMaxLength(100).IsRequired();
        b.Property(x => x.Environment).HasMaxLength(20).IsRequired();
        b.Property(x => x.Status).HasMaxLength(20).IsRequired();
        b.Property(x => x.ProviderMessageId).HasMaxLength(200);
        b.Property(x => x.ResponseSnippet).HasMaxLength(2000);
        b.Property(x => x.SubmittedByUserId).HasMaxLength(100);
        b.Property(x => x.SubmittedByName).HasMaxLength(200);
        // One invoice can be in flight or accepted only once — the double-send guard.
        b.HasIndex(x => x.InvoiceId).IsUnique().HasFilter("[IsActive] = 1")
            .HasDatabaseName("IX_einvoice_submissions_InvoiceId_Active");
    }
}
