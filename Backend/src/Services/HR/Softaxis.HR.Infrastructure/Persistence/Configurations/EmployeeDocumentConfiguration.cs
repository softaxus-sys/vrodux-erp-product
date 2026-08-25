using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.HR.Domain.Entities;

namespace Softaxis.HR.Infrastructure.Persistence.Configurations;

internal sealed class EmployeeDocumentConfiguration : IEntityTypeConfiguration<EmployeeDocument>
{
    public void Configure(EntityTypeBuilder<EmployeeDocument> builder)
    {
        builder.ToTable("employee_documents");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.FileName).IsRequired().HasMaxLength(260);
        builder.Property(x => x.ContentType).IsRequired().HasMaxLength(150);
        builder.Property(x => x.Data).IsRequired().HasColumnType("varbinary(max)");
        builder.Property(x => x.DocumentType).IsRequired().HasMaxLength(40).HasDefaultValue("other");
        builder.Property(x => x.Description).HasMaxLength(500);
        builder.Property(x => x.ExpiryDate).HasMaxLength(20);
        builder.Property(x => x.UploadedByName).HasMaxLength(200);
        builder.Property(x => x.IsDeleted).IsRequired().HasDefaultValue(false);

        builder.HasIndex(x => x.EmployeeId);

        // Cascade with the employee: a deleted employee's files should not outlive the record.
        builder.HasOne<Employee>()
               .WithMany()
               .HasForeignKey(x => x.EmployeeId)
               .OnDelete(DeleteBehavior.Cascade);

        // No !IsDeleted filter here — TenantIsolation.ApplyTenantId replaces it; handlers filter manually.
    }
}
