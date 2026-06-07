using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Construction.Domain.Entities;

namespace Softaxis.Construction.Infrastructure.Persistence.Configurations;

internal sealed class ProjectConfiguration : IEntityTypeConfiguration<Project>
{
    public void Configure(EntityTypeBuilder<Project> builder)
    {
        builder.ToTable("projects"); builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.ProjectNumber).IsRequired().HasMaxLength(50);
        builder.Property(x => x.Name).IsRequired().HasMaxLength(300);
        builder.Property(x => x.Client).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Location).HasMaxLength(300);
        builder.Property(x => x.ProjectType).HasMaxLength(30);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20).HasDefaultValue("planning");
        builder.Property(x => x.StartDate).HasMaxLength(20);
        builder.Property(x => x.EndDate).HasMaxLength(20);
        builder.Property(x => x.ContractValue).HasPrecision(18, 2);
        builder.Property(x => x.BudgetSpent).HasPrecision(18, 2);
        builder.Property(x => x.ProjectManager).HasMaxLength(200);
        builder.Property(x => x.SiteEngineer).HasMaxLength(200);
        builder.Property(x => x.Notes).HasMaxLength(2000);
        builder.Property(x => x.IsDeleted).HasDefaultValue(false);
        builder.Ignore(x => x.BudgetRemaining);
        builder.HasQueryFilter(x => !x.IsDeleted);
        builder.HasMany(x => x.Phases).WithOne(x => x.Project).HasForeignKey(x => x.ProjectId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class ProjectPhaseConfiguration : IEntityTypeConfiguration<ProjectPhase>
{
    public void Configure(EntityTypeBuilder<ProjectPhase> builder)
    {
        builder.ToTable("project_phases"); builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Name).IsRequired().HasMaxLength(200);
        builder.Property(x => x.StartDate).HasMaxLength(20); builder.Property(x => x.EndDate).HasMaxLength(20);
        builder.Property(x => x.Status).HasMaxLength(20).HasDefaultValue("not_started");
    }
}

internal sealed class SiteConfiguration : IEntityTypeConfiguration<Site>
{
    public void Configure(EntityTypeBuilder<Site> builder)
    {
        builder.ToTable("sites"); builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.SiteCode).IsRequired().HasMaxLength(30);
        builder.Property(x => x.Name).IsRequired().HasMaxLength(200);
        builder.Property(x => x.ProjectId).HasMaxLength(50); builder.Property(x => x.ProjectName).HasMaxLength(200);
        builder.Property(x => x.Address).HasMaxLength(500); builder.Property(x => x.City).HasMaxLength(100);
        builder.Property(x => x.Emirate).HasMaxLength(100); builder.Property(x => x.Lat).HasMaxLength(20); builder.Property(x => x.Lng).HasMaxLength(20);
        builder.Property(x => x.SiteManager).HasMaxLength(200); builder.Property(x => x.SiteManagerPhone).HasMaxLength(50);
        builder.Property(x => x.SafetyOfficer).HasMaxLength(200); builder.Property(x => x.SafetyOfficerPhone).HasMaxLength(50);
        builder.Property(x => x.Status).HasMaxLength(20).HasDefaultValue("active");
        builder.Property(x => x.Area).HasPrecision(18, 2);
        builder.Property(x => x.StartDate).HasMaxLength(20); builder.Property(x => x.PermitNumber).HasMaxLength(50);
        builder.Property(x => x.PermitExpiry).HasMaxLength(20); builder.Property(x => x.LastInspection).HasMaxLength(20);
        builder.Property(x => x.NextInspection).HasMaxLength(20); builder.Property(x => x.Notes).HasMaxLength(2000);
        builder.Property(x => x.IsDeleted).HasDefaultValue(false);
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

internal sealed class ContractorConfiguration : IEntityTypeConfiguration<Contractor>
{
    public void Configure(EntityTypeBuilder<Contractor> builder)
    {
        builder.ToTable("contractors"); builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.ContractorCode).IsRequired().HasMaxLength(30);
        builder.Property(x => x.CompanyName).IsRequired().HasMaxLength(200);
        builder.Property(x => x.TradeName).HasMaxLength(200); builder.Property(x => x.Trade).HasMaxLength(100);
        builder.Property(x => x.Status).HasMaxLength(20).HasDefaultValue("active");
        builder.Property(x => x.Rating).HasPrecision(3, 1);
        builder.Property(x => x.ContactPerson).HasMaxLength(200); builder.Property(x => x.Email).HasMaxLength(200);
        builder.Property(x => x.Phone).HasMaxLength(50); builder.Property(x => x.City).HasMaxLength(100); builder.Property(x => x.Country).HasMaxLength(100);
        builder.Property(x => x.LicenseNumber).HasMaxLength(50); builder.Property(x => x.LicenseExpiry).HasMaxLength(20);
        builder.Property(x => x.InsuranceProvider).HasMaxLength(100); builder.Property(x => x.InsuranceExpiry).HasMaxLength(20);
        builder.Property(x => x.InsuranceCovered).HasMaxLength(100);
        builder.Property(x => x.TotalContractValue).HasPrecision(18, 2);
        builder.Property(x => x.Notes).HasMaxLength(2000);
        builder.Property(x => x.IsDeleted).HasDefaultValue(false);
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

internal sealed class BillOfQuantityConfiguration : IEntityTypeConfiguration<BillOfQuantity>
{
    public void Configure(EntityTypeBuilder<BillOfQuantity> builder)
    {
        builder.ToTable("boqs"); builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.BoqNumber).IsRequired().HasMaxLength(50);
        builder.Property(x => x.ProjectId).HasMaxLength(50); builder.Property(x => x.ProjectName).HasMaxLength(200);
        builder.Property(x => x.Status).HasMaxLength(20).HasDefaultValue("draft");
        builder.Property(x => x.ApprovedBy).HasMaxLength(200); builder.Property(x => x.ApprovedDate).HasMaxLength(20);
        builder.Property(x => x.IsDeleted).HasDefaultValue(false);
        builder.Ignore(x => x.TotalAmount); builder.Ignore(x => x.CompletedAmount);
        builder.Ignore(x => x.VariationAmount); builder.Ignore(x => x.FinalAmount); builder.Ignore(x => x.CompletionPct);
        builder.HasQueryFilter(x => !x.IsDeleted);
        builder.HasMany(x => x.Items).WithOne(x => x.Boq).HasForeignKey(x => x.BoqId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class BoqItemConfiguration : IEntityTypeConfiguration<BoqItem>
{
    public void Configure(EntityTypeBuilder<BoqItem> builder)
    {
        builder.ToTable("boq_items"); builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.ItemCode).IsRequired().HasMaxLength(30);
        builder.Property(x => x.Description).IsRequired().HasMaxLength(500);
        builder.Property(x => x.Unit).HasMaxLength(20);
        builder.Property(x => x.Quantity).HasPrecision(18, 2); builder.Property(x => x.UnitRate).HasPrecision(18, 2);
        builder.Property(x => x.CompletedQty).HasPrecision(18, 2); builder.Property(x => x.VariationQty).HasPrecision(18, 2);
        builder.Ignore(x => x.Amount); builder.Ignore(x => x.CompletedAmt); builder.Ignore(x => x.VariationAmt);
    }
}
