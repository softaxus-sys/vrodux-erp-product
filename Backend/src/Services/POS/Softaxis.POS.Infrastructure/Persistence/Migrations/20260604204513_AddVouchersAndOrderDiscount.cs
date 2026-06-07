using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Softaxis.POS.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddVouchersAndOrderDiscount : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "OrderDiscountReference",
                schema: "pos",
                table: "pos_transactions",
                type: "nvarchar(60)",
                maxLength: 60,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OrderDiscountType",
                schema: "pos",
                table: "pos_transactions",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "none");

            migrationBuilder.CreateTable(
                name: "vouchers",
                schema: "pos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Code = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    ValueType = table.Column<int>(type: "int", nullable: false),
                    Value = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    MinSpend = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    MaxDiscountAmount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    ValidFrom = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ValidUntil = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UsageLimit = table.Column<int>(type: "int", nullable: true),
                    UsageCount = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
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
                    table.PrimaryKey("PK_vouchers", x => x.Id);
                });

            migrationBuilder.InsertData(
                schema: "pos",
                table: "vouchers",
                columns: new[] { "Id", "Code", "CreatedAt", "CreatedBy", "DeletedAt", "DeletedBy", "Description", "IsActive", "IsDeleted", "MaxDiscountAmount", "MinSpend", "UpdatedAt", "UpdatedBy", "UsageCount", "UsageLimit", "ValidFrom", "ValidUntil", "Value", "ValueType" },
                values: new object[,]
                {
                    { new Guid("c0000001-0000-0000-0000-000000000001"), "SAVE10", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, "10% off — min spend 100", true, false, 500m, 100m, null, null, 0, 1000, null, null, 10m, 1 },
                    { new Guid("c0000001-0000-0000-0000-000000000002"), "FLAT50", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, "Flat 50 off — min spend 300", true, false, null, 300m, null, null, 0, null, null, null, 50m, 2 },
                    { new Guid("c0000001-0000-0000-0000-000000000003"), "WELCOME", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "system", null, null, "15% welcome discount", true, false, 1000m, 0m, null, null, 0, null, null, null, 15m, 1 }
                });

            migrationBuilder.CreateIndex(
                name: "IX_vouchers_Code",
                schema: "pos",
                table: "vouchers",
                column: "Code",
                unique: true,
                filter: "[IsDeleted] = 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "vouchers",
                schema: "pos");

            migrationBuilder.DropColumn(
                name: "OrderDiscountReference",
                schema: "pos",
                table: "pos_transactions");

            migrationBuilder.DropColumn(
                name: "OrderDiscountType",
                schema: "pos",
                table: "pos_transactions");
        }
    }
}
