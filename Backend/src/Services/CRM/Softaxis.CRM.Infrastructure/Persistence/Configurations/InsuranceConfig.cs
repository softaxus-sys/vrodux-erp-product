using Microsoft.EntityFrameworkCore;
using Softaxis.CRM.Domain.Entities;

namespace Softaxis.CRM.Infrastructure.Persistence.Configurations;

/// <summary>Insurance pack entities — kept in the `insurance` schema, hosted by the CRM service.</summary>
public static class InsuranceConfig
{
    public static void Apply(ModelBuilder mb)
    {
        mb.Entity<Policy>(b =>
        {
            b.ToTable("policies", "insurance");
            b.HasKey(x => x.Id);
            b.Property(x => x.PolicyNumber).HasMaxLength(40).IsRequired();
            b.Property(x => x.HolderName).HasMaxLength(200).IsRequired();
            b.Property(x => x.ProductType).HasMaxLength(60).IsRequired();
            b.Property(x => x.Premium).HasPrecision(18, 2);
            b.Property(x => x.SumInsured).HasPrecision(18, 2);
            b.Property(x => x.StartDate).HasMaxLength(30);
            b.Property(x => x.EndDate).HasMaxLength(30);
            b.Property(x => x.Status).HasMaxLength(20).IsRequired();
            b.Property(x => x.Agent).HasMaxLength(200);
            b.Property(x => x.Notes).HasMaxLength(1000);
            b.HasIndex(x => x.CustomerId);
            b.HasIndex(x => x.DealId);
            b.HasQueryFilter(x => !x.IsDeleted);
        });

        mb.Entity<PolicyRenewal>(b =>
        {
            b.ToTable("policy_renewals", "insurance");
            b.HasKey(x => x.Id);
            b.Property(x => x.PolicyNumber).HasMaxLength(40).IsRequired();
            b.Property(x => x.HolderName).HasMaxLength(200).IsRequired();
            b.Property(x => x.RenewalDate).HasMaxLength(30);
            b.Property(x => x.NewPremium).HasPrecision(18, 2);
            b.Property(x => x.Status).HasMaxLength(20).IsRequired();
            b.Property(x => x.Notes).HasMaxLength(1000);
            b.HasIndex(x => x.PolicyId);
            b.HasQueryFilter(x => !x.IsDeleted);
        });

        mb.Entity<InsuranceClaim>(b =>
        {
            b.ToTable("claims", "insurance");
            b.HasKey(x => x.Id);
            b.Property(x => x.ClaimNumber).HasMaxLength(40).IsRequired();
            b.Property(x => x.PolicyNumber).HasMaxLength(40).IsRequired();
            b.Property(x => x.HolderName).HasMaxLength(200).IsRequired();
            b.Property(x => x.ClaimDate).HasMaxLength(30);
            b.Property(x => x.ClaimAmount).HasPrecision(18, 2);
            b.Property(x => x.ApprovedAmount).HasPrecision(18, 2);
            b.Property(x => x.Status).HasMaxLength(20).IsRequired();
            b.Property(x => x.Reason).HasMaxLength(500);
            b.Property(x => x.Notes).HasMaxLength(1000);
            b.HasIndex(x => x.PolicyId);
            b.HasQueryFilter(x => !x.IsDeleted);
        });
    }
}
