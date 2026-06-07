using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Softaxis.POS.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddMasterDataTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "currencies",
                schema: "pos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Code = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Symbol = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    ExchangeRate = table.Column<decimal>(type: "decimal(18,6)", precision: 18, scale: 6, nullable: false),
                    IsDefault = table.Column<bool>(type: "bit", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    IsSystem = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    DeletedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_currencies", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "customer_groups",
                schema: "pos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Code = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    DiscountPercent = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: false),
                    MinPurchase = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    IsDefault = table.Column<bool>(type: "bit", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    IsSystem = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    DeletedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_customer_groups", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "payment_terms",
                schema: "pos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Code = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    DaysNet = table.Column<int>(type: "int", nullable: false),
                    AdvancePercent = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    IsDefault = table.Column<bool>(type: "bit", nullable: false),
                    IsSystem = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    DeletedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payment_terms", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "tax_rates",
                schema: "pos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Code = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Rate = table.Column<decimal>(type: "decimal(8,4)", precision: 8, scale: 4, nullable: false),
                    AppliesTo = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    IsDefault = table.Column<bool>(type: "bit", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    IsSystem = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    DeletedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tax_rates", x => x.Id);
                });

            migrationBuilder.InsertData(
                schema: "pos",
                table: "currencies",
                columns: new[] { "Id", "Code", "CreatedAt", "CreatedBy", "DeletedAt", "DeletedBy", "ExchangeRate", "IsActive", "IsDefault", "IsDeleted", "IsSystem", "Name", "Symbol", "UpdatedAt", "UpdatedBy" },
                values: new object[,]
                {
                    { new Guid("a0000001-0000-0000-0000-000000000001"), "USD", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, 1.000000m, true, true, false, true, "US Dollar", "$", null, null },
                    { new Guid("a0000001-0000-0000-0000-000000000002"), "EUR", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, 0.920000m, true, false, false, true, "Euro", "€", null, null },
                    { new Guid("a0000001-0000-0000-0000-000000000003"), "GBP", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, 0.790000m, true, false, false, true, "British Pound", "£", null, null },
                    { new Guid("a0000001-0000-0000-0000-000000000004"), "PKR", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, 278.00000m, true, false, false, true, "Pakistani Rupee", "₨", null, null },
                    { new Guid("a0000001-0000-0000-0000-000000000005"), "AED", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, 3.670000m, true, false, false, true, "UAE Dirham", "د.إ", null, null },
                    { new Guid("a0000001-0000-0000-0000-000000000006"), "SAR", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, 3.750000m, true, false, false, true, "Saudi Riyal", "ر.س", null, null },
                    { new Guid("a0000001-0000-0000-0000-000000000007"), "INR", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, 83.500000m, true, false, false, true, "Indian Rupee", "₹", null, null }
                });

            migrationBuilder.InsertData(
                schema: "pos",
                table: "customer_groups",
                columns: new[] { "Id", "Code", "CreatedAt", "CreatedBy", "DeletedAt", "DeletedBy", "Description", "DiscountPercent", "IsActive", "IsDefault", "IsDeleted", "IsSystem", "MinPurchase", "Name", "UpdatedAt", "UpdatedBy" },
                values: new object[,]
                {
                    { new Guid("a0000004-0000-0000-0000-000000000001"), "RETAIL", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, "Standard walk-in customer", 0m, true, true, false, true, 0m, "Retail", null, null },
                    { new Guid("a0000004-0000-0000-0000-000000000002"), "WHOLESALE", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, "Bulk purchasers, 10% blanket discount", 10m, true, false, false, true, 5000m, "Wholesale", null, null },
                    { new Guid("a0000004-0000-0000-0000-000000000003"), "VIP", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, "Loyalty VIP tier, 15% discount", 15m, true, false, false, true, 10000m, "VIP", null, null },
                    { new Guid("a0000004-0000-0000-0000-000000000004"), "CORPORATE", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, "Corporate accounts, 20% discount", 20m, true, false, false, true, 25000m, "Corporate", null, null }
                });

            migrationBuilder.InsertData(
                schema: "pos",
                table: "payment_terms",
                columns: new[] { "Id", "AdvancePercent", "Code", "CreatedAt", "CreatedBy", "DaysNet", "DeletedAt", "DeletedBy", "Description", "IsDefault", "IsDeleted", "IsSystem", "Name", "UpdatedAt", "UpdatedBy" },
                values: new object[,]
                {
                    { new Guid("a0000003-0000-0000-0000-000000000001"), 0m, "IMMEDIATE", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", 0, null, null, "Payment due immediately on invoice", true, false, true, "Immediate", null, null },
                    { new Guid("a0000003-0000-0000-0000-000000000002"), 0m, "NET15", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", 15, null, null, "Payment due within 15 days", false, false, true, "Net 15", null, null },
                    { new Guid("a0000003-0000-0000-0000-000000000003"), 0m, "NET30", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", 30, null, null, "Payment due within 30 days", false, false, true, "Net 30", null, null },
                    { new Guid("a0000003-0000-0000-0000-000000000004"), 0m, "NET60", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", 60, null, null, "Payment due within 60 days", false, false, true, "Net 60", null, null },
                    { new Guid("a0000003-0000-0000-0000-000000000005"), 50m, "ADV50", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", 30, null, null, "50% advance required, balance Net 30", false, false, true, "50% Advance", null, null }
                });

            migrationBuilder.InsertData(
                schema: "pos",
                table: "tax_rates",
                columns: new[] { "Id", "AppliesTo", "Code", "CreatedAt", "CreatedBy", "DeletedAt", "DeletedBy", "Description", "IsActive", "IsDefault", "IsDeleted", "IsSystem", "Name", "Rate", "UpdatedAt", "UpdatedBy" },
                values: new object[,]
                {
                    { new Guid("a0000002-0000-0000-0000-000000000001"), "all", "EXEMPT", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, "No tax applies", true, true, false, true, "Tax Exempt", 0.00m, null, null },
                    { new Guid("a0000002-0000-0000-0000-000000000002"), "all", "VAT15", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, "Standard VAT — common global rate", true, false, false, true, "Standard VAT 15%", 15.00m, null, null },
                    { new Guid("a0000002-0000-0000-0000-000000000003"), "goods", "GST17", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, "Pakistan general sales tax", true, false, false, true, "Pakistan GST 17%", 17.00m, null, null },
                    { new Guid("a0000002-0000-0000-0000-000000000004"), "all", "VAT5AE", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, "UAE Federal VAT", true, false, false, true, "UAE VAT 5%", 5.00m, null, null },
                    { new Guid("a0000002-0000-0000-0000-000000000005"), "all", "VAT15SA", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, "Saudi Arabia VAT (post-2020)", true, false, false, true, "Saudi VAT 15%", 15.00m, null, null },
                    { new Guid("a0000002-0000-0000-0000-000000000006"), "all", "GST18IN", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, "India GST — standard rate", true, false, false, true, "India GST 18%", 18.00m, null, null },
                    { new Guid("a0000002-0000-0000-0000-000000000007"), "goods", "RVAT5", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, "Reduced rate for essential goods", true, false, false, true, "Reduced VAT 5%", 5.00m, null, null }
                });

            migrationBuilder.CreateIndex(
                name: "IX_currencies_Code",
                schema: "pos",
                table: "currencies",
                column: "Code",
                unique: true,
                filter: "[IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_customer_groups_Code",
                schema: "pos",
                table: "customer_groups",
                column: "Code",
                unique: true,
                filter: "[IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_payment_terms_Code",
                schema: "pos",
                table: "payment_terms",
                column: "Code",
                unique: true,
                filter: "[IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_tax_rates_Code",
                schema: "pos",
                table: "tax_rates",
                column: "Code",
                unique: true,
                filter: "[IsDeleted] = 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "currencies",
                schema: "pos");

            migrationBuilder.DropTable(
                name: "customer_groups",
                schema: "pos");

            migrationBuilder.DropTable(
                name: "payment_terms",
                schema: "pos");

            migrationBuilder.DropTable(
                name: "tax_rates",
                schema: "pos");
        }
    }
}
