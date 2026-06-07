using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Inventory.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddInventoryTenantIsolation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "inventory",
                table: "warehouses",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "inventory",
                table: "units_of_measure",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "inventory",
                table: "stock_transfers",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "inventory",
                table: "stock_transfer_items",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "inventory",
                table: "stock_movements",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "inventory",
                table: "products",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "inventory",
                table: "product_stock",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "inventory",
                table: "product_categories",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "inventory",
                table: "product_batches",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "inventory",
                table: "brands",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_warehouses_TenantId",
                schema: "inventory",
                table: "warehouses",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_units_of_measure_TenantId",
                schema: "inventory",
                table: "units_of_measure",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_stock_transfers_TenantId",
                schema: "inventory",
                table: "stock_transfers",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_stock_transfer_items_TenantId",
                schema: "inventory",
                table: "stock_transfer_items",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_stock_movements_TenantId",
                schema: "inventory",
                table: "stock_movements",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_products_TenantId",
                schema: "inventory",
                table: "products",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_product_stock_TenantId",
                schema: "inventory",
                table: "product_stock",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_product_categories_TenantId",
                schema: "inventory",
                table: "product_categories",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_product_batches_TenantId",
                schema: "inventory",
                table: "product_batches",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_brands_TenantId",
                schema: "inventory",
                table: "brands",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_warehouses_TenantId",
                schema: "inventory",
                table: "warehouses");

            migrationBuilder.DropIndex(
                name: "IX_units_of_measure_TenantId",
                schema: "inventory",
                table: "units_of_measure");

            migrationBuilder.DropIndex(
                name: "IX_stock_transfers_TenantId",
                schema: "inventory",
                table: "stock_transfers");

            migrationBuilder.DropIndex(
                name: "IX_stock_transfer_items_TenantId",
                schema: "inventory",
                table: "stock_transfer_items");

            migrationBuilder.DropIndex(
                name: "IX_stock_movements_TenantId",
                schema: "inventory",
                table: "stock_movements");

            migrationBuilder.DropIndex(
                name: "IX_products_TenantId",
                schema: "inventory",
                table: "products");

            migrationBuilder.DropIndex(
                name: "IX_product_stock_TenantId",
                schema: "inventory",
                table: "product_stock");

            migrationBuilder.DropIndex(
                name: "IX_product_categories_TenantId",
                schema: "inventory",
                table: "product_categories");

            migrationBuilder.DropIndex(
                name: "IX_product_batches_TenantId",
                schema: "inventory",
                table: "product_batches");

            migrationBuilder.DropIndex(
                name: "IX_brands_TenantId",
                schema: "inventory",
                table: "brands");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "inventory",
                table: "warehouses");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "inventory",
                table: "units_of_measure");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "inventory",
                table: "stock_transfers");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "inventory",
                table: "stock_transfer_items");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "inventory",
                table: "stock_movements");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "inventory",
                table: "products");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "inventory",
                table: "product_stock");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "inventory",
                table: "product_categories");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "inventory",
                table: "product_batches");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "inventory",
                table: "brands");
        }
    }
}
