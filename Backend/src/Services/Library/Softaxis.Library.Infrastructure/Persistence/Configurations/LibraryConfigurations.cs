using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Library.Domain.Entities;

namespace Softaxis.Library.Infrastructure.Persistence.Configurations;

internal sealed class LibraryBranchConfiguration : IEntityTypeConfiguration<LibraryBranch>
{
    public void Configure(EntityTypeBuilder<LibraryBranch> builder)
    {
        builder.ToTable("branches");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Name).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Code).HasMaxLength(30);
        builder.Property(x => x.Address).HasMaxLength(500);
        builder.Property(x => x.Phone).HasMaxLength(50);
        builder.Property(x => x.Email).HasMaxLength(320);
        builder.Property(x => x.IsDeleted).HasDefaultValue(false);
    }
}

internal sealed class BookTitleConfiguration : IEntityTypeConfiguration<BookTitle>
{
    public void Configure(EntityTypeBuilder<BookTitle> builder)
    {
        builder.ToTable("titles");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Title).IsRequired().HasMaxLength(400);
        builder.Property(x => x.Subtitle).HasMaxLength(400);
        builder.Property(x => x.Authors).IsRequired().HasMaxLength(500);
        builder.Property(x => x.Isbn).HasMaxLength(30);
        builder.Property(x => x.Publisher).HasMaxLength(200);
        builder.Property(x => x.Edition).HasMaxLength(60);
        builder.Property(x => x.Language).HasMaxLength(60);
        builder.Property(x => x.Category).HasMaxLength(120);
        builder.Property(x => x.MaterialType).IsRequired().HasMaxLength(30);
        builder.Property(x => x.Description).HasMaxLength(4000);
        builder.Property(x => x.ReplacementCost).HasPrecision(18, 2);
        builder.Property(x => x.IsDeleted).HasDefaultValue(false);
        builder.HasIndex(x => x.Title);
        builder.HasIndex(x => x.Isbn);
        builder.HasIndex(x => x.Category);
    }
}

internal sealed class BookCopyConfiguration : IEntityTypeConfiguration<BookCopy>
{
    public void Configure(EntityTypeBuilder<BookCopy> builder)
    {
        builder.ToTable("copies");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Barcode).IsRequired().HasMaxLength(60);
        builder.Property(x => x.ShelfLocation).HasMaxLength(100);
        builder.Property(x => x.Condition).IsRequired().HasMaxLength(30);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20);
        builder.Property(x => x.AcquiredOn).HasMaxLength(10);
        builder.Property(x => x.Price).HasPrecision(18, 2);
        builder.Property(x => x.Notes).HasMaxLength(1000);
        builder.Property(x => x.IsDeleted).HasDefaultValue(false);
        builder.HasIndex(x => x.TitleId);
        builder.HasIndex(x => new { x.BranchId, x.Status });
    }
}

internal sealed class MembershipTypeConfiguration : IEntityTypeConfiguration<MembershipType>
{
    public void Configure(EntityTypeBuilder<MembershipType> builder)
    {
        builder.ToTable("membership_types");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Name).IsRequired().HasMaxLength(120);
        builder.Property(x => x.FinePerDay).HasPrecision(18, 2);
        builder.Property(x => x.AnnualFee).HasPrecision(18, 2);
        builder.Property(x => x.IsDeleted).HasDefaultValue(false);
    }
}

internal sealed class MemberConfiguration : IEntityTypeConfiguration<Member>
{
    public void Configure(EntityTypeBuilder<Member> builder)
    {
        builder.ToTable("members");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.MemberNumber).IsRequired().HasMaxLength(40);
        builder.Property(x => x.FullName).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Email).HasMaxLength(320);
        builder.Property(x => x.Phone).HasMaxLength(50);
        builder.Property(x => x.Address).HasMaxLength(500);
        builder.Property(x => x.IdNumber).HasMaxLength(60);
        builder.Property(x => x.JoinedOn).IsRequired().HasMaxLength(10);
        builder.Property(x => x.ExpiresOn).HasMaxLength(10);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Notes).HasMaxLength(2000);
        builder.Property(x => x.IsDeleted).HasDefaultValue(false);
        builder.HasIndex(x => x.FullName);
        builder.HasIndex(x => x.MembershipTypeId);
    }
}

internal sealed class LoanConfiguration : IEntityTypeConfiguration<Loan>
{
    public void Configure(EntityTypeBuilder<Loan> builder)
    {
        builder.ToTable("loans");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.IssuedOn).IsRequired().HasMaxLength(10);
        builder.Property(x => x.DueDate).IsRequired().HasMaxLength(10);
        builder.Property(x => x.ReturnedOn).HasMaxLength(10);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20);
        builder.Property(x => x.IssuedByName).HasMaxLength(200);
        builder.Property(x => x.Notes).HasMaxLength(1000);
        builder.HasIndex(x => new { x.Status, x.DueDate });
        builder.HasIndex(x => x.MemberId);
        builder.HasIndex(x => x.CopyId);
        builder.HasIndex(x => x.TitleId);
        builder.HasIndex(x => x.BranchId);
    }
}

internal sealed class ReservationConfiguration : IEntityTypeConfiguration<Reservation>
{
    public void Configure(EntityTypeBuilder<Reservation> builder)
    {
        builder.ToTable("reservations");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20);
        builder.Property(x => x.ReservedOn).IsRequired().HasMaxLength(10);
        builder.Property(x => x.ReadyOn).HasMaxLength(10);
        builder.Property(x => x.HoldUntil).HasMaxLength(10);
        builder.HasIndex(x => new { x.TitleId, x.Status });
        builder.HasIndex(x => x.MemberId);
    }
}

internal sealed class FineConfiguration : IEntityTypeConfiguration<Fine>
{
    public void Configure(EntityTypeBuilder<Fine> builder)
    {
        builder.ToTable("fines");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Type).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Amount).HasPrecision(18, 2);
        builder.Property(x => x.AmountPaid).HasPrecision(18, 2);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Title).HasMaxLength(400);
        builder.Property(x => x.Reason).HasMaxLength(1000);
        builder.Property(x => x.CreatedOn).IsRequired().HasMaxLength(10);
        builder.Property(x => x.SettledOn).HasMaxLength(10);
        builder.Property(x => x.PaymentMethod).HasMaxLength(40);
        builder.Ignore(x => x.Balance);
        builder.HasIndex(x => new { x.MemberId, x.Status });
    }
}
