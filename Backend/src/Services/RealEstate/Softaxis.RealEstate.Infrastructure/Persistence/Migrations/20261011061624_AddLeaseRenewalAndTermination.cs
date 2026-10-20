using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.RealEstate.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLeaseRenewalAndTermination : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "PreviousAnnualRent",
                schema: "real_estate",
                table: "LeaseContracts",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RenewalNumber",
                schema: "real_estate",
                table: "LeaseContracts",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<Guid>(
                name: "RenewedFromContractId",
                schema: "real_estate",
                table: "LeaseContracts",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "RenewedToContractId",
                schema: "real_estate",
                table: "LeaseContracts",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "LeaseTerminations",
                schema: "real_estate",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ContractId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    TerminationDate = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    NoticeDate = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    Reason = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    ReasonNotes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    RentOwed = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    RentPaid = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    DepositHeld = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    PenaltyAmount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    DeductionsAmount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    DeductionNotes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    NetSettlement = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    SettledOn = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    SettlementMethod = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    SettlementReference = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    SettlementNotes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    RecordedByName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    OwnerTenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LeaseTerminations", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LeaseContracts_RenewedFromContractId",
                schema: "real_estate",
                table: "LeaseContracts",
                column: "RenewedFromContractId");

            migrationBuilder.CreateIndex(
                name: "IX_LeaseTerminations_ContractId",
                schema: "real_estate",
                table: "LeaseTerminations",
                column: "ContractId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LeaseTerminations_OwnerTenantId",
                schema: "real_estate",
                table: "LeaseTerminations",
                column: "OwnerTenantId");

            migrationBuilder.CreateIndex(
                name: "IX_LeaseTerminations_Status",
                schema: "real_estate",
                table: "LeaseTerminations",
                column: "Status");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LeaseTerminations",
                schema: "real_estate");

            migrationBuilder.DropIndex(
                name: "IX_LeaseContracts_RenewedFromContractId",
                schema: "real_estate",
                table: "LeaseContracts");

            migrationBuilder.DropColumn(
                name: "PreviousAnnualRent",
                schema: "real_estate",
                table: "LeaseContracts");

            migrationBuilder.DropColumn(
                name: "RenewalNumber",
                schema: "real_estate",
                table: "LeaseContracts");

            migrationBuilder.DropColumn(
                name: "RenewedFromContractId",
                schema: "real_estate",
                table: "LeaseContracts");

            migrationBuilder.DropColumn(
                name: "RenewedToContractId",
                schema: "real_estate",
                table: "LeaseContracts");
        }
    }
}
