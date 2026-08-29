using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.CRM.Domain.Entities;

namespace Softaxis.CRM.Infrastructure.Persistence.Configurations;

internal sealed class LeadConfiguration : IEntityTypeConfiguration<Lead>
{
    public void Configure(EntityTypeBuilder<Lead> builder)
    {
        builder.ToTable("leads");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.FirstName).IsRequired().HasMaxLength(100);
        builder.Property(x => x.LastName).IsRequired().HasMaxLength(100);
        builder.Property(x => x.Title).HasMaxLength(100);
        builder.Property(x => x.Company).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Industry).HasMaxLength(100);
        builder.Property(x => x.Email).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Phone).HasMaxLength(50);
        builder.Property(x => x.Country).HasMaxLength(100);
        builder.Property(x => x.City).HasMaxLength(100);
        builder.Property(x => x.Source).HasMaxLength(50);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20).HasDefaultValue("new");
        builder.Property(x => x.Priority).HasMaxLength(20).HasDefaultValue("medium");
        builder.Property(x => x.EstimatedValue).HasPrecision(18, 2);
        builder.Property(x => x.Currency).HasMaxLength(10);
        builder.Property(x => x.AssignedTo).HasMaxLength(200);
        builder.HasIndex(x => x.AssignedToUserId);
        builder.Property(x => x.CreatedDate).HasMaxLength(20);
        builder.Property(x => x.LastContactDate).HasMaxLength(20);
        builder.Property(x => x.NextFollowUp).HasMaxLength(20);
        builder.Property(x => x.Notes).HasMaxLength(2000);
        builder.Property(x => x.ConvertedDealId).HasMaxLength(50);
        builder.HasIndex(x => x.ConvertedCustomerId);
        // Team-scoped reads filter on this constantly.
        builder.HasIndex(x => x.TeamId);
        // The list's default sort and its paging both order on this, over every lead in the tenant.
        builder.HasIndex(x => x.LeadDate);
        // Conversion + source-effectiveness reports slice leads by conversion date.
        builder.HasIndex(x => x.ConvertedAt);
        builder.Property(x => x.IsDeleted).HasDefaultValue(false);
        // Requirements (lead-gen form / manual entry)
        builder.Property(x => x.WhatsApp).HasMaxLength(50);
        builder.Property(x => x.InterestedIn).HasMaxLength(500);
        builder.Property(x => x.Budget).HasMaxLength(100);
        builder.Property(x => x.Message).HasMaxLength(4000);
        builder.Property(x => x.PurchaseTimeframe).HasMaxLength(100);
        // Marketing / attribution
        builder.Property(x => x.Platform).HasMaxLength(50);
        builder.Property(x => x.FormName).HasMaxLength(200);
        builder.Property(x => x.Campaign).HasMaxLength(200);
        builder.Property(x => x.AdName).HasMaxLength(200);
        builder.Property(x => x.AdSetName).HasMaxLength(200);
        builder.Property(x => x.PlatformCreatedTime).HasMaxLength(40);
        builder.Property(x => x.CustomFields).HasConversion(
            v => v == null ? null : System.Text.Json.JsonSerializer.Serialize(v, (System.Text.Json.JsonSerializerOptions?)null),
            v => string.IsNullOrEmpty(v) ? null : System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, string>>(v, (System.Text.Json.JsonSerializerOptions?)null));
        builder.Property(x => x.Tags).HasConversion(
            v => string.Join(',', v),
            v => v.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList());
        builder.Ignore(x => x.FullName);
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

internal sealed class LeadAssignmentConfiguration : IEntityTypeConfiguration<LeadAssignment>
{
    public void Configure(EntityTypeBuilder<LeadAssignment> builder)
    {
        builder.ToTable("lead_assignments");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.FromUserName).HasMaxLength(200);
        builder.Property(x => x.ToUserName).IsRequired().HasMaxLength(200);
        builder.Property(x => x.AssignedByName).HasMaxLength(200);
        builder.Property(x => x.Note).HasMaxLength(1000);
        builder.HasIndex(x => x.LeadId);
    }
}

internal sealed class DealStageHistoryConfiguration : IEntityTypeConfiguration<DealStageHistory>
{
    public void Configure(EntityTypeBuilder<DealStageHistory> builder)
    {
        builder.ToTable("deal_stage_history");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.FromStage).HasMaxLength(30);
        builder.Property(x => x.ToStage).IsRequired().HasMaxLength(30);
        builder.Property(x => x.ChangedByName).HasMaxLength(200);
        builder.Property(x => x.ValueAtChange).HasPrecision(18, 2);
        builder.HasIndex(x => x.DealId);
        // Reports slice by period first, then group by stage — this is the covering shape for that.
        builder.HasIndex(x => new { x.CreatedAt, x.ToStage });
    }
}

internal sealed class CrmCustomerConfiguration : IEntityTypeConfiguration<CrmCustomer>
{
    public void Configure(EntityTypeBuilder<CrmCustomer> builder)
    {
        builder.ToTable("customers");
        builder.HasIndex(x => x.AccountManagerUserId);
        builder.HasIndex(x => x.TeamId);
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Name).IsRequired().HasMaxLength(200);
        builder.Property(x => x.TradeName).HasMaxLength(200);
        builder.Property(x => x.Industry).HasMaxLength(100);
        builder.Property(x => x.Website).HasMaxLength(200);
        builder.Property(x => x.Country).HasMaxLength(100);
        builder.Property(x => x.City).HasMaxLength(100);
        builder.Property(x => x.Address).HasMaxLength(500);
        builder.Property(x => x.Phone).HasMaxLength(50);
        builder.Property(x => x.Email).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20).HasDefaultValue("active");
        builder.Property(x => x.Tier).HasMaxLength(20).HasDefaultValue("standard");
        builder.Property(x => x.AccountManager).HasMaxLength(200);
        builder.Property(x => x.Since).HasMaxLength(20);
        builder.Property(x => x.LastActivity).HasMaxLength(20);
        builder.Property(x => x.TotalRevenue).HasPrecision(18, 2);
        builder.Property(x => x.Currency).HasMaxLength(10);
        builder.Property(x => x.Employees).HasMaxLength(20);
        builder.Property(x => x.Description).HasMaxLength(2000);
        builder.Property(x => x.ContractRenewal).HasMaxLength(20);
        builder.Property(x => x.IsDeleted).HasDefaultValue(false);
        builder.Property(x => x.Tags).HasConversion(
            v => string.Join(',', v),
            v => v.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList());
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

internal sealed class ContactConfiguration : IEntityTypeConfiguration<Contact>
{
    public void Configure(EntityTypeBuilder<Contact> builder)
    {
        builder.ToTable("contacts");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.FirstName).IsRequired().HasMaxLength(100);
        builder.Property(x => x.LastName).HasMaxLength(100);
        builder.Property(x => x.Title).HasMaxLength(120);
        builder.Property(x => x.Email).HasMaxLength(200);
        builder.Property(x => x.Phone).HasMaxLength(50);
        builder.Property(x => x.Department).HasMaxLength(120);
        builder.Property(x => x.Notes).HasMaxLength(1000);
        builder.Property(x => x.IsDeleted).HasDefaultValue(false);
        builder.Ignore(x => x.FullName);
        builder.HasIndex(x => x.CustomerId);
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

internal sealed class DealContactConfiguration : IEntityTypeConfiguration<DealContact>
{
    public void Configure(EntityTypeBuilder<DealContact> builder)
    {
        builder.ToTable("deal_contacts");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Role).IsRequired().HasMaxLength(30).HasDefaultValue("other");
        builder.HasIndex(x => x.DealId);
        // One row per (deal, contact) — a contact can't be linked twice to the same deal.
        builder.HasIndex(x => new { x.DealId, x.ContactId }).IsUnique();
    }
}

internal sealed class ActivityConfiguration : IEntityTypeConfiguration<Activity>
{
    public void Configure(EntityTypeBuilder<Activity> builder)
    {
        builder.ToTable("activities");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Type).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Subject).IsRequired().HasMaxLength(300);
        builder.Property(x => x.Description).HasMaxLength(2000);
        builder.Property(x => x.RelatedToType).IsRequired().HasMaxLength(20);
        builder.Property(x => x.RelatedToName).HasMaxLength(200);
        builder.Property(x => x.DueDate).HasMaxLength(20);
        builder.Property(x => x.AssignedTo).HasMaxLength(200);
        builder.Property(x => x.IsDeleted).HasDefaultValue(false);
        builder.HasIndex(x => new { x.RelatedToType, x.RelatedToId });
        builder.HasIndex(x => new { x.Completed, x.DueDate });
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

internal sealed class CrmDocumentConfiguration : IEntityTypeConfiguration<CrmDocument>
{
    public void Configure(EntityTypeBuilder<CrmDocument> builder)
    {
        builder.ToTable("crm_documents");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.RelatedToType).IsRequired().HasMaxLength(20);
        builder.Property(x => x.RelatedToName).HasMaxLength(200);
        builder.Property(x => x.FileName).IsRequired().HasMaxLength(300);
        builder.Property(x => x.ContentType).IsRequired().HasMaxLength(150);
        builder.Property(x => x.Data).IsRequired();
        builder.Property(x => x.DocumentType).IsRequired().HasMaxLength(40);
        builder.Property(x => x.Description).HasMaxLength(1000);
        builder.Property(x => x.UploadedByName).HasMaxLength(200);
        builder.Property(x => x.IsDeleted).HasDefaultValue(false);
        builder.HasIndex(x => new { x.RelatedToType, x.RelatedToId });
        // NOTE: the tenant filter applied in CrmDbContext replaces this one (EF9 allows a single
        // filter per entity), so read handlers must also filter !IsDeleted manually — the existing
        // CRM convention.
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

internal sealed class DealConfiguration : IEntityTypeConfiguration<Deal>
{
    public void Configure(EntityTypeBuilder<Deal> builder)
    {
        builder.ToTable("deals");
        builder.HasIndex(x => x.AssignedToUserId);
        builder.HasIndex(x => x.TeamId);
        // Won/lost reports filter on the close date across the whole deals table.
        builder.HasIndex(x => x.ClosedAt);
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Title).IsRequired().HasMaxLength(300);
        builder.Property(x => x.Company).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Value).HasPrecision(18, 2);
        builder.Property(x => x.Currency).HasMaxLength(10);
        builder.Property(x => x.Stage).IsRequired().HasMaxLength(20).HasDefaultValue("lead");
        builder.Property(x => x.Priority).HasMaxLength(20).HasDefaultValue("medium");
        builder.Property(x => x.ExpectedCloseDate).HasMaxLength(20);
        builder.Property(x => x.CreatedDate).HasMaxLength(20);
        builder.Property(x => x.AssignedTo).HasMaxLength(200);
        builder.Property(x => x.Source).HasMaxLength(50);
        builder.Property(x => x.Industry).HasMaxLength(100);
        builder.Property(x => x.Description).HasMaxLength(2000);
        builder.Property(x => x.NextAction).HasMaxLength(500);
        builder.Property(x => x.NextActionDate).HasMaxLength(20);
        builder.Property(x => x.ForecastCategory).HasMaxLength(20).HasDefaultValue("pipeline");
        builder.Property(x => x.LossReason).HasMaxLength(500);
        builder.HasIndex(x => x.CustomerId);
        builder.Property(x => x.ContactJson).HasMaxLength(1000);
        builder.Property(x => x.IsDeleted).HasDefaultValue(false);
        builder.Property(x => x.Tags).HasConversion(
            v => string.Join(',', v),
            v => v.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList());
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
