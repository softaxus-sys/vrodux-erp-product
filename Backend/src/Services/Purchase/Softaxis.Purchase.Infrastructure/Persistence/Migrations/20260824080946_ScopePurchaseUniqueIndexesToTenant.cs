using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Purchase.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ScopePurchaseUniqueIndexesToTenant : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_purchase_returns_ReturnNumber",
                schema: "purchase",
                table: "purchase_returns");

            migrationBuilder.DropIndex(
                name: "IX_purchase_orders_OrderNumber",
                schema: "purchase",
                table: "purchase_orders");

            migrationBuilder.DropIndex(
                name: "IX_goods_receipt_notes_GrnNumber",
                schema: "purchase",
                table: "goods_receipt_notes");

            migrationBuilder.CreateIndex(
                name: "IX_purchase_returns_TenantId_ReturnNumber",
                schema: "purchase",
                table: "purchase_returns",
                columns: new[] { "TenantId", "ReturnNumber" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_purchase_orders_TenantId_OrderNumber",
                schema: "purchase",
                table: "purchase_orders",
                columns: new[] { "TenantId", "OrderNumber" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_goods_receipt_notes_TenantId_GrnNumber",
                schema: "purchase",
                table: "goods_receipt_notes",
                columns: new[] { "TenantId", "GrnNumber" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_purchase_returns_TenantId_ReturnNumber",
                schema: "purchase",
                table: "purchase_returns");

            migrationBuilder.DropIndex(
                name: "IX_purchase_orders_TenantId_OrderNumber",
                schema: "purchase",
                table: "purchase_orders");

            migrationBuilder.DropIndex(
                name: "IX_goods_receipt_notes_TenantId_GrnNumber",
                schema: "purchase",
                table: "goods_receipt_notes");

            migrationBuilder.CreateIndex(
                name: "IX_purchase_returns_ReturnNumber",
                schema: "purchase",
                table: "purchase_returns",
                column: "ReturnNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_purchase_orders_OrderNumber",
                schema: "purchase",
                table: "purchase_orders",
                column: "OrderNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_goods_receipt_notes_GrnNumber",
                schema: "purchase",
                table: "goods_receipt_notes",
                column: "GrnNumber",
                unique: true);
        }
    }
}
