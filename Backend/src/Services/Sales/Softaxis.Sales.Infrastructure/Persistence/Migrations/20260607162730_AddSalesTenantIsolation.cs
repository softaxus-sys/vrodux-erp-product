using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Sales.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSalesTenantIsolation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "sales",
                table: "sales_returns",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "sales",
                table: "sales_return_items",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "sales",
                table: "sales_quotations",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "sales",
                table: "sales_quotation_items",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "sales",
                table: "sales_orders",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "sales",
                table: "sales_order_items",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "sales",
                table: "customers",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_sales_returns_TenantId",
                schema: "sales",
                table: "sales_returns",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_sales_return_items_TenantId",
                schema: "sales",
                table: "sales_return_items",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_sales_quotations_TenantId",
                schema: "sales",
                table: "sales_quotations",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_sales_quotation_items_TenantId",
                schema: "sales",
                table: "sales_quotation_items",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_sales_orders_TenantId",
                schema: "sales",
                table: "sales_orders",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_sales_order_items_TenantId",
                schema: "sales",
                table: "sales_order_items",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_customers_TenantId",
                schema: "sales",
                table: "customers",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_sales_returns_TenantId",
                schema: "sales",
                table: "sales_returns");

            migrationBuilder.DropIndex(
                name: "IX_sales_return_items_TenantId",
                schema: "sales",
                table: "sales_return_items");

            migrationBuilder.DropIndex(
                name: "IX_sales_quotations_TenantId",
                schema: "sales",
                table: "sales_quotations");

            migrationBuilder.DropIndex(
                name: "IX_sales_quotation_items_TenantId",
                schema: "sales",
                table: "sales_quotation_items");

            migrationBuilder.DropIndex(
                name: "IX_sales_orders_TenantId",
                schema: "sales",
                table: "sales_orders");

            migrationBuilder.DropIndex(
                name: "IX_sales_order_items_TenantId",
                schema: "sales",
                table: "sales_order_items");

            migrationBuilder.DropIndex(
                name: "IX_customers_TenantId",
                schema: "sales",
                table: "customers");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "sales",
                table: "sales_returns");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "sales",
                table: "sales_return_items");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "sales",
                table: "sales_quotations");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "sales",
                table: "sales_quotation_items");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "sales",
                table: "sales_orders");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "sales",
                table: "sales_order_items");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "sales",
                table: "customers");
        }
    }
}
