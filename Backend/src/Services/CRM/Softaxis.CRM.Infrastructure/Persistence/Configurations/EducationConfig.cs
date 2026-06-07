using Microsoft.EntityFrameworkCore;
using Softaxis.CRM.Domain.Entities;

namespace Softaxis.CRM.Infrastructure.Persistence.Configurations;

/// <summary>Education pack entities — kept in the `education` schema, hosted by the CRM service.</summary>
public static class EducationConfig
{
    public static void Apply(ModelBuilder mb)
    {
        mb.Entity<Admission>(b =>
        {
            b.ToTable("admissions", "education");
            b.HasKey(x => x.Id);
            b.Property(x => x.AdmissionNumber).HasMaxLength(40).IsRequired();
            b.Property(x => x.ApplicantName).HasMaxLength(200).IsRequired();
            b.Property(x => x.Program).HasMaxLength(200).IsRequired();
            b.Property(x => x.IntakeTerm).HasMaxLength(60);
            b.Property(x => x.GuardianName).HasMaxLength(200);
            b.Property(x => x.Phone).HasMaxLength(50);
            b.Property(x => x.Email).HasMaxLength(200);
            b.Property(x => x.Status).HasMaxLength(20).IsRequired();
            b.Property(x => x.AppliedDate).HasMaxLength(20);
            b.Property(x => x.Notes).HasMaxLength(1000);
            b.HasIndex(x => x.LeadId);
            b.HasQueryFilter(x => !x.IsDeleted);
        });

        mb.Entity<Student>(b =>
        {
            b.ToTable("students", "education");
            b.HasKey(x => x.Id);
            b.Property(x => x.StudentNumber).HasMaxLength(40).IsRequired();
            b.Property(x => x.FullName).HasMaxLength(200).IsRequired();
            b.Property(x => x.Gender).HasMaxLength(20);
            b.Property(x => x.Program).HasMaxLength(200);
            b.Property(x => x.GuardianName).HasMaxLength(200);
            b.Property(x => x.Phone).HasMaxLength(50);
            b.Property(x => x.Email).HasMaxLength(200);
            b.Property(x => x.Status).HasMaxLength(20).IsRequired();
            b.Property(x => x.EnrolledDate).HasMaxLength(20);
            b.Property(x => x.Notes).HasMaxLength(2000);
            b.HasIndex(x => x.CustomerId);
            b.HasQueryFilter(x => !x.IsDeleted);
        });

        mb.Entity<Enrollment>(b =>
        {
            b.ToTable("enrollments", "education");
            b.HasKey(x => x.Id);
            b.Property(x => x.EnrollmentNumber).HasMaxLength(40).IsRequired();
            b.Property(x => x.StudentName).HasMaxLength(200).IsRequired();
            b.Property(x => x.Course).HasMaxLength(200).IsRequired();
            b.Property(x => x.Term).HasMaxLength(60);
            b.Property(x => x.FeeTotal).HasPrecision(18, 2);
            b.Property(x => x.FeePaid).HasPrecision(18, 2);
            b.Property(x => x.Status).HasMaxLength(20).IsRequired();
            b.Property(x => x.EnrollDate).HasMaxLength(20);
            b.Property(x => x.Notes).HasMaxLength(1000);
            b.Ignore(x => x.FeeBalance);
            b.HasIndex(x => x.StudentId);
            b.HasQueryFilter(x => !x.IsDeleted);
        });
    }
}
