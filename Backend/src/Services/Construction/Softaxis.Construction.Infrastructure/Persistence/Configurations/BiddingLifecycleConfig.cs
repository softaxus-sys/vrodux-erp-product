using Microsoft.EntityFrameworkCore;
using Softaxis.Construction.Domain.Entities;

namespace Softaxis.Construction.Infrastructure.Persistence.Configurations;

/// <summary>Maps the CRM-linked bidding lifecycle entities (RFQs, estimates, contracts).</summary>
public static class BiddingLifecycleConfig
{
    public static void Apply(ModelBuilder mb)
    {
        mb.Entity<Rfq>(b =>
        {
            b.ToTable("Rfqs");
            b.HasKey(x => x.Id);
            b.Property(x => x.RfqNumber).HasMaxLength(40).IsRequired();
            b.Property(x => x.ClientName).HasMaxLength(200).IsRequired();
            b.Property(x => x.ProjectTitle).HasMaxLength(300).IsRequired();
            b.Property(x => x.Scope).HasMaxLength(2000);
            b.Property(x => x.Budget).HasPrecision(18, 2);
            b.Property(x => x.DueDate).HasMaxLength(30);
            b.Property(x => x.Status).HasMaxLength(20).IsRequired();
            b.Property(x => x.AssignedTo).HasMaxLength(200);
            b.Property(x => x.Notes).HasMaxLength(1000);
            b.HasIndex(x => x.LeadId);
            b.HasQueryFilter(x => !x.IsDeleted);
        });

        mb.Entity<Estimate>(b =>
        {
            b.ToTable("Estimates");
            b.HasKey(x => x.Id);
            b.Property(x => x.EstimateNumber).HasMaxLength(40).IsRequired();
            b.Property(x => x.ClientName).HasMaxLength(200).IsRequired();
            b.Property(x => x.Title).HasMaxLength(300).IsRequired();
            b.Property(x => x.Amount).HasPrecision(18, 2);
            b.Property(x => x.ValidUntil).HasMaxLength(30);
            b.Property(x => x.Status).HasMaxLength(20).IsRequired();
            b.Property(x => x.Notes).HasMaxLength(1000);
            b.HasIndex(x => x.RfqId);
            b.HasIndex(x => x.DealId);
            b.HasQueryFilter(x => !x.IsDeleted);
        });

        mb.Entity<ConstructionContract>(b =>
        {
            b.ToTable("Contracts");
            b.HasKey(x => x.Id);
            b.Property(x => x.ContractNumber).HasMaxLength(40).IsRequired();
            b.Property(x => x.ClientName).HasMaxLength(200).IsRequired();
            b.Property(x => x.Title).HasMaxLength(300).IsRequired();
            b.Property(x => x.ContractValue).HasPrecision(18, 2);
            b.Property(x => x.StartDate).HasMaxLength(30);
            b.Property(x => x.EndDate).HasMaxLength(30);
            b.Property(x => x.Status).HasMaxLength(20).IsRequired();
            b.Property(x => x.Contractor).HasMaxLength(200);
            b.Property(x => x.Notes).HasMaxLength(1000);
            b.HasIndex(x => x.DealId);
            b.HasQueryFilter(x => !x.IsDeleted);
        });
    }
}
