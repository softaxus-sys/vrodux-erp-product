using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Inventory.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ScopeInventoryUniqueIndexesToTenant : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_units_of_measure_Symbol",
                schema: "inventory",
                table: "units_of_measure");

            migrationBuilder.DropIndex(
                name: "IX_products_SKU",
                schema: "inventory",
                table: "products");

            migrationBuilder.DropIndex(
                name: "IX_brands_Code",
                schema: "inventory",
                table: "brands");

            migrationBuilder.DropIndex(
                name: "IX_brands_Name",
                schema: "inventory",
                table: "brands");

            migrationBuilder.CreateIndex(
                name: "IX_units_of_measure_TenantId_Symbol",
                schema: "inventory",
                table: "units_of_measure",
                columns: new[] { "TenantId", "Symbol" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_products_TenantId_SKU",
                schema: "inventory",
                table: "products",
                columns: new[] { "TenantId", "SKU" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0 AND [SKU] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_brands_TenantId_Code",
                schema: "inventory",
                table: "brands",
                columns: new[] { "TenantId", "Code" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0 AND [Code] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_brands_TenantId_Name",
                schema: "inventory",
                table: "brands",
                columns: new[] { "TenantId", "Name" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_units_of_measure_TenantId_Symbol",
                schema: "inventory",
                table: "units_of_measure");

            migrationBuilder.DropIndex(
                name: "IX_products_TenantId_SKU",
                schema: "inventory",
                table: "products");

            migrationBuilder.DropIndex(
                name: "IX_brands_TenantId_Code",
                schema: "inventory",
                table: "brands");

            migrationBuilder.DropIndex(
                name: "IX_brands_TenantId_Name",
                schema: "inventory",
                table: "brands");

            migrationBuilder.CreateIndex(
                name: "IX_units_of_measure_Symbol",
                schema: "inventory",
                table: "units_of_measure",
                column: "Symbol",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_products_SKU",
                schema: "inventory",
                table: "products",
                column: "SKU",
                unique: true,
                filter: "[SKU] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_brands_Code",
                schema: "inventory",
                table: "brands",
                column: "Code",
                unique: true,
                filter: "[Code] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_brands_Name",
                schema: "inventory",
                table: "brands",
                column: "Name",
                unique: true);
        }
    }
}
