using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Sales.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ScopeSalesUniqueIndexesToTenant : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_sales_quotations_QuotationNumber",
                schema: "sales",
                table: "sales_quotations");

            migrationBuilder.DropIndex(
                name: "IX_sales_orders_OrderNumber",
                schema: "sales",
                table: "sales_orders");

            migrationBuilder.DropIndex(
                name: "IX_delivery_challans_ChallanNumber",
                schema: "sales",
                table: "delivery_challans");

            migrationBuilder.CreateIndex(
                name: "IX_sales_quotations_TenantId_QuotationNumber",
                schema: "sales",
                table: "sales_quotations",
                columns: new[] { "TenantId", "QuotationNumber" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_sales_orders_TenantId_OrderNumber",
                schema: "sales",
                table: "sales_orders",
                columns: new[] { "TenantId", "OrderNumber" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_delivery_challans_TenantId_ChallanNumber",
                schema: "sales",
                table: "delivery_challans",
                columns: new[] { "TenantId", "ChallanNumber" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_sales_quotations_TenantId_QuotationNumber",
                schema: "sales",
                table: "sales_quotations");

            migrationBuilder.DropIndex(
                name: "IX_sales_orders_TenantId_OrderNumber",
                schema: "sales",
                table: "sales_orders");

            migrationBuilder.DropIndex(
                name: "IX_delivery_challans_TenantId_ChallanNumber",
                schema: "sales",
                table: "delivery_challans");

            migrationBuilder.CreateIndex(
                name: "IX_sales_quotations_QuotationNumber",
                schema: "sales",
                table: "sales_quotations",
                column: "QuotationNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_sales_orders_OrderNumber",
                schema: "sales",
                table: "sales_orders",
                column: "OrderNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_delivery_challans_ChallanNumber",
                schema: "sales",
                table: "delivery_challans",
                column: "ChallanNumber",
                unique: true);
        }
    }
}
