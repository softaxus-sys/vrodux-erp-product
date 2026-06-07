using Microsoft.EntityFrameworkCore;
using Softaxis.CRM.Domain.Entities;

namespace Softaxis.CRM.Infrastructure.Persistence.Configurations;

/// <summary>Healthcare pack entities — kept in the `healthcare` schema, hosted by the CRM service.</summary>
public static class HealthcareConfig
{
    public static void Apply(ModelBuilder mb)
    {
        mb.Entity<Patient>(b =>
        {
            b.ToTable("patients", "healthcare");
            b.HasKey(x => x.Id);
            b.Property(x => x.PatientNumber).HasMaxLength(40).IsRequired();
            b.Property(x => x.FullName).HasMaxLength(200).IsRequired();
            b.Property(x => x.Gender).HasMaxLength(20);
            b.Property(x => x.DateOfBirth).HasMaxLength(20);
            b.Property(x => x.Phone).HasMaxLength(50);
            b.Property(x => x.Email).HasMaxLength(200);
            b.Property(x => x.BloodGroup).HasMaxLength(10);
            b.Property(x => x.AssignedDoctor).HasMaxLength(200);
            b.Property(x => x.Status).HasMaxLength(20).IsRequired();
            b.Property(x => x.RegisteredDate).HasMaxLength(20);
            b.Property(x => x.Notes).HasMaxLength(2000);
            b.HasIndex(x => x.CustomerId);
            b.HasQueryFilter(x => !x.IsDeleted);
        });

        mb.Entity<Appointment>(b =>
        {
            b.ToTable("appointments", "healthcare");
            b.HasKey(x => x.Id);
            b.Property(x => x.AppointmentNumber).HasMaxLength(40).IsRequired();
            b.Property(x => x.PatientName).HasMaxLength(200).IsRequired();
            b.Property(x => x.Doctor).HasMaxLength(200).IsRequired();
            b.Property(x => x.Department).HasMaxLength(120);
            b.Property(x => x.ScheduledAt).HasMaxLength(30).IsRequired();
            b.Property(x => x.Status).HasMaxLength(20).IsRequired();
            b.Property(x => x.Reason).HasMaxLength(500);
            b.Property(x => x.Notes).HasMaxLength(1000);
            b.HasIndex(x => x.PatientId);
            b.HasIndex(x => new { x.Status, x.ScheduledAt });
            b.HasQueryFilter(x => !x.IsDeleted);
        });

        mb.Entity<TreatmentPlan>(b =>
        {
            b.ToTable("treatment_plans", "healthcare");
            b.HasKey(x => x.Id);
            b.Property(x => x.PatientName).HasMaxLength(200).IsRequired();
            b.Property(x => x.Diagnosis).HasMaxLength(500).IsRequired();
            b.Property(x => x.Plan).HasMaxLength(2000).IsRequired();
            b.Property(x => x.Doctor).HasMaxLength(200).IsRequired();
            b.Property(x => x.StartDate).HasMaxLength(20);
            b.Property(x => x.FollowUpDate).HasMaxLength(20);
            b.Property(x => x.Status).HasMaxLength(20).IsRequired();
            b.Property(x => x.Notes).HasMaxLength(1000);
            b.HasIndex(x => x.PatientId);
            b.HasQueryFilter(x => !x.IsDeleted);
        });
    }
}
