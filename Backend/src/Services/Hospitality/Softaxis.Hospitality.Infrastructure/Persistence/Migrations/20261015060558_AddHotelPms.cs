using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Hospitality.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddHotelPms : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Notes",
                schema: "hospitality",
                table: "Rooms",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "RoomTypeId",
                schema: "hospitality",
                table: "Rooms",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ActualCheckInAt",
                schema: "hospitality",
                table: "Bookings",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ActualCheckOutAt",
                schema: "hospitality",
                table: "Bookings",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CancelReason",
                schema: "hospitality",
                table: "Bookings",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CancelledAt",
                schema: "hospitality",
                table: "Bookings",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "DiscountAmount",
                schema: "hospitality",
                table: "Bookings",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "DiscountReason",
                schema: "hospitality",
                table: "Bookings",
                type: "nvarchar(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ExtrasTotal",
                schema: "hospitality",
                table: "Bookings",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "FeeAmount",
                schema: "hospitality",
                table: "Bookings",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<Guid>(
                name: "GuestId",
                schema: "hospitality",
                table: "Bookings",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MealPlan",
                schema: "hospitality",
                table: "Bookings",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "NightlyFee",
                schema: "hospitality",
                table: "Bookings",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "Notes",
                schema: "hospitality",
                table: "Bookings",
                type: "nvarchar(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "RatePlanId",
                schema: "hospitality",
                table: "Bookings",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RatePlanName",
                schema: "hospitality",
                table: "Bookings",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "RoomCharge",
                schema: "hospitality",
                table: "Bookings",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<Guid>(
                name: "RoomTypeId",
                schema: "hospitality",
                table: "Bookings",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ServiceAmount",
                schema: "hospitality",
                table: "Bookings",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "ServiceChargePercent",
                schema: "hospitality",
                table: "Bookings",
                type: "decimal(9,3)",
                precision: 9,
                scale: 3,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "TaxAmount",
                schema: "hospitality",
                table: "Bookings",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "TaxPercent",
                schema: "hospitality",
                table: "Bookings",
                type: "decimal(9,3)",
                precision: 9,
                scale: 3,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateTable(
                name: "BookingNights",
                schema: "hospitality",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BookingId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Date = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    Rate = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BookingNights", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FolioCharges",
                schema: "hospitality",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BookingId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Date = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    Category = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Quantity = table.Column<decimal>(type: "decimal(18,3)", precision: 18, scale: 3, nullable: false),
                    UnitPrice = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    PostedBy = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    IsVoided = table.Column<bool>(type: "bit", nullable: false),
                    VoidReason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    VoidedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FolioCharges", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Guests",
                schema: "hospitality",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FullName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Email = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Phone = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Nationality = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    DocumentType = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    DocumentNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    DocumentExpiry = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    DateOfBirth = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    Address = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Company = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    IsVip = table.Column<bool>(type: "bit", nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    StayCount = table.Column<int>(type: "int", nullable: false),
                    TotalSpent = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    LastStayOn = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Guests", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "HotelSettings",
                schema: "hospitality",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PropertyName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    WeekendDays = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    CheckInTime = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: false),
                    CheckOutTime = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: false),
                    TaxPercent = table.Column<decimal>(type: "decimal(9,3)", precision: 9, scale: 3, nullable: false),
                    TaxLabel = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    ServiceChargePercent = table.Column<decimal>(type: "decimal(9,3)", precision: 9, scale: 3, nullable: false),
                    NightlyFee = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    NightlyFeeLabel = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HotelSettings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RatePlans",
                schema: "hospitality",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Code = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    MealPlan = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    IsRefundable = table.Column<bool>(type: "bit", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    IsDefault = table.Column<bool>(type: "bit", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RatePlans", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RoomBlocks",
                schema: "hospitality",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RoomId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RoomNumber = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    FromDate = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    ToDate = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RoomBlocks", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RoomTypes",
                schema: "hospitality",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Code = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Amenities = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    BaseRate = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    MaxAdults = table.Column<int>(type: "int", nullable: false),
                    MaxChildren = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RoomTypes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SeasonalRates",
                schema: "hospitality",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RatePlanId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RoomTypeId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Label = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    FromDate = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    ToDate = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    WeekdayRate = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    WeekendRate = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    MinNights = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SeasonalRates", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Rooms_RoomTypeId",
                schema: "hospitality",
                table: "Rooms",
                column: "RoomTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_Rooms_TenantId_RoomNumber",
                schema: "hospitality",
                table: "Rooms",
                columns: new[] { "TenantId", "RoomNumber" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_Bookings_CheckIn_CheckOut",
                schema: "hospitality",
                table: "Bookings",
                columns: new[] { "CheckIn", "CheckOut" });

            migrationBuilder.CreateIndex(
                name: "IX_Bookings_GuestId",
                schema: "hospitality",
                table: "Bookings",
                column: "GuestId");

            migrationBuilder.CreateIndex(
                name: "IX_Bookings_RoomId",
                schema: "hospitality",
                table: "Bookings",
                column: "RoomId");

            migrationBuilder.CreateIndex(
                name: "IX_BookingNights_BookingId",
                schema: "hospitality",
                table: "BookingNights",
                column: "BookingId");

            migrationBuilder.CreateIndex(
                name: "IX_BookingNights_TenantId",
                schema: "hospitality",
                table: "BookingNights",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_FolioCharges_BookingId",
                schema: "hospitality",
                table: "FolioCharges",
                column: "BookingId");

            migrationBuilder.CreateIndex(
                name: "IX_FolioCharges_TenantId",
                schema: "hospitality",
                table: "FolioCharges",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Guests_Email",
                schema: "hospitality",
                table: "Guests",
                column: "Email");

            migrationBuilder.CreateIndex(
                name: "IX_Guests_Phone",
                schema: "hospitality",
                table: "Guests",
                column: "Phone");

            migrationBuilder.CreateIndex(
                name: "IX_Guests_TenantId",
                schema: "hospitality",
                table: "Guests",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_HotelSettings_TenantId",
                schema: "hospitality",
                table: "HotelSettings",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_RatePlans_TenantId",
                schema: "hospitality",
                table: "RatePlans",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_RatePlans_TenantId_Code",
                schema: "hospitality",
                table: "RatePlans",
                columns: new[] { "TenantId", "Code" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_RoomBlocks_RoomId",
                schema: "hospitality",
                table: "RoomBlocks",
                column: "RoomId");

            migrationBuilder.CreateIndex(
                name: "IX_RoomBlocks_TenantId",
                schema: "hospitality",
                table: "RoomBlocks",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_RoomTypes_TenantId",
                schema: "hospitality",
                table: "RoomTypes",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_RoomTypes_TenantId_Code",
                schema: "hospitality",
                table: "RoomTypes",
                columns: new[] { "TenantId", "Code" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_SeasonalRates_RatePlanId_RoomTypeId",
                schema: "hospitality",
                table: "SeasonalRates",
                columns: new[] { "RatePlanId", "RoomTypeId" });

            migrationBuilder.CreateIndex(
                name: "IX_SeasonalRates_TenantId",
                schema: "hospitality",
                table: "SeasonalRates",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BookingNights",
                schema: "hospitality");

            migrationBuilder.DropTable(
                name: "FolioCharges",
                schema: "hospitality");

            migrationBuilder.DropTable(
                name: "Guests",
                schema: "hospitality");

            migrationBuilder.DropTable(
                name: "HotelSettings",
                schema: "hospitality");

            migrationBuilder.DropTable(
                name: "RatePlans",
                schema: "hospitality");

            migrationBuilder.DropTable(
                name: "RoomBlocks",
                schema: "hospitality");

            migrationBuilder.DropTable(
                name: "RoomTypes",
                schema: "hospitality");

            migrationBuilder.DropTable(
                name: "SeasonalRates",
                schema: "hospitality");

            migrationBuilder.DropIndex(
                name: "IX_Rooms_RoomTypeId",
                schema: "hospitality",
                table: "Rooms");

            migrationBuilder.DropIndex(
                name: "IX_Rooms_TenantId_RoomNumber",
                schema: "hospitality",
                table: "Rooms");

            migrationBuilder.DropIndex(
                name: "IX_Bookings_CheckIn_CheckOut",
                schema: "hospitality",
                table: "Bookings");

            migrationBuilder.DropIndex(
                name: "IX_Bookings_GuestId",
                schema: "hospitality",
                table: "Bookings");

            migrationBuilder.DropIndex(
                name: "IX_Bookings_RoomId",
                schema: "hospitality",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "Notes",
                schema: "hospitality",
                table: "Rooms");

            migrationBuilder.DropColumn(
                name: "RoomTypeId",
                schema: "hospitality",
                table: "Rooms");

            migrationBuilder.DropColumn(
                name: "ActualCheckInAt",
                schema: "hospitality",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "ActualCheckOutAt",
                schema: "hospitality",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "CancelReason",
                schema: "hospitality",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "CancelledAt",
                schema: "hospitality",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "DiscountAmount",
                schema: "hospitality",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "DiscountReason",
                schema: "hospitality",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "ExtrasTotal",
                schema: "hospitality",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "FeeAmount",
                schema: "hospitality",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "GuestId",
                schema: "hospitality",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "MealPlan",
                schema: "hospitality",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "NightlyFee",
                schema: "hospitality",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "Notes",
                schema: "hospitality",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "RatePlanId",
                schema: "hospitality",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "RatePlanName",
                schema: "hospitality",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "RoomCharge",
                schema: "hospitality",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "RoomTypeId",
                schema: "hospitality",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "ServiceAmount",
                schema: "hospitality",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "ServiceChargePercent",
                schema: "hospitality",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "TaxAmount",
                schema: "hospitality",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "TaxPercent",
                schema: "hospitality",
                table: "Bookings");
        }
    }
}
