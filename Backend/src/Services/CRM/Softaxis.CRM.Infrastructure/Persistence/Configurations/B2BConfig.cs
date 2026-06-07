using Microsoft.EntityFrameworkCore;
using Softaxis.CRM.Domain.Entities;

namespace Softaxis.CRM.Infrastructure.Persistence.Configurations;

/// <summary>B2B Services pack — proposals, service contracts (AMC/SLA), support tickets. `b2b` schema.</summary>
public static class B2BConfig
{
    public static void Apply(ModelBuilder mb)
    {
        mb.Entity<Proposal>(b =>
        {
            b.ToTable("proposals", "b2b");
            b.HasKey(x => x.Id);
            b.Property(x => x.ProposalNumber).HasMaxLength(40).IsRequired();
            b.Property(x => x.ClientName).HasMaxLength(200).IsRequired();
            b.Property(x => x.Title).HasMaxLength(300).IsRequired();
            b.Property(x => x.Amount).HasPrecision(18, 2);
            b.Property(x => x.ValidUntil).HasMaxLength(30);
            b.Property(x => x.Status).HasMaxLength(20).IsRequired();
            b.Property(x => x.Scope).HasMaxLength(2000);
            b.Property(x => x.Notes).HasMaxLength(1000);
            b.HasIndex(x => x.DealId);
            b.HasIndex(x => x.LeadId);
            b.HasQueryFilter(x => !x.IsDeleted);
        });

        mb.Entity<ServiceContract>(b =>
        {
            b.ToTable("service_contracts", "b2b");
            b.HasKey(x => x.Id);
            b.Property(x => x.ContractNumber).HasMaxLength(40).IsRequired();
            b.Property(x => x.ClientName).HasMaxLength(200).IsRequired();
            b.Property(x => x.Title).HasMaxLength(300).IsRequired();
            b.Property(x => x.ContractType).HasMaxLength(20).IsRequired();
            b.Property(x => x.Value).HasPrecision(18, 2);
            b.Property(x => x.StartDate).HasMaxLength(30);
            b.Property(x => x.EndDate).HasMaxLength(30);
            b.Property(x => x.Status).HasMaxLength(20).IsRequired();
            b.Property(x => x.SlaTier).HasMaxLength(20);
            b.Property(x => x.Notes).HasMaxLength(1000);
            b.HasIndex(x => x.CustomerId);
            b.HasIndex(x => x.ProposalId);
            b.HasQueryFilter(x => !x.IsDeleted);
        });

        mb.Entity<SupportTicket>(b =>
        {
            b.ToTable("support_tickets", "b2b");
            b.HasKey(x => x.Id);
            b.Property(x => x.TicketNumber).HasMaxLength(40).IsRequired();
            b.Property(x => x.ClientName).HasMaxLength(200).IsRequired();
            b.Property(x => x.Subject).HasMaxLength(300).IsRequired();
            b.Property(x => x.Priority).HasMaxLength(20).IsRequired();
            b.Property(x => x.Status).HasMaxLength(20).IsRequired();
            b.Property(x => x.Description).HasMaxLength(2000);
            b.Property(x => x.Resolution).HasMaxLength(2000);
            b.HasIndex(x => x.ContractId);
            b.HasIndex(x => new { x.Status, x.Priority });
            b.HasQueryFilter(x => !x.IsDeleted);
        });
    }
}
