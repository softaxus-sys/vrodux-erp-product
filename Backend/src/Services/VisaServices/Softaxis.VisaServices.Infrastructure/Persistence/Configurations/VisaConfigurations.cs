using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.VisaServices.Domain.Entities;

namespace Softaxis.VisaServices.Infrastructure.Persistence.Configurations;

internal sealed class VisaCaseConfiguration : IEntityTypeConfiguration<VisaCase>
{
    public void Configure(EntityTypeBuilder<VisaCase> builder)
    {
        builder.ToTable("visa_cases");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.CaseNumber).IsRequired().HasMaxLength(30);
        // Unique per tenant, live rows only — declared in VisaDbContext (needs the TenantId shadow column).
        builder.Property(x => x.VisaTypeName).IsRequired().HasMaxLength(150);
        builder.Property(x => x.Channel).IsRequired().HasMaxLength(20).HasDefaultValue("manual");
        builder.Property(x => x.Emirate).HasMaxLength(50);
        builder.Property(x => x.CustomerName).HasMaxLength(200);
        builder.HasIndex(x => x.CustomerId);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20).HasDefaultValue("draft");
        builder.HasIndex(x => x.Status);
        builder.Property(x => x.Priority).HasMaxLength(20).HasDefaultValue("medium");
        builder.Property(x => x.AssignedTo).HasMaxLength(200);
        builder.Property(x => x.ServiceFee).HasPrecision(18, 2);
        builder.Property(x => x.GovtFee).HasPrecision(18, 2);
        builder.Property(x => x.GovtReference).HasMaxLength(100);
        builder.Property(x => x.VisaExpiryDate).HasMaxLength(20);
        builder.Property(x => x.SlaDueDate).HasMaxLength(20);
        builder.Property(x => x.RejectionReason).HasMaxLength(1000);
        builder.Property(x => x.Notes).HasMaxLength(2000);
        builder.Property(x => x.InvoiceNumber).HasMaxLength(50);
        builder.Property(x => x.IsDeleted).HasDefaultValue(false);
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

internal sealed class ApplicantConfiguration : IEntityTypeConfiguration<Applicant>
{
    public void Configure(EntityTypeBuilder<Applicant> builder)
    {
        builder.ToTable("applicants");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.HasIndex(x => x.VisaCaseId);
        builder.Property(x => x.FirstName).IsRequired().HasMaxLength(100);
        builder.Property(x => x.LastName).HasMaxLength(100);
        builder.Property(x => x.Nationality).HasMaxLength(100);
        builder.Property(x => x.PassportNumber).IsRequired().HasMaxLength(30);
        builder.HasIndex(x => x.PassportNumber);
        builder.Property(x => x.PassportExpiry).HasMaxLength(20);
        builder.Property(x => x.DateOfBirth).HasMaxLength(20);
        builder.Property(x => x.EmiratesId).HasMaxLength(30);
        builder.Property(x => x.UidNumber).HasMaxLength(30);
        builder.Property(x => x.Relationship).HasMaxLength(20).HasDefaultValue("primary");
        builder.Ignore(x => x.FullName);
    }
}

internal sealed class VisaTypeConfiguration : IEntityTypeConfiguration<VisaType>
{
    public void Configure(EntityTypeBuilder<VisaType> builder)
    {
        builder.ToTable("visa_types");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Code).IsRequired().HasMaxLength(50);
        // Non-unique: Code is unique per tenant now, not globally (tenant scope enforces isolation).
        builder.HasIndex(x => x.Code);
        builder.Property(x => x.Name).IsRequired().HasMaxLength(150);
        builder.Property(x => x.Category).HasMaxLength(30);
        builder.Property(x => x.Channel).HasMaxLength(20).HasDefaultValue("manual");
        builder.Property(x => x.DefaultGovtFee).HasPrecision(18, 2);
        builder.Property(x => x.DefaultServiceFee).HasPrecision(18, 2);
        builder.Property(x => x.RequiredDocuments).HasMaxLength(4000).HasConversion(
            v => string.Join('|', v),
            v => v.Split('|', StringSplitOptions.RemoveEmptyEntries).ToList());
        // Global reference table: no tenant column, plain active filter only.
        builder.HasQueryFilter(x => x.IsActive);
    }
}

internal sealed class CaseDocumentConfiguration : IEntityTypeConfiguration<CaseDocument>
{
    public void Configure(EntityTypeBuilder<CaseDocument> builder)
    {
        builder.ToTable("case_documents");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.HasIndex(x => x.VisaCaseId);
        builder.Property(x => x.Name).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20).HasDefaultValue("pending");
        builder.Property(x => x.FileUrl).HasMaxLength(1000);
        builder.Property(x => x.ExpiryDate).HasMaxLength(20);
        builder.Property(x => x.Notes).HasMaxLength(1000);
    }
}

internal sealed class ChannelAccountConfiguration : IEntityTypeConfiguration<ChannelAccount>
{
    public void Configure(EntityTypeBuilder<ChannelAccount> builder)
    {
        builder.ToTable("channel_accounts");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Channel).IsRequired().HasMaxLength(20);
        builder.HasIndex(x => x.Channel);
        builder.Property(x => x.EstablishmentCard).HasMaxLength(100);
        builder.Property(x => x.AccountRef).HasMaxLength(200);
        builder.Property(x => x.SecretProtected).HasMaxLength(4000);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20).HasDefaultValue("connected");
    }
}

internal sealed class GovtSubmissionConfiguration : IEntityTypeConfiguration<GovtSubmission>
{
    public void Configure(EntityTypeBuilder<GovtSubmission> builder)
    {
        builder.ToTable("govt_submissions");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.HasIndex(x => x.VisaCaseId);
        builder.Property(x => x.Channel).IsRequired().HasMaxLength(20);
        builder.Property(x => x.SubmissionType).IsRequired().HasMaxLength(30);
        builder.Property(x => x.ExternalReference).HasMaxLength(100);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20).HasDefaultValue("submitted");
        builder.Property(x => x.Notes).HasMaxLength(1000);
    }
}

internal sealed class CaseStatusEventConfiguration : IEntityTypeConfiguration<CaseStatusEvent>
{
    public void Configure(EntityTypeBuilder<CaseStatusEvent> builder)
    {
        builder.ToTable("case_status_events");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.HasIndex(x => x.VisaCaseId);
        builder.Property(x => x.EventType).IsRequired().HasMaxLength(30);
        builder.Property(x => x.FromStatus).HasMaxLength(20);
        builder.Property(x => x.ToStatus).HasMaxLength(20);
        builder.Property(x => x.Note).HasMaxLength(2000);
        builder.Property(x => x.ByName).HasMaxLength(200);
    }
}
