using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Softaxis.POS.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class SeedExtendedMasterData : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                schema: "pos",
                table: "currencies",
                keyColumn: "Id",
                keyValue: new Guid("a0000001-0000-0000-0000-000000000004"),
                columns: new[] { "ExchangeRate", "Symbol" },
                values: new object[] { 278.50000m, "Rs" });

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "currencies",
                keyColumn: "Id",
                keyValue: new Guid("a0000001-0000-0000-0000-000000000005"),
                column: "Symbol",
                value: "AED");

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "currencies",
                keyColumn: "Id",
                keyValue: new Guid("a0000001-0000-0000-0000-000000000006"),
                column: "Symbol",
                value: "SAR");

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "currencies",
                keyColumn: "Id",
                keyValue: new Guid("a0000001-0000-0000-0000-000000000007"),
                columns: new[] { "ExchangeRate", "Symbol" },
                values: new object[] { 83.100000m, "Rs" });

            migrationBuilder.InsertData(
                schema: "pos",
                table: "currencies",
                columns: new[] { "Id", "Code", "CreatedAt", "CreatedBy", "DeletedAt", "DeletedBy", "ExchangeRate", "IsActive", "IsDefault", "IsDeleted", "IsSystem", "Name", "Symbol", "UpdatedAt", "UpdatedBy" },
                values: new object[,]
                {
                    { new Guid("a0000001-0000-0000-0000-000000000008"), "CAD", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, 1.360000m, false, false, false, true, "Canadian Dollar", "C$", null, null },
                    { new Guid("a0000001-0000-0000-0000-000000000009"), "AUD", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, 1.530000m, false, false, false, true, "Australian Dollar", "A$", null, null },
                    { new Guid("a0000001-0000-0000-0000-00000000000a"), "JPY", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, 149.0000m, false, false, false, true, "Japanese Yen", "JPY", null, null },
                    { new Guid("a0000001-0000-0000-0000-00000000000b"), "QAR", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, 3.640000m, true, false, false, true, "Qatari Riyal", "QAR", null, null },
                    { new Guid("a0000001-0000-0000-0000-00000000000c"), "KWD", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, 0.310000m, true, false, false, true, "Kuwaiti Dinar", "KWD", null, null },
                    { new Guid("a0000001-0000-0000-0000-00000000000d"), "OMR", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, 0.385000m, true, false, false, true, "Omani Rial", "OMR", null, null },
                    { new Guid("a0000001-0000-0000-0000-00000000000e"), "BHD", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, 0.376000m, true, false, false, true, "Bahraini Dinar", "BHD", null, null },
                    { new Guid("a0000001-0000-0000-0000-00000000000f"), "TRY", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, 32.100000m, false, false, false, true, "Turkish Lira", "TRY", null, null },
                    { new Guid("a0000001-0000-0000-0000-000000000010"), "CHF", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, 0.900000m, false, false, false, true, "Swiss Franc", "CHF", null, null },
                    { new Guid("a0000001-0000-0000-0000-000000000011"), "SGD", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, 1.340000m, false, false, false, true, "Singapore Dollar", "SGD", null, null },
                    { new Guid("a0000001-0000-0000-0000-000000000012"), "MYR", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, 4.700000m, false, false, false, true, "Malaysian Ringgit", "MYR", null, null },
                    { new Guid("a0000001-0000-0000-0000-000000000013"), "CNY", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, 7.240000m, false, false, false, true, "Chinese Yuan", "CNY", null, null }
                });

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "customer_groups",
                keyColumn: "Id",
                keyValue: new Guid("a0000004-0000-0000-0000-000000000001"),
                columns: new[] { "Code", "Name" },
                values: new object[] { "WALKIN", "Walk-in" });

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "customer_groups",
                keyColumn: "Id",
                keyValue: new Guid("a0000004-0000-0000-0000-000000000002"),
                columns: new[] { "Code", "Description", "DiscountPercent", "MinPurchase", "Name" },
                values: new object[] { "SILVER", "5% discount, min purchase threshold", 5m, 10000m, "Silver" });

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "customer_groups",
                keyColumn: "Id",
                keyValue: new Guid("a0000004-0000-0000-0000-000000000003"),
                columns: new[] { "Code", "Description", "DiscountPercent", "MinPurchase", "Name" },
                values: new object[] { "GOLD", "10% discount, mid-tier loyalty", 10m, 50000m, "Gold" });

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "customer_groups",
                keyColumn: "Id",
                keyValue: new Guid("a0000004-0000-0000-0000-000000000004"),
                columns: new[] { "Code", "Description", "DiscountPercent", "MinPurchase", "Name" },
                values: new object[] { "PLATINUM", "15% discount, premium loyalty tier", 15m, 100000m, "Platinum" });

            migrationBuilder.InsertData(
                schema: "pos",
                table: "customer_groups",
                columns: new[] { "Id", "Code", "CreatedAt", "CreatedBy", "DeletedAt", "DeletedBy", "Description", "DiscountPercent", "IsActive", "IsDefault", "IsDeleted", "IsSystem", "MinPurchase", "Name", "UpdatedAt", "UpdatedBy" },
                values: new object[,]
                {
                    { new Guid("a0000004-0000-0000-0000-000000000005"), "WHOLESALE", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, "Wholesale bulk purchasers, 20% discount", 20m, true, false, false, true, 0m, "Wholesale", null, null },
                    { new Guid("a0000004-0000-0000-0000-000000000006"), "STAFF", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, "Employee purchase discount, 25% off", 25m, true, false, false, true, 0m, "Staff", null, null },
                    { new Guid("a0000004-0000-0000-0000-000000000007"), "CORPORATE", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, "Corporate accounts, negotiated rate", 20m, true, false, false, true, 25000m, "Corporate", null, null }
                });

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "payment_terms",
                keyColumn: "Id",
                keyValue: new Guid("a0000003-0000-0000-0000-000000000002"),
                columns: new[] { "Code", "DaysNet", "Description", "Name" },
                values: new object[] { "COD", 0, "Full payment collected on delivery", "Cash on Delivery" });

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "payment_terms",
                keyColumn: "Id",
                keyValue: new Guid("a0000003-0000-0000-0000-000000000003"),
                columns: new[] { "AdvancePercent", "Code", "DaysNet", "Description", "Name" },
                values: new object[] { 100m, "PRE", 0, "Full prepayment required before dispatch", "Prepaid" });

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "payment_terms",
                keyColumn: "Id",
                keyValue: new Guid("a0000003-0000-0000-0000-000000000004"),
                columns: new[] { "Code", "DaysNet", "Description", "Name" },
                values: new object[] { "NET15", 15, "Payment due within 15 days of invoice", "Net 15" });

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "payment_terms",
                keyColumn: "Id",
                keyValue: new Guid("a0000003-0000-0000-0000-000000000005"),
                columns: new[] { "AdvancePercent", "Code", "Description", "Name" },
                values: new object[] { 0m, "NET30", "Payment due within 30 days of invoice", "Net 30" });

            migrationBuilder.InsertData(
                schema: "pos",
                table: "payment_terms",
                columns: new[] { "Id", "AdvancePercent", "Code", "CreatedAt", "CreatedBy", "DaysNet", "DeletedAt", "DeletedBy", "Description", "IsDefault", "IsDeleted", "IsSystem", "Name", "UpdatedAt", "UpdatedBy" },
                values: new object[,]
                {
                    { new Guid("a0000003-0000-0000-0000-000000000006"), 0m, "NET45", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", 45, null, null, "Payment due within 45 days of invoice", false, false, true, "Net 45", null, null },
                    { new Guid("a0000003-0000-0000-0000-000000000007"), 0m, "NET60", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", 60, null, null, "Payment due within 60 days of invoice", false, false, true, "Net 60", null, null },
                    { new Guid("a0000003-0000-0000-0000-000000000008"), 0m, "NET90", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", 90, null, null, "Payment due within 90 days of invoice", false, false, true, "Net 90", null, null },
                    { new Guid("a0000003-0000-0000-0000-000000000009"), 30m, "ADV30", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", 30, null, null, "30% advance required, balance within 30 days", false, false, true, "30% Advance", null, null },
                    { new Guid("a0000003-0000-0000-0000-00000000000a"), 50m, "ADV50", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", 30, null, null, "50% advance required, balance within 30 days", false, false, true, "50% Advance", null, null },
                    { new Guid("a0000003-0000-0000-0000-00000000000b"), 0m, "2NET30", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", 30, null, null, "2% discount if paid within 10 days, else Net 30", false, false, true, "2/10 Net 30", null, null }
                });

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "tax_rates",
                keyColumn: "Id",
                keyValue: new Guid("a0000002-0000-0000-0000-000000000001"),
                column: "Description",
                value: "No tax applies — zero-rated");

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "tax_rates",
                keyColumn: "Id",
                keyValue: new Guid("a0000002-0000-0000-0000-000000000004"),
                columns: new[] { "AppliesTo", "Code", "Description", "Name" },
                values: new object[] { "goods", "GST5", "Reduced rate for essential goods (PK)", "Pakistan GST 5%" });

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "tax_rates",
                keyColumn: "Id",
                keyValue: new Guid("a0000002-0000-0000-0000-000000000005"),
                columns: new[] { "Code", "Description", "Name", "Rate" },
                values: new object[] { "VAT5AE", "UAE Federal VAT", "UAE VAT 5%", 5.00m });

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "tax_rates",
                keyColumn: "Id",
                keyValue: new Guid("a0000002-0000-0000-0000-000000000006"),
                columns: new[] { "Code", "Description", "Name", "Rate" },
                values: new object[] { "VAT15SA", "Saudi Arabia VAT (post-2020)", "Saudi VAT 15%", 15.00m });

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "tax_rates",
                keyColumn: "Id",
                keyValue: new Guid("a0000002-0000-0000-0000-000000000007"),
                columns: new[] { "AppliesTo", "Code", "Description", "Name", "Rate" },
                values: new object[] { "all", "GST18IN", "India GST — standard rate", "India GST 18%", 18.00m });

            migrationBuilder.InsertData(
                schema: "pos",
                table: "tax_rates",
                columns: new[] { "Id", "AppliesTo", "Code", "CreatedAt", "CreatedBy", "DeletedAt", "DeletedBy", "Description", "IsActive", "IsDefault", "IsDeleted", "IsSystem", "Name", "Rate", "UpdatedAt", "UpdatedBy" },
                values: new object[,]
                {
                    { new Guid("a0000002-0000-0000-0000-000000000008"), "goods", "GST5IN", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, "India GST — reduced rate", false, false, false, true, "India GST 5%", 5.00m, null, null },
                    { new Guid("a0000002-0000-0000-0000-000000000009"), "all", "UK20", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, "UK standard VAT 20%", true, false, false, true, "UK Standard VAT", 20.00m, null, null },
                    { new Guid("a0000002-0000-0000-0000-00000000000a"), "all", "UK5", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, "UK reduced VAT 5%", true, false, false, true, "UK Reduced VAT", 5.00m, null, null },
                    { new Guid("a0000002-0000-0000-0000-00000000000b"), "all", "EU20", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, "EU typical standard rate", false, false, false, true, "EU Standard VAT", 20.00m, null, null }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "pos",
                table: "currencies",
                keyColumn: "Id",
                keyValue: new Guid("a0000001-0000-0000-0000-000000000008"));

            migrationBuilder.DeleteData(
                schema: "pos",
                table: "currencies",
                keyColumn: "Id",
                keyValue: new Guid("a0000001-0000-0000-0000-000000000009"));

            migrationBuilder.DeleteData(
                schema: "pos",
                table: "currencies",
                keyColumn: "Id",
                keyValue: new Guid("a0000001-0000-0000-0000-00000000000a"));

            migrationBuilder.DeleteData(
                schema: "pos",
                table: "currencies",
                keyColumn: "Id",
                keyValue: new Guid("a0000001-0000-0000-0000-00000000000b"));

            migrationBuilder.DeleteData(
                schema: "pos",
                table: "currencies",
                keyColumn: "Id",
                keyValue: new Guid("a0000001-0000-0000-0000-00000000000c"));

            migrationBuilder.DeleteData(
                schema: "pos",
                table: "currencies",
                keyColumn: "Id",
                keyValue: new Guid("a0000001-0000-0000-0000-00000000000d"));

            migrationBuilder.DeleteData(
                schema: "pos",
                table: "currencies",
                keyColumn: "Id",
                keyValue: new Guid("a0000001-0000-0000-0000-00000000000e"));

            migrationBuilder.DeleteData(
                schema: "pos",
                table: "currencies",
                keyColumn: "Id",
                keyValue: new Guid("a0000001-0000-0000-0000-00000000000f"));

            migrationBuilder.DeleteData(
                schema: "pos",
                table: "currencies",
                keyColumn: "Id",
                keyValue: new Guid("a0000001-0000-0000-0000-000000000010"));

            migrationBuilder.DeleteData(
                schema: "pos",
                table: "currencies",
                keyColumn: "Id",
                keyValue: new Guid("a0000001-0000-0000-0000-000000000011"));

            migrationBuilder.DeleteData(
                schema: "pos",
                table: "currencies",
                keyColumn: "Id",
                keyValue: new Guid("a0000001-0000-0000-0000-000000000012"));

            migrationBuilder.DeleteData(
                schema: "pos",
                table: "currencies",
                keyColumn: "Id",
                keyValue: new Guid("a0000001-0000-0000-0000-000000000013"));

            migrationBuilder.DeleteData(
                schema: "pos",
                table: "customer_groups",
                keyColumn: "Id",
                keyValue: new Guid("a0000004-0000-0000-0000-000000000005"));

            migrationBuilder.DeleteData(
                schema: "pos",
                table: "customer_groups",
                keyColumn: "Id",
                keyValue: new Guid("a0000004-0000-0000-0000-000000000006"));

            migrationBuilder.DeleteData(
                schema: "pos",
                table: "customer_groups",
                keyColumn: "Id",
                keyValue: new Guid("a0000004-0000-0000-0000-000000000007"));

            migrationBuilder.DeleteData(
                schema: "pos",
                table: "payment_terms",
                keyColumn: "Id",
                keyValue: new Guid("a0000003-0000-0000-0000-000000000006"));

            migrationBuilder.DeleteData(
                schema: "pos",
                table: "payment_terms",
                keyColumn: "Id",
                keyValue: new Guid("a0000003-0000-0000-0000-000000000007"));

            migrationBuilder.DeleteData(
                schema: "pos",
                table: "payment_terms",
                keyColumn: "Id",
                keyValue: new Guid("a0000003-0000-0000-0000-000000000008"));

            migrationBuilder.DeleteData(
                schema: "pos",
                table: "payment_terms",
                keyColumn: "Id",
                keyValue: new Guid("a0000003-0000-0000-0000-000000000009"));

            migrationBuilder.DeleteData(
                schema: "pos",
                table: "payment_terms",
                keyColumn: "Id",
                keyValue: new Guid("a0000003-0000-0000-0000-00000000000a"));

            migrationBuilder.DeleteData(
                schema: "pos",
                table: "payment_terms",
                keyColumn: "Id",
                keyValue: new Guid("a0000003-0000-0000-0000-00000000000b"));

            migrationBuilder.DeleteData(
                schema: "pos",
                table: "tax_rates",
                keyColumn: "Id",
                keyValue: new Guid("a0000002-0000-0000-0000-000000000008"));

            migrationBuilder.DeleteData(
                schema: "pos",
                table: "tax_rates",
                keyColumn: "Id",
                keyValue: new Guid("a0000002-0000-0000-0000-000000000009"));

            migrationBuilder.DeleteData(
                schema: "pos",
                table: "tax_rates",
                keyColumn: "Id",
                keyValue: new Guid("a0000002-0000-0000-0000-00000000000a"));

            migrationBuilder.DeleteData(
                schema: "pos",
                table: "tax_rates",
                keyColumn: "Id",
                keyValue: new Guid("a0000002-0000-0000-0000-00000000000b"));

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "currencies",
                keyColumn: "Id",
                keyValue: new Guid("a0000001-0000-0000-0000-000000000004"),
                columns: new[] { "ExchangeRate", "Symbol" },
                values: new object[] { 278.00000m, "₨" });

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "currencies",
                keyColumn: "Id",
                keyValue: new Guid("a0000001-0000-0000-0000-000000000005"),
                column: "Symbol",
                value: "د.إ");

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "currencies",
                keyColumn: "Id",
                keyValue: new Guid("a0000001-0000-0000-0000-000000000006"),
                column: "Symbol",
                value: "ر.س");

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "currencies",
                keyColumn: "Id",
                keyValue: new Guid("a0000001-0000-0000-0000-000000000007"),
                columns: new[] { "ExchangeRate", "Symbol" },
                values: new object[] { 83.500000m, "₹" });

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "customer_groups",
                keyColumn: "Id",
                keyValue: new Guid("a0000004-0000-0000-0000-000000000001"),
                columns: new[] { "Code", "Name" },
                values: new object[] { "RETAIL", "Retail" });

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "customer_groups",
                keyColumn: "Id",
                keyValue: new Guid("a0000004-0000-0000-0000-000000000002"),
                columns: new[] { "Code", "Description", "DiscountPercent", "MinPurchase", "Name" },
                values: new object[] { "WHOLESALE", "Bulk purchasers, 10% blanket discount", 10m, 5000m, "Wholesale" });

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "customer_groups",
                keyColumn: "Id",
                keyValue: new Guid("a0000004-0000-0000-0000-000000000003"),
                columns: new[] { "Code", "Description", "DiscountPercent", "MinPurchase", "Name" },
                values: new object[] { "VIP", "Loyalty VIP tier, 15% discount", 15m, 10000m, "VIP" });

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "customer_groups",
                keyColumn: "Id",
                keyValue: new Guid("a0000004-0000-0000-0000-000000000004"),
                columns: new[] { "Code", "Description", "DiscountPercent", "MinPurchase", "Name" },
                values: new object[] { "CORPORATE", "Corporate accounts, 20% discount", 20m, 25000m, "Corporate" });

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "payment_terms",
                keyColumn: "Id",
                keyValue: new Guid("a0000003-0000-0000-0000-000000000002"),
                columns: new[] { "Code", "DaysNet", "Description", "Name" },
                values: new object[] { "NET15", 15, "Payment due within 15 days", "Net 15" });

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "payment_terms",
                keyColumn: "Id",
                keyValue: new Guid("a0000003-0000-0000-0000-000000000003"),
                columns: new[] { "AdvancePercent", "Code", "DaysNet", "Description", "Name" },
                values: new object[] { 0m, "NET30", 30, "Payment due within 30 days", "Net 30" });

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "payment_terms",
                keyColumn: "Id",
                keyValue: new Guid("a0000003-0000-0000-0000-000000000004"),
                columns: new[] { "Code", "DaysNet", "Description", "Name" },
                values: new object[] { "NET60", 60, "Payment due within 60 days", "Net 60" });

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "payment_terms",
                keyColumn: "Id",
                keyValue: new Guid("a0000003-0000-0000-0000-000000000005"),
                columns: new[] { "AdvancePercent", "Code", "Description", "Name" },
                values: new object[] { 50m, "ADV50", "50% advance required, balance Net 30", "50% Advance" });

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "tax_rates",
                keyColumn: "Id",
                keyValue: new Guid("a0000002-0000-0000-0000-000000000001"),
                column: "Description",
                value: "No tax applies");

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "tax_rates",
                keyColumn: "Id",
                keyValue: new Guid("a0000002-0000-0000-0000-000000000004"),
                columns: new[] { "AppliesTo", "Code", "Description", "Name" },
                values: new object[] { "all", "VAT5AE", "UAE Federal VAT", "UAE VAT 5%" });

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "tax_rates",
                keyColumn: "Id",
                keyValue: new Guid("a0000002-0000-0000-0000-000000000005"),
                columns: new[] { "Code", "Description", "Name", "Rate" },
                values: new object[] { "VAT15SA", "Saudi Arabia VAT (post-2020)", "Saudi VAT 15%", 15.00m });

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "tax_rates",
                keyColumn: "Id",
                keyValue: new Guid("a0000002-0000-0000-0000-000000000006"),
                columns: new[] { "Code", "Description", "Name", "Rate" },
                values: new object[] { "GST18IN", "India GST — standard rate", "India GST 18%", 18.00m });

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "tax_rates",
                keyColumn: "Id",
                keyValue: new Guid("a0000002-0000-0000-0000-000000000007"),
                columns: new[] { "AppliesTo", "Code", "Description", "Name", "Rate" },
                values: new object[] { "goods", "RVAT5", "Reduced rate for essential goods", "Reduced VAT 5%", 5.00m });
        }
    }
}
