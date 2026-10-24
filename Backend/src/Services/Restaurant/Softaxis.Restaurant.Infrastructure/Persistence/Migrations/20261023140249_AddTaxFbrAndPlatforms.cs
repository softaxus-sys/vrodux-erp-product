using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Restaurant.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTaxFbrAndPlatforms : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ExternalOrderCode",
                schema: "restaurant",
                table: "Orders",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExternalOrderId",
                schema: "restaurant",
                table: "Orders",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExternalSource",
                schema: "restaurant",
                table: "Orders",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExternalStatus",
                schema: "restaurant",
                table: "Orders",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExternalToken",
                schema: "restaurant",
                table: "Orders",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "FbrAttempts",
                schema: "restaurant",
                table: "Orders",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "FbrError",
                schema: "restaurant",
                table: "Orders",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FbrInvoiceNumber",
                schema: "restaurant",
                table: "Orders",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "FbrSentAt",
                schema: "restaurant",
                table: "Orders",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FbrStatus",
                schema: "restaurant",
                table: "Orders",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ServiceFee",
                schema: "restaurant",
                table: "Orders",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "TaxLabel",
                schema: "restaurant",
                table: "Orders",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Tax");

            migrationBuilder.AddColumn<decimal>(
                name: "TaxRate",
                schema: "restaurant",
                table: "Orders",
                type: "decimal(5,2)",
                precision: 5,
                scale: 2,
                nullable: false,
                defaultValue: 5m);   // what every earlier bill was charged

            migrationBuilder.CreateTable(
                name: "PlatformConnections",
                schema: "restaurant",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Platform = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Environment = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    BranchId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RemoteId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    InboundKey = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Username = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    PasswordEncrypted = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    PluginSecretEncrypted = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    AutoAccept = table.Column<bool>(type: "bit", nullable: false),
                    DefaultPrepMinutes = table.Column<int>(type: "int", nullable: false),
                    IsEnabled = table.Column<bool>(type: "bit", nullable: false),
                    LastOrderAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastError = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlatformConnections", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TaxProfiles",
                schema: "restaurant",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BranchId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CountryCode = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: false),
                    RegionCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    TaxLabel = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    RatePercent = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: false),
                    FbrEnabled = table.Column<bool>(type: "bit", nullable: false),
                    FbrEnvironment = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    FbrPosId = table.Column<int>(type: "int", nullable: true),
                    FbrTokenEncrypted = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    FbrServiceFee = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    FbrPctCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TaxProfiles", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Orders_ExternalSource_ExternalOrderId",
                schema: "restaurant",
                table: "Orders",
                columns: new[] { "ExternalSource", "ExternalOrderId" });

            migrationBuilder.CreateIndex(
                name: "IX_Orders_FbrStatus",
                schema: "restaurant",
                table: "Orders",
                column: "FbrStatus");

            migrationBuilder.CreateIndex(
                name: "IX_PlatformConnections_BranchId",
                schema: "restaurant",
                table: "PlatformConnections",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_PlatformConnections_InboundKey",
                schema: "restaurant",
                table: "PlatformConnections",
                column: "InboundKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PlatformConnections_TenantId",
                schema: "restaurant",
                table: "PlatformConnections",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_TaxProfiles_BranchId",
                schema: "restaurant",
                table: "TaxProfiles",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_TaxProfiles_TenantId",
                schema: "restaurant",
                table: "TaxProfiles",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PlatformConnections",
                schema: "restaurant");

            migrationBuilder.DropTable(
                name: "TaxProfiles",
                schema: "restaurant");

            migrationBuilder.DropIndex(
                name: "IX_Orders_ExternalSource_ExternalOrderId",
                schema: "restaurant",
                table: "Orders");

            migrationBuilder.DropIndex(
                name: "IX_Orders_FbrStatus",
                schema: "restaurant",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "ExternalOrderCode",
                schema: "restaurant",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "ExternalOrderId",
                schema: "restaurant",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "ExternalSource",
                schema: "restaurant",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "ExternalStatus",
                schema: "restaurant",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "ExternalToken",
                schema: "restaurant",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "FbrAttempts",
                schema: "restaurant",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "FbrError",
                schema: "restaurant",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "FbrInvoiceNumber",
                schema: "restaurant",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "FbrSentAt",
                schema: "restaurant",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "FbrStatus",
                schema: "restaurant",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "ServiceFee",
                schema: "restaurant",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "TaxLabel",
                schema: "restaurant",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "TaxRate",
                schema: "restaurant",
                table: "Orders");
        }
    }
}
