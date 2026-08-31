using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.RealEstate.Domain.Entities;

namespace Softaxis.RealEstate.Infrastructure.Persistence.Configurations;

public sealed class RentAlertConfigurations :
    IEntityTypeConfiguration<RentInstallment>,
    IEntityTypeConfiguration<RentAlertSettings>,
    IEntityTypeConfiguration<RentAlertLog>
{
    public void Configure(EntityTypeBuilder<RentInstallment> b)
    {
        b.ToTable("RentInstallments");
        b.HasKey(x => x.Id);
        b.Ignore(x => x.Balance);
        b.Ignore(x => x.IsSettled);
        b.Property(x => x.DueDate).HasMaxLength(20).IsRequired();
        b.Property(x => x.Amount).HasPrecision(18, 2);
        b.Property(x => x.AmountPaid).HasPrecision(18, 2);
        b.Property(x => x.Status).HasMaxLength(20).IsRequired();
        b.Property(x => x.PaidDate).HasMaxLength(20);
        b.Property(x => x.PaymentMethod).HasMaxLength(50);
        b.Property(x => x.Reference).HasMaxLength(100);
        b.Property(x => x.Notes).HasMaxLength(1000);
        b.HasIndex(x => x.ContractId);
        // The reminder sweep scans by due date across every contract, so this is the index it rides.
        b.HasIndex(x => new { x.DueDate, x.Status });
        b.HasQueryFilter(x => !x.IsDeleted);
    }

    public void Configure(EntityTypeBuilder<RentAlertSettings> b)
    {
        b.ToTable("RentAlertSettings");
        b.HasKey(x => x.Id);
        b.Ignore(x => x.DueOffsets);
        b.Ignore(x => x.ExpiryOffsets);
        b.Ignore(x => x.CcList);
        b.Property(x => x.DueReminderDaysBefore).HasMaxLength(100).IsRequired();
        b.Property(x => x.ExpiryReminderDaysBefore).HasMaxLength(100).IsRequired();
        b.Property(x => x.CcEmails).HasMaxLength(2000);
        b.Property(x => x.TimeZoneId).HasMaxLength(100).IsRequired();
    }

    public void Configure(EntityTypeBuilder<RentAlertLog> b)
    {
        b.ToTable("RentAlertLogs");
        b.HasKey(x => x.Id);
        b.Property(x => x.Kind).HasMaxLength(30).IsRequired();
        b.Property(x => x.OffsetKey).HasMaxLength(30).IsRequired();
        b.Property(x => x.ToEmail).HasMaxLength(320).IsRequired();
        b.Property(x => x.CcEmails).HasMaxLength(2000);
        b.Property(x => x.FailureReason).HasMaxLength(500);
        b.HasIndex(x => x.ContractId);
    }
}
