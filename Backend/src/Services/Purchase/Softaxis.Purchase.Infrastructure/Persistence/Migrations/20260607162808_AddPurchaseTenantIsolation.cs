using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Purchase.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPurchaseTenantIsolation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "purchase",
                table: "vendors",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "purchase",
                table: "purchase_orders",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "purchase",
                table: "purchase_order_items",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "purchase",
                table: "purchase_approvals",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "purchase",
                table: "purchase_approval_items",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_vendors_TenantId",
                schema: "purchase",
                table: "vendors",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_purchase_orders_TenantId",
                schema: "purchase",
                table: "purchase_orders",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_purchase_order_items_TenantId",
                schema: "purchase",
                table: "purchase_order_items",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_purchase_approvals_TenantId",
                schema: "purchase",
                table: "purchase_approvals",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_purchase_approval_items_TenantId",
                schema: "purchase",
                table: "purchase_approval_items",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_vendors_TenantId",
                schema: "purchase",
                table: "vendors");

            migrationBuilder.DropIndex(
                name: "IX_purchase_orders_TenantId",
                schema: "purchase",
                table: "purchase_orders");

            migrationBuilder.DropIndex(
                name: "IX_purchase_order_items_TenantId",
                schema: "purchase",
                table: "purchase_order_items");

            migrationBuilder.DropIndex(
                name: "IX_purchase_approvals_TenantId",
                schema: "purchase",
                table: "purchase_approvals");

            migrationBuilder.DropIndex(
                name: "IX_purchase_approval_items_TenantId",
                schema: "purchase",
                table: "purchase_approval_items");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "purchase",
                table: "vendors");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "purchase",
                table: "purchase_orders");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "purchase",
                table: "purchase_order_items");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "purchase",
                table: "purchase_approvals");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "purchase",
                table: "purchase_approval_items");
        }
    }
}
