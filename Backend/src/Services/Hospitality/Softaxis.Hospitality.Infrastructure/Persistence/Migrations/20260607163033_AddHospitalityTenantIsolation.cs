using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Hospitality.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddHospitalityTenantIsolation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "hospitality");

            migrationBuilder.DropTable(name: "Bookings", schema: "hospitality");
            migrationBuilder.DropTable(name: "HousekeepingTasks", schema: "hospitality");
            migrationBuilder.DropTable(name: "Rooms", schema: "hospitality");

            migrationBuilder.CreateTable(
                name: "Bookings",
                schema: "hospitality",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BookingNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    RoomId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RoomNumber = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    RoomType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    GuestName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    GuestEmail = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    GuestPhone = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    GuestNationality = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    CheckIn = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    CheckOut = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Nights = table.Column<int>(type: "int", nullable: false),
                    Adults = table.Column<int>(type: "int", nullable: false),
                    Children = table.Column<int>(type: "int", nullable: false),
                    RatePerNight = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalAmount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    PaidAmount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Source = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    SpecialRequests = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Bookings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "HousekeepingTasks",
                schema: "hospitality",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RoomId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RoomNumber = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    TaskType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Priority = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    AssignedTo = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    StartedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HousekeepingTasks", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Rooms",
                schema: "hospitality",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RoomNumber = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    RoomType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Floor = table.Column<int>(type: "int", nullable: false),
                    Capacity = table.Column<int>(type: "int", nullable: false),
                    RatePerNight = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    HousekeepingStatus = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    CurrentGuestName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    CurrentBookingId = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    View = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    HasBalcony = table.Column<bool>(type: "bit", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Rooms", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Bookings_TenantId",
                schema: "hospitality",
                table: "Bookings",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_HousekeepingTasks_TenantId",
                schema: "hospitality",
                table: "HousekeepingTasks",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Rooms_TenantId",
                schema: "hospitality",
                table: "Rooms",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Bookings",
                schema: "hospitality");

            migrationBuilder.DropTable(
                name: "HousekeepingTasks",
                schema: "hospitality");

            migrationBuilder.DropTable(
                name: "Rooms",
                schema: "hospitality");
        }
    }
}
