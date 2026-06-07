using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Hospitality.Infrastructure.Persistence.Migrations
{
    public partial class InitialCreate : Migration
    {
        protected override void Up(MigrationBuilder mb)
        {
            mb.EnsureSchema("hospitality");

            mb.CreateTable("Rooms", t => new
            {
                Id                 = t.Column<Guid>(nullable: false),
                RoomNumber         = t.Column<string>(maxLength: 20,  nullable: false),
                RoomType           = t.Column<string>(maxLength: 50,  nullable: false),
                Floor              = t.Column<int>(nullable: false),
                Capacity           = t.Column<int>(nullable: false),
                RatePerNight       = t.Column<decimal>(precision: 18, scale: 2, nullable: false),
                Status             = t.Column<string>(maxLength: 30,  nullable: false),
                HousekeepingStatus = t.Column<string>(maxLength: 30,  nullable: false),
                CurrentGuestName   = t.Column<string>(maxLength: 200, nullable: true),
                CurrentBookingId   = t.Column<string>(maxLength: 50,  nullable: true),
                View               = t.Column<string>(maxLength: 50,  nullable: true),
                HasBalcony         = t.Column<bool>(nullable: false),
                IsDeleted          = t.Column<bool>(nullable: false, defaultValue: false),
                CreatedAt          = t.Column<DateTime>(nullable: false),
                UpdatedAt          = t.Column<DateTime>(nullable: false),
            }, schema: "hospitality",
            constraints: t => t.PrimaryKey("PK_Rooms", x => x.Id));

            mb.CreateTable("Bookings", t => new
            {
                Id               = t.Column<Guid>(nullable: false),
                BookingNumber    = t.Column<string>(maxLength: 50,   nullable: false),
                RoomId           = t.Column<Guid>(nullable: false),
                RoomNumber       = t.Column<string>(maxLength: 20,   nullable: false),
                RoomType         = t.Column<string>(maxLength: 50,   nullable: false),
                GuestName        = t.Column<string>(maxLength: 200,  nullable: false),
                GuestEmail       = t.Column<string>(maxLength: 200,  nullable: false),
                GuestPhone       = t.Column<string>(maxLength: 50,   nullable: false),
                GuestNationality = t.Column<string>(maxLength: 100,  nullable: false),
                CheckIn          = t.Column<string>(maxLength: 20,   nullable: false),
                CheckOut         = t.Column<string>(maxLength: 20,   nullable: false),
                Nights           = t.Column<int>(nullable: false),
                Adults           = t.Column<int>(nullable: false),
                Children         = t.Column<int>(nullable: false),
                RatePerNight     = t.Column<decimal>(precision: 18, scale: 2, nullable: false),
                TotalAmount      = t.Column<decimal>(precision: 18, scale: 2, nullable: false),
                PaidAmount       = t.Column<decimal>(precision: 18, scale: 2, nullable: false),
                Status           = t.Column<string>(maxLength: 30,   nullable: false),
                Source           = t.Column<string>(maxLength: 50,   nullable: false),
                SpecialRequests  = t.Column<string>(maxLength: 1000, nullable: true),
                IsDeleted        = t.Column<bool>(nullable: false, defaultValue: false),
                CreatedAt        = t.Column<DateTime>(nullable: false),
                UpdatedAt        = t.Column<DateTime>(nullable: false),
            }, schema: "hospitality",
            constraints: t => t.PrimaryKey("PK_Bookings", x => x.Id));

            mb.CreateTable("HousekeepingTasks", t => new
            {
                Id          = t.Column<Guid>(nullable: false),
                RoomId      = t.Column<Guid>(nullable: false),
                RoomNumber  = t.Column<string>(maxLength: 20,   nullable: false),
                TaskType    = t.Column<string>(maxLength: 50,   nullable: false),
                Priority    = t.Column<string>(maxLength: 20,   nullable: false),
                Status      = t.Column<string>(maxLength: 30,   nullable: false),
                AssignedTo  = t.Column<string>(maxLength: 200,  nullable: true),
                StartedAt   = t.Column<DateTime>(nullable: true),
                CompletedAt = t.Column<DateTime>(nullable: true),
                Notes       = t.Column<string>(maxLength: 1000, nullable: true),
                IsDeleted   = t.Column<bool>(nullable: false, defaultValue: false),
                CreatedAt   = t.Column<DateTime>(nullable: false),
                UpdatedAt   = t.Column<DateTime>(nullable: false),
            }, schema: "hospitality",
            constraints: t => t.PrimaryKey("PK_HousekeepingTasks", x => x.Id));
        }

        protected override void Down(MigrationBuilder mb)
        {
            mb.DropTable("HousekeepingTasks", "hospitality");
            mb.DropTable("Bookings",          "hospitality");
            mb.DropTable("Rooms",             "hospitality");
        }
    }
}
