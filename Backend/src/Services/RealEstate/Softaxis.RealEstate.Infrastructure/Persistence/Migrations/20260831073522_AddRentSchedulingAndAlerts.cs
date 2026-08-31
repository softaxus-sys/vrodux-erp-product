using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.RealEstate.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddRentSchedulingAndAlerts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PaymentFrequency",
                schema: "real_estate",
                table: "LeaseContracts",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "annual");

            migrationBuilder.CreateTable(
                name: "RentAlertLogs",
                schema: "real_estate",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ContractId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    InstallmentId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Kind = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    OffsetKey = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    ToEmail = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: false),
                    CcEmails = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    Sent = table.Column<bool>(type: "bit", nullable: false),
                    FailureReason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    OwnerTenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RentAlertLogs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RentAlertSettings",
                schema: "real_estate",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Enabled = table.Column<bool>(type: "bit", nullable: false),
                    DueReminderDaysBefore = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    OverdueRepeatDays = table.Column<int>(type: "int", nullable: false),
                    OverdueMaxReminders = table.Column<int>(type: "int", nullable: false),
                    ExpiryReminderDaysBefore = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    CcEmails = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    CcAllRealEstateUsers = table.Column<bool>(type: "bit", nullable: false),
                    TimeZoneId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    OwnerTenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RentAlertSettings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RentInstallments",
                schema: "real_estate",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ContractId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    InstallmentNumber = table.Column<int>(type: "int", nullable: false),
                    DueDate = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    AmountPaid = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    PaidDate = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    PaymentMethod = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Reference = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    OwnerTenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RentInstallments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RentInstallments_LeaseContracts_ContractId",
                        column: x => x.ContractId,
                        principalSchema: "real_estate",
                        principalTable: "LeaseContracts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RentAlertLogs_ContractId",
                schema: "real_estate",
                table: "RentAlertLogs",
                column: "ContractId");

            migrationBuilder.CreateIndex(
                name: "IX_RentAlertLogs_OwnerTenantId",
                schema: "real_estate",
                table: "RentAlertLogs",
                column: "OwnerTenantId");

            migrationBuilder.CreateIndex(
                name: "IX_RentAlertLogs_OwnerTenantId_ContractId_InstallmentId_Kind_OffsetKey",
                schema: "real_estate",
                table: "RentAlertLogs",
                columns: new[] { "OwnerTenantId", "ContractId", "InstallmentId", "Kind", "OffsetKey" },
                unique: true,
                filter: "[OwnerTenantId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_RentAlertSettings_OwnerTenantId",
                schema: "real_estate",
                table: "RentAlertSettings",
                column: "OwnerTenantId",
                unique: true,
                filter: "[OwnerTenantId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_RentInstallments_ContractId",
                schema: "real_estate",
                table: "RentInstallments",
                column: "ContractId");

            migrationBuilder.CreateIndex(
                name: "IX_RentInstallments_DueDate_Status",
                schema: "real_estate",
                table: "RentInstallments",
                columns: new[] { "DueDate", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_RentInstallments_OwnerTenantId",
                schema: "real_estate",
                table: "RentInstallments",
                column: "OwnerTenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RentAlertLogs",
                schema: "real_estate");

            migrationBuilder.DropTable(
                name: "RentAlertSettings",
                schema: "real_estate");

            migrationBuilder.DropTable(
                name: "RentInstallments",
                schema: "real_estate");

            migrationBuilder.DropColumn(
                name: "PaymentFrequency",
                schema: "real_estate",
                table: "LeaseContracts");
        }
    }
}
