using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Calendar.Domain.Entities;

namespace Softaxis.Calendar.Infrastructure.Persistence.Configurations;

// NB: TenantIsolation.ApplyTenantId REPLACES any HasQueryFilter set here, so every handler filters
// !IsDeleted by hand. The filters below are kept only as documentation of intent.

internal sealed class CalendarEventConfiguration : IEntityTypeConfiguration<CalendarEvent>
{
    public void Configure(EntityTypeBuilder<CalendarEvent> b)
    {
        b.ToTable("calendar_events");
        b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.OwnerName).HasMaxLength(200);
        b.Property(x => x.Title).IsRequired().HasMaxLength(300);
        b.Property(x => x.Description).HasMaxLength(4000);
        b.Property(x => x.Location).HasMaxLength(300);
        b.Property(x => x.TimeZone).HasMaxLength(100);
        b.Property(x => x.MeetUrl).HasMaxLength(500);
        b.Property(x => x.Source).IsRequired().HasMaxLength(20);
        b.Property(x => x.GoogleEventId).HasMaxLength(300);
        b.Property(x => x.GoogleEtag).HasMaxLength(200);
        b.Property(x => x.SyncStatus).IsRequired().HasMaxLength(20).HasDefaultValue("local");
        b.Property(x => x.SyncError).HasMaxLength(500);
        b.Property(x => x.IsDeleted).HasDefaultValue(false);

        // The calendar is read by (owner, time window); the Google id is how a pull finds its row.
        b.HasIndex(x => new { x.OwnerUserId, x.StartUtc });
        b.HasIndex(x => new { x.OwnerUserId, x.GoogleEventId });

        b.HasMany(x => x.Attendees).WithOne().HasForeignKey(a => a.EventId).OnDelete(DeleteBehavior.Cascade);
        b.Navigation(x => x.Attendees).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

internal sealed class CalendarAttendeeConfiguration : IEntityTypeConfiguration<CalendarAttendee>
{
    public void Configure(EntityTypeBuilder<CalendarAttendee> b)
    {
        b.ToTable("calendar_attendees");
        b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.Email).IsRequired().HasMaxLength(320);
        b.Property(x => x.Name).HasMaxLength(200);
        b.Property(x => x.ResponseStatus).IsRequired().HasMaxLength(20);
        // "events I am invited to" looks guests up by address.
        b.HasIndex(x => x.Email);
        b.HasIndex(x => x.EventId);
    }
}

internal sealed class CalendarConnectionConfiguration : IEntityTypeConfiguration<CalendarConnection>
{
    public void Configure(EntityTypeBuilder<CalendarConnection> b)
    {
        b.ToTable("calendar_connections");
        b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.Provider).IsRequired().HasMaxLength(20);
        b.Property(x => x.AccountEmail).HasMaxLength(320);
        b.Property(x => x.Credentials).HasColumnType("nvarchar(max)");
        b.Property(x => x.SyncToken).HasMaxLength(500);
        b.Property(x => x.Status).IsRequired().HasMaxLength(20).HasDefaultValue("disconnected");
        b.Property(x => x.LastError).HasMaxLength(500);
        b.Property(x => x.IsDeleted).HasDefaultValue(false);
        b.HasIndex(x => x.UserId);
    }
}
