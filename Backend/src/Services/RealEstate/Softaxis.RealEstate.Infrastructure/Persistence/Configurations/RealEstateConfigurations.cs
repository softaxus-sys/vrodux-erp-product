using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.RealEstate.Domain.Entities;

namespace Softaxis.RealEstate.Infrastructure.Persistence.Configurations;

public sealed class RealEstateConfigurations :
    IEntityTypeConfiguration<Property>,
    IEntityTypeConfiguration<PropertyUnit>,
    IEntityTypeConfiguration<Tenant>,
    IEntityTypeConfiguration<LeaseContract>,
    IEntityTypeConfiguration<Broker>
{
    public void Configure(EntityTypeBuilder<Property> b)
    {
        b.ToTable("Properties");
        b.HasKey(x => x.Id);
        b.Property(x => x.PropertyNumber).HasMaxLength(50).IsRequired();
        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.PropertyType).HasMaxLength(50).IsRequired();
        b.Property(x => x.Address).HasMaxLength(500).IsRequired();
        b.Property(x => x.City).HasMaxLength(100).IsRequired();
        b.Property(x => x.Emirate).HasMaxLength(100).IsRequired();
        b.Property(x => x.TotalArea).HasPrecision(18, 2);
        b.Property(x => x.MarketValue).HasPrecision(18, 2);
        b.Property(x => x.Status).HasMaxLength(30).IsRequired();
        b.Property(x => x.Developer).HasMaxLength(200);
        b.Property(x => x.Description).HasMaxLength(1000);
        b.HasMany(x => x.Units).WithOne().HasForeignKey(u => u.PropertyId).OnDelete(DeleteBehavior.Cascade);
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
        b.HasMany(x => x.Installments).WithOne().HasForeignKey(i => i.ContractId).OnDelete(DeleteBehavior.Cascade);
        b.HasQueryFilter(x => !x.IsDeleted);
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
