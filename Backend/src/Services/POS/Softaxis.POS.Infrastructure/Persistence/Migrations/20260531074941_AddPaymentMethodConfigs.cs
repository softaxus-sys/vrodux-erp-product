using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Softaxis.POS.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPaymentMethodConfigs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "payment_method_configs",
                schema: "pos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Code = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    Label = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    IconKey = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: false),
                    Countries = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    IsEnabled = table.Column<bool>(type: "bit", nullable: false),
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
                    table.PrimaryKey("PK_payment_method_configs", x => x.Id);
                });

            migrationBuilder.InsertData(
                schema: "pos",
                table: "payment_method_configs",
                columns: new[] { "Id", "Code", "Countries", "CreatedAt", "CreatedBy", "DeletedAt", "DeletedBy", "Description", "IconKey", "IsDeleted", "IsEnabled", "IsSystem", "Label", "SortOrder", "UpdatedAt", "UpdatedBy" },
                values: new object[,]
                {
                    { new Guid("b0000001-0000-0000-0000-000000000001"), "Cash", "*", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, "Physical cash payment", "banknote", false, true, true, "Cash", 1, null, null },
                    { new Guid("b0000001-0000-0000-0000-000000000002"), "Card", "*", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, "Visa / Mastercard / Amex / Debit", "credit-card", false, true, true, "Card", 2, null, null },
                    { new Guid("b0000001-0000-0000-0000-000000000003"), "BankTransfer", "*", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, "Wire / SWIFT / IBAN / SEPA", "landmark", false, false, true, "Bank Transfer", 90, null, null },
                    { new Guid("b0000001-0000-0000-0000-000000000004"), "Cheque", "ae,gb,us,pk,sa", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, "Post-dated or bearer cheque", "file-text", false, false, true, "Cheque", 91, null, null },
                    { new Guid("b0000002-0000-0000-0000-000000000001"), "EasyPaisa", "pk", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, "Telenor mobile wallet", "smartphone", false, false, true, "EasyPaisa", 10, null, null },
                    { new Guid("b0000002-0000-0000-0000-000000000002"), "JazzCash", "pk", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, "Jazz mobile wallet", "smartphone", false, false, true, "JazzCash", 11, null, null },
                    { new Guid("b0000002-0000-0000-0000-000000000003"), "SadaPay", "pk", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, "SadaPay digital wallet", "wallet", false, false, true, "SadaPay", 12, null, null },
                    { new Guid("b0000002-0000-0000-0000-000000000004"), "NayaPay", "pk", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, "NayaPay e-money wallet", "wallet", false, false, true, "NayaPay", 13, null, null },
                    { new Guid("b0000003-0000-0000-0000-000000000001"), "ApplePay", "ae,sa,gb,us,in", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, "Apple NFC contactless", "smartphone", false, false, true, "Apple Pay", 10, null, null },
                    { new Guid("b0000003-0000-0000-0000-000000000002"), "GooglePay", "ae,sa,gb,us,in", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, "Google Pay / GPay", "wallet", false, false, true, "Google Pay", 11, null, null },
                    { new Guid("b0000003-0000-0000-0000-000000000003"), "SamsungPay", "ae,sa", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, "Samsung NFC wallet", "smartphone", false, false, true, "Samsung Pay", 12, null, null },
                    { new Guid("b0000003-0000-0000-0000-000000000004"), "Tabby", "ae,sa", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, "Buy Now Pay Later — Tabby", "tag", false, false, true, "Tabby (BNPL)", 20, null, null },
                    { new Guid("b0000003-0000-0000-0000-000000000005"), "Tamara", "ae,sa", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, "Buy Now Pay Later — Tamara", "tag", false, false, true, "Tamara (BNPL)", 21, null, null },
                    { new Guid("b0000004-0000-0000-0000-000000000001"), "STCPay", "sa", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, "STC mobile wallet (KSA)", "smartphone", false, false, true, "STC Pay", 10, null, null },
                    { new Guid("b0000004-0000-0000-0000-000000000002"), "Mada", "sa", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, "Saudi national debit network", "credit-card", false, false, true, "Mada", 11, null, null },
                    { new Guid("b0000005-0000-0000-0000-000000000001"), "UPI", "in", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, "Unified Payments Interface", "smartphone", false, false, true, "UPI", 10, null, null },
                    { new Guid("b0000005-0000-0000-0000-000000000002"), "PhonePe", "in", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, "PhonePe UPI wallet", "smartphone", false, false, true, "PhonePe", 11, null, null },
                    { new Guid("b0000005-0000-0000-0000-000000000003"), "Paytm", "in", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, "Paytm wallet & UPI", "wallet", false, false, true, "Paytm", 12, null, null },
                    { new Guid("b0000006-0000-0000-0000-000000000001"), "ContactlessGBP", "gb", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, "Contactless card / device", "credit-card", false, false, true, "Contactless", 10, null, null },
                    { new Guid("b0000007-0000-0000-0000-000000000001"), "Zelle", "us", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, "Zelle bank-to-bank transfer", "landmark", false, false, true, "Zelle", 10, null, null },
                    { new Guid("b0000007-0000-0000-0000-000000000002"), "Venmo", "us", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, "Venmo social payments", "wallet", false, false, true, "Venmo", 11, null, null }
                });

            migrationBuilder.CreateIndex(
                name: "IX_payment_method_configs_Code",
                schema: "pos",
                table: "payment_method_configs",
                column: "Code",
                unique: true,
                filter: "[IsDeleted] = 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "payment_method_configs",
                schema: "pos");
        }
    }
}
