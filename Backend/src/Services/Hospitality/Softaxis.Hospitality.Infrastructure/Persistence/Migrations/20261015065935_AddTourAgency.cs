using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Hospitality.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTourAgency : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TourBookings",
                schema: "hospitality",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BookingNumber = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    TourPackageId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    DepartureId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    StartDate = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    EndDate = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    GuestId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CustomerName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    CustomerEmail = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    CustomerPhone = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Adults = table.Column<int>(type: "int", nullable: false),
                    Children = table.Column<int>(type: "int", nullable: false),
                    SingleRooms = table.Column<int>(type: "int", nullable: false),
                    AdultPrice = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    ChildPrice = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    SingleSupplement = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    PackageAmount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    ExtrasAmount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    DiscountAmount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    TaxPercent = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: false),
                    TaxAmount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalAmount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    AmountPaid = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    CostAmount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Source = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    CancelReason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    CreatedByName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TourBookings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TourDepartures",
                schema: "hospitality",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TourPackageId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StartDate = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    EndDate = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    Capacity = table.Column<int>(type: "int", nullable: false),
                    AdultPrice = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    ChildPrice = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TourDepartures", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TourInstalments",
                schema: "hospitality",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TourBookingId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Label = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    DueDate = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TourInstalments", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TourPackages",
                schema: "hospitality",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Code = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Destination = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Category = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    DurationDays = table.Column<int>(type: "int", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: true),
                    Inclusions = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: true),
                    Exclusions = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: true),
                    PricePerAdult = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    PricePerChild = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    SingleSupplement = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TourPackages", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TourPayments",
                schema: "hospitality",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TourBookingId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    Method = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Reference = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    PaidOn = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    ReceivedBy = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    IsVoided = table.Column<bool>(type: "bit", nullable: false),
                    VoidReason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TourPayments", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TourServices",
                schema: "hospitality",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TourBookingId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Type = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    SupplierName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    ServiceDate = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    EndDate = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    ConfirmationNumber = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Cost = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    SupplierPaid = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    IsExtra = table.Column<bool>(type: "bit", nullable: false),
                    SellPrice = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TourServices", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TourTravellers",
                schema: "hospitality",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TourBookingId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FullName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Type = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    Gender = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    DateOfBirth = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    Nationality = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    PassportNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    PassportExpiry = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TourTravellers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TourItineraryDays",
                schema: "hospitality",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TourPackageId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DayNumber = table.Column<int>(type: "int", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: true),
                    Accommodation = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Meals = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TourItineraryDays", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TourItineraryDays_TourPackages_TourPackageId",
                        column: x => x.TourPackageId,
                        principalSchema: "hospitality",
                        principalTable: "TourPackages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TourBookings_DepartureId",
                schema: "hospitality",
                table: "TourBookings",
                column: "DepartureId");

            migrationBuilder.CreateIndex(
                name: "IX_TourBookings_GuestId",
                schema: "hospitality",
                table: "TourBookings",
                column: "GuestId");

            migrationBuilder.CreateIndex(
                name: "IX_TourBookings_StartDate",
                schema: "hospitality",
                table: "TourBookings",
                column: "StartDate");

            migrationBuilder.CreateIndex(
                name: "IX_TourBookings_TenantId",
                schema: "hospitality",
                table: "TourBookings",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_TourBookings_TenantId_BookingNumber",
                schema: "hospitality",
                table: "TourBookings",
                columns: new[] { "TenantId", "BookingNumber" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_TourDepartures_TenantId",
                schema: "hospitality",
                table: "TourDepartures",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_TourDepartures_TourPackageId_StartDate",
                schema: "hospitality",
                table: "TourDepartures",
                columns: new[] { "TourPackageId", "StartDate" });

            migrationBuilder.CreateIndex(
                name: "IX_TourInstalments_TenantId",
                schema: "hospitality",
                table: "TourInstalments",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_TourInstalments_TourBookingId",
                schema: "hospitality",
                table: "TourInstalments",
                column: "TourBookingId");

            migrationBuilder.CreateIndex(
                name: "IX_TourItineraryDays_TenantId",
                schema: "hospitality",
                table: "TourItineraryDays",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_TourItineraryDays_TourPackageId",
                schema: "hospitality",
                table: "TourItineraryDays",
                column: "TourPackageId");

            migrationBuilder.CreateIndex(
                name: "IX_TourPackages_TenantId",
                schema: "hospitality",
                table: "TourPackages",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_TourPackages_TenantId_Code",
                schema: "hospitality",
                table: "TourPackages",
                columns: new[] { "TenantId", "Code" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_TourPayments_TenantId",
                schema: "hospitality",
                table: "TourPayments",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_TourPayments_TourBookingId",
                schema: "hospitality",
                table: "TourPayments",
                column: "TourBookingId");

            migrationBuilder.CreateIndex(
                name: "IX_TourServices_TenantId",
                schema: "hospitality",
                table: "TourServices",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_TourServices_TourBookingId",
                schema: "hospitality",
                table: "TourServices",
                column: "TourBookingId");

            migrationBuilder.CreateIndex(
                name: "IX_TourTravellers_TenantId",
                schema: "hospitality",
                table: "TourTravellers",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_TourTravellers_TourBookingId",
                schema: "hospitality",
                table: "TourTravellers",
                column: "TourBookingId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TourBookings",
                schema: "hospitality");

            migrationBuilder.DropTable(
                name: "TourDepartures",
                schema: "hospitality");

            migrationBuilder.DropTable(
                name: "TourInstalments",
                schema: "hospitality");

            migrationBuilder.DropTable(
                name: "TourItineraryDays",
                schema: "hospitality");

            migrationBuilder.DropTable(
                name: "TourPayments",
                schema: "hospitality");

            migrationBuilder.DropTable(
                name: "TourServices",
                schema: "hospitality");

            migrationBuilder.DropTable(
                name: "TourTravellers",
                schema: "hospitality");

            migrationBuilder.DropTable(
                name: "TourPackages",
                schema: "hospitality");
        }
    }
}
