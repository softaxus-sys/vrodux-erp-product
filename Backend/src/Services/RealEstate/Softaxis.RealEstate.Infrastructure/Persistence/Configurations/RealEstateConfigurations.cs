using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.RealEstate.Domain.Entities;

namespace Softaxis.RealEstate.Infrastructure.Persistence.Configurations;

public sealed class RealEstateConfigurations :
    IEntityTypeConfiguration<Property>,
    IEntityTypeConfiguration<PropertyUnit>,
    IEntityTypeConfiguration<PropertyImage>,
    IEntityTypeConfiguration<Tenant>,
    IEntityTypeConfiguration<LeaseContract>,
    IEntityTypeConfiguration<LeaseTermination>,
    IEntityTypeConfiguration<Broker>
{
    public void Configure(EntityTypeBuilder<Property> b)
    {
        b.ToTable("Properties");
        b.HasKey(x => x.Id);
        b.Property(x => x.PropertyNumber).HasMaxLength(50).IsRequired();
        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.PropertyType).HasMaxLength(50).IsRequired();
        // Defaulted at the database as well as in the entity: existing rows predate the column, and
        // the portfolio summary counts by it — a NULL here would drop a property out of every tally.
        b.Property(x => x.Category).HasMaxLength(30).IsRequired().HasDefaultValue("residential");
        b.Property(x => x.Address).HasMaxLength(500).IsRequired();
        b.Property(x => x.City).HasMaxLength(100).IsRequired();
        b.Property(x => x.Emirate).HasMaxLength(100).IsRequired();
        b.Property(x => x.TotalArea).HasPrecision(18, 2);
        b.Property(x => x.MarketValue).HasPrecision(18, 2);
        b.Property(x => x.Status).HasMaxLength(30).IsRequired();
        b.Property(x => x.Developer).HasMaxLength(200);
        b.Property(x => x.Description).HasMaxLength(1000);
        b.HasMany(x => x.Units).WithOne().HasForeignKey(u => u.PropertyId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(x => x.Images).WithOne().HasForeignKey(i => i.PropertyId).OnDelete(DeleteBehavior.Cascade);
        b.HasQueryFilter(x => !x.IsDeleted);
    }

    public void Configure(EntityTypeBuilder<PropertyImage> b)
    {
        b.ToTable("PropertyImages");
        b.HasKey(x => x.Id);
        // varbinary(max): a photograph has no sensible length cap, and the API enforces the real
        // limit on the way in rather than letting the column truncate silently. An empty array
        // (once ObjectKey is set — see PropertyImage.SetObjectKey) still satisfies IsRequired, since
        // that only enforces NOT NULL, not non-empty.
        b.Property(x => x.Data).IsRequired();
        b.Property(x => x.ObjectKey).HasMaxLength(500);
        b.Property(x => x.ContentType).HasMaxLength(100).IsRequired();
        b.Property(x => x.FileName).HasMaxLength(255);
        b.Property(x => x.Caption).HasMaxLength(500);
        b.HasIndex(x => x.PropertyId);
        b.HasQueryFilter(x => !x.IsDeleted);
    }

    public void Configure(EntityTypeBuilder<PropertyUnit> b)
    {
        b.ToTable("PropertyUnits");
        b.HasKey(x => x.Id);
        b.Property(x => x.UnitNumber).HasMaxLength(50).IsRequired();
        b.Property(x => x.UnitType).HasMaxLength(50).IsRequired();
        b.Property(x => x.Area).HasPrecision(18, 2);
        b.Property(x => x.RentPerYear).HasPrecision(18, 2);
        b.Property(x => x.SalePrice).HasPrecision(18, 2);
        b.Property(x => x.Status).HasMaxLength(30).IsRequired();
        b.Property(x => x.CurrentTenantName).HasMaxLength(200);
        b.Property(x => x.Furnishing).HasMaxLength(50);
        b.Property(x => x.View).HasMaxLength(100);
        b.Property(x => x.ServiceCharge).HasPrecision(18, 2);
        b.Property(x => x.Notes).HasMaxLength(1000);

        // The listing columns. The three *Label fields are generous because they hold the sheet's
        // own wording — "2,275,000(under hand over process)(3% commission from owner side)" is a
        // real price cell, and truncating one loses the condition the deal was agreed on.
        b.Property(x => x.Purpose).HasMaxLength(20);
        b.Property(x => x.ListedOn).HasMaxLength(10);
        b.Property(x => x.RentedUntil).HasMaxLength(10);
        b.Property(x => x.VacancyAlertKey).HasMaxLength(40);
        b.Property(x => x.BedsLabel).HasMaxLength(200);
        b.Property(x => x.PriceLabel).HasMaxLength(500);
        b.Property(x => x.AreaLabel).HasMaxLength(200);
        b.Property(x => x.ListedBy).HasMaxLength(200);
        b.Property(x => x.AgentName).HasMaxLength(200);
        b.Property(x => x.OwnerName).HasMaxLength(200);
        b.Property(x => x.OwnerPhone).HasMaxLength(60);
        b.Property(x => x.OwnerPhoneAlt).HasMaxLength(60);

        // Listings are read by purpose far more than by anything else — the page opens on one.
        b.HasIndex(x => x.Purpose);
        b.HasIndex(x => x.PropertyId);
        // Scalar reference to an Identity user, no FK constraint — the codebase's convention for
        // every cross-service reference (CRM's Deal.CustomerId, TeamId, etc). Indexed since the
        // confidentiality guard checks it on every read.
        b.HasIndex(x => x.AgentUserId);
        // Defaulted at the database too, in case a raw insert path ever bypasses the entity's own
        // default — same defensive pattern as Property.Category above. Existing rows predate the
        // column and must come back restricted, not silently opened up.
        b.Property(x => x.RestrictConfidentialDetails).HasDefaultValue(true);

        b.HasQueryFilter(x => !x.IsDeleted);
    }

    public void Configure(EntityTypeBuilder<Tenant> b)
    {
        b.ToTable("Tenants");
        b.HasKey(x => x.Id);
        b.Property(x => x.TenantNumber).HasMaxLength(50).IsRequired();
        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.TenantType).HasMaxLength(30).IsRequired();
        b.Property(x => x.Email).HasMaxLength(200).IsRequired();
        b.Property(x => x.Phone).HasMaxLength(50).IsRequired();
        b.Property(x => x.NationalId).HasMaxLength(50);
        b.Property(x => x.CompanyName).HasMaxLength(200);
        b.Property(x => x.TradeLicense).HasMaxLength(100);
        b.Property(x => x.Nationality).HasMaxLength(100).IsRequired();
        b.Property(x => x.Status).HasMaxLength(30).IsRequired();
        b.Property(x => x.TotalPaid).HasPrecision(18, 2);
        b.Property(x => x.PassportNumber).HasMaxLength(50);
        b.Property(x => x.Trn).HasMaxLength(50);
        b.Property(x => x.Occupation).HasMaxLength(150);
        b.Property(x => x.MonthlyIncome).HasPrecision(18, 2);
        b.Property(x => x.EmergencyContact).HasMaxLength(200);
        b.Property(x => x.Notes).HasMaxLength(1000);
        b.HasQueryFilter(x => !x.IsDeleted);
    }

    public void Configure(EntityTypeBuilder<LeaseContract> b)
    {
        b.ToTable("LeaseContracts");
        b.HasKey(x => x.Id);
        b.Ignore(x => x.Balance);
        b.Ignore(x => x.ScheduledTotal);
        b.Property(x => x.ContractNumber).HasMaxLength(50).IsRequired();
        b.Property(x => x.PropertyName).HasMaxLength(200).IsRequired();
        b.Property(x => x.UnitNumber).HasMaxLength(50).IsRequired();
        b.Property(x => x.TenantName).HasMaxLength(200).IsRequired();
        b.Property(x => x.StartDate).HasMaxLength(20).IsRequired();
        b.Property(x => x.EndDate).HasMaxLength(20).IsRequired();
        b.Property(x => x.AnnualRent).HasPrecision(18, 2);
        b.Property(x => x.SecurityDeposit).HasPrecision(18, 2);
        b.Property(x => x.TotalPaid).HasPrecision(18, 2);
        b.Property(x => x.Status).HasMaxLength(30).IsRequired();
        b.Property(x => x.EjariNumber).HasMaxLength(100);
        b.Property(x => x.Notes).HasMaxLength(1000);
        b.Property(x => x.PaymentFrequency).HasMaxLength(20).IsRequired().HasDefaultValue("annual");
        b.Property(x => x.PreviousAnnualRent).HasPrecision(18, 2);
        // Scalar links to another lease in the same table, no FK constraint: a self-referencing
        // constraint would block deleting either end of a renewal chain.
        b.HasIndex(x => x.RenewedFromContractId);
        b.HasMany(x => x.Installments).WithOne().HasForeignKey(i => i.ContractId).OnDelete(DeleteBehavior.Cascade);
        b.HasQueryFilter(x => !x.IsDeleted);
    }

    public void Configure(EntityTypeBuilder<LeaseTermination> b)
    {
        b.ToTable("LeaseTerminations");
        b.HasKey(x => x.Id);
        b.Property(x => x.Status).HasMaxLength(30).IsRequired();
        b.Property(x => x.TerminationDate).HasMaxLength(20).IsRequired();
        b.Property(x => x.NoticeDate).HasMaxLength(20);
        b.Property(x => x.Reason).HasMaxLength(30).IsRequired();
        b.Property(x => x.ReasonNotes).HasMaxLength(1000);
        b.Property(x => x.RentOwed).HasPrecision(18, 2);
        b.Property(x => x.RentPaid).HasPrecision(18, 2);
        b.Property(x => x.DepositHeld).HasPrecision(18, 2);
        b.Property(x => x.PenaltyAmount).HasPrecision(18, 2);
        b.Property(x => x.DeductionsAmount).HasPrecision(18, 2);
        b.Property(x => x.DeductionNotes).HasMaxLength(1000);
        b.Property(x => x.NetSettlement).HasPrecision(18, 2);
        b.Property(x => x.SettledOn).HasMaxLength(20);
        b.Property(x => x.SettlementMethod).HasMaxLength(50);
        b.Property(x => x.SettlementReference).HasMaxLength(100);
        b.Property(x => x.SettlementNotes).HasMaxLength(1000);
        b.Property(x => x.RecordedByName).HasMaxLength(200);
        // One termination per lease. A lease id is a GUID, so it cannot repeat across workspaces.
        b.HasIndex(x => x.ContractId).IsUnique();
        b.HasIndex(x => x.Status);
    }

    public void Configure(EntityTypeBuilder<Broker> b)
    {
        b.ToTable("Brokers");
        b.HasKey(x => x.Id);
        b.Property(x => x.BrokerNumber).HasMaxLength(50).IsRequired();
        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.Agency).HasMaxLength(200).IsRequired();
        b.Property(x => x.Email).HasMaxLength(200).IsRequired();
        b.Property(x => x.Phone).HasMaxLength(50).IsRequired();
        b.Property(x => x.LicenseNumber).HasMaxLength(100).IsRequired();
        b.Property(x => x.LicenseExpiry).HasMaxLength(20).IsRequired();
        b.Property(x => x.Specialization).HasMaxLength(30).IsRequired();
        b.Property(x => x.TotalCommission).HasPrecision(18, 2);
        b.Property(x => x.CommissionRate).HasPrecision(5, 2);
        b.Property(x => x.Rating).HasPrecision(3, 1);
        b.Property(x => x.Status).HasMaxLength(30).IsRequired();
        b.HasQueryFilter(x => !x.IsDeleted);
    }
}
