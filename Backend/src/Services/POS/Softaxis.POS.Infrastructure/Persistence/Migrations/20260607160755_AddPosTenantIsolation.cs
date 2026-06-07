using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.POS.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPosTenantIsolation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "pos",
                table: "vouchers",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "pos",
                table: "vendors",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "pos",
                table: "tax_rates",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "pos",
                table: "stock_movements",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "pos",
                table: "sales_quotations",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "pos",
                table: "sales_quotation_items",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "pos",
                table: "sales_orders",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "pos",
                table: "sales_order_items",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "pos",
                table: "purchase_orders",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "pos",
                table: "purchase_order_items",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "pos",
                table: "products",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "pos",
                table: "product_categories",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "pos",
                table: "pos_transactions",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "pos",
                table: "pos_sessions",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "pos",
                table: "pos_payments",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "pos",
                table: "pos_line_items",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "pos",
                table: "payment_terms",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "pos",
                table: "payment_method_configs",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "pos",
                table: "held_transactions",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "pos",
                table: "customers",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "pos",
                table: "customer_groups",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "pos",
                table: "currencies",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "pos",
                table: "cash_movements",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "currencies",
                keyColumn: "Id",
                keyValue: new Guid("a0000001-0000-0000-0000-000000000001"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "currencies",
                keyColumn: "Id",
                keyValue: new Guid("a0000001-0000-0000-0000-000000000002"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "currencies",
                keyColumn: "Id",
                keyValue: new Guid("a0000001-0000-0000-0000-000000000003"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "currencies",
                keyColumn: "Id",
                keyValue: new Guid("a0000001-0000-0000-0000-000000000004"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "currencies",
                keyColumn: "Id",
                keyValue: new Guid("a0000001-0000-0000-0000-000000000005"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "currencies",
                keyColumn: "Id",
                keyValue: new Guid("a0000001-0000-0000-0000-000000000006"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "currencies",
                keyColumn: "Id",
                keyValue: new Guid("a0000001-0000-0000-0000-000000000007"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "currencies",
                keyColumn: "Id",
                keyValue: new Guid("a0000001-0000-0000-0000-000000000008"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "currencies",
                keyColumn: "Id",
                keyValue: new Guid("a0000001-0000-0000-0000-000000000009"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "currencies",
                keyColumn: "Id",
                keyValue: new Guid("a0000001-0000-0000-0000-00000000000a"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "currencies",
                keyColumn: "Id",
                keyValue: new Guid("a0000001-0000-0000-0000-00000000000b"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "currencies",
                keyColumn: "Id",
                keyValue: new Guid("a0000001-0000-0000-0000-00000000000c"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "currencies",
                keyColumn: "Id",
                keyValue: new Guid("a0000001-0000-0000-0000-00000000000d"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "currencies",
                keyColumn: "Id",
                keyValue: new Guid("a0000001-0000-0000-0000-00000000000e"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "currencies",
                keyColumn: "Id",
                keyValue: new Guid("a0000001-0000-0000-0000-00000000000f"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "currencies",
                keyColumn: "Id",
                keyValue: new Guid("a0000001-0000-0000-0000-000000000010"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "currencies",
                keyColumn: "Id",
                keyValue: new Guid("a0000001-0000-0000-0000-000000000011"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "currencies",
                keyColumn: "Id",
                keyValue: new Guid("a0000001-0000-0000-0000-000000000012"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "currencies",
                keyColumn: "Id",
                keyValue: new Guid("a0000001-0000-0000-0000-000000000013"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "customer_groups",
                keyColumn: "Id",
                keyValue: new Guid("a0000004-0000-0000-0000-000000000001"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "customer_groups",
                keyColumn: "Id",
                keyValue: new Guid("a0000004-0000-0000-0000-000000000002"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "customer_groups",
                keyColumn: "Id",
                keyValue: new Guid("a0000004-0000-0000-0000-000000000003"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "customer_groups",
                keyColumn: "Id",
                keyValue: new Guid("a0000004-0000-0000-0000-000000000004"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "customer_groups",
                keyColumn: "Id",
                keyValue: new Guid("a0000004-0000-0000-0000-000000000005"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "customer_groups",
                keyColumn: "Id",
                keyValue: new Guid("a0000004-0000-0000-0000-000000000006"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "customer_groups",
                keyColumn: "Id",
                keyValue: new Guid("a0000004-0000-0000-0000-000000000007"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "payment_method_configs",
                keyColumn: "Id",
                keyValue: new Guid("b0000001-0000-0000-0000-000000000001"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "payment_method_configs",
                keyColumn: "Id",
                keyValue: new Guid("b0000001-0000-0000-0000-000000000002"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "payment_method_configs",
                keyColumn: "Id",
                keyValue: new Guid("b0000001-0000-0000-0000-000000000003"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "payment_method_configs",
                keyColumn: "Id",
                keyValue: new Guid("b0000001-0000-0000-0000-000000000004"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "payment_method_configs",
                keyColumn: "Id",
                keyValue: new Guid("b0000002-0000-0000-0000-000000000001"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "payment_method_configs",
                keyColumn: "Id",
                keyValue: new Guid("b0000002-0000-0000-0000-000000000002"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "payment_method_configs",
                keyColumn: "Id",
                keyValue: new Guid("b0000002-0000-0000-0000-000000000003"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "payment_method_configs",
                keyColumn: "Id",
                keyValue: new Guid("b0000002-0000-0000-0000-000000000004"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "payment_method_configs",
                keyColumn: "Id",
                keyValue: new Guid("b0000003-0000-0000-0000-000000000001"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "payment_method_configs",
                keyColumn: "Id",
                keyValue: new Guid("b0000003-0000-0000-0000-000000000002"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "payment_method_configs",
                keyColumn: "Id",
                keyValue: new Guid("b0000003-0000-0000-0000-000000000003"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "payment_method_configs",
                keyColumn: "Id",
                keyValue: new Guid("b0000003-0000-0000-0000-000000000004"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "payment_method_configs",
                keyColumn: "Id",
                keyValue: new Guid("b0000003-0000-0000-0000-000000000005"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "payment_method_configs",
                keyColumn: "Id",
                keyValue: new Guid("b0000004-0000-0000-0000-000000000001"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "payment_method_configs",
                keyColumn: "Id",
                keyValue: new Guid("b0000004-0000-0000-0000-000000000002"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "payment_method_configs",
                keyColumn: "Id",
                keyValue: new Guid("b0000005-0000-0000-0000-000000000001"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "payment_method_configs",
                keyColumn: "Id",
                keyValue: new Guid("b0000005-0000-0000-0000-000000000002"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "payment_method_configs",
                keyColumn: "Id",
                keyValue: new Guid("b0000005-0000-0000-0000-000000000003"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "payment_method_configs",
                keyColumn: "Id",
                keyValue: new Guid("b0000006-0000-0000-0000-000000000001"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "payment_method_configs",
                keyColumn: "Id",
                keyValue: new Guid("b0000007-0000-0000-0000-000000000001"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "payment_method_configs",
                keyColumn: "Id",
                keyValue: new Guid("b0000007-0000-0000-0000-000000000002"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "payment_terms",
                keyColumn: "Id",
                keyValue: new Guid("a0000003-0000-0000-0000-000000000001"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "payment_terms",
                keyColumn: "Id",
                keyValue: new Guid("a0000003-0000-0000-0000-000000000002"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "payment_terms",
                keyColumn: "Id",
                keyValue: new Guid("a0000003-0000-0000-0000-000000000003"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "payment_terms",
                keyColumn: "Id",
                keyValue: new Guid("a0000003-0000-0000-0000-000000000004"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "payment_terms",
                keyColumn: "Id",
                keyValue: new Guid("a0000003-0000-0000-0000-000000000005"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "payment_terms",
                keyColumn: "Id",
                keyValue: new Guid("a0000003-0000-0000-0000-000000000006"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "payment_terms",
                keyColumn: "Id",
                keyValue: new Guid("a0000003-0000-0000-0000-000000000007"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "payment_terms",
                keyColumn: "Id",
                keyValue: new Guid("a0000003-0000-0000-0000-000000000008"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "payment_terms",
                keyColumn: "Id",
                keyValue: new Guid("a0000003-0000-0000-0000-000000000009"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "payment_terms",
                keyColumn: "Id",
                keyValue: new Guid("a0000003-0000-0000-0000-00000000000a"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "payment_terms",
                keyColumn: "Id",
                keyValue: new Guid("a0000003-0000-0000-0000-00000000000b"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "tax_rates",
                keyColumn: "Id",
                keyValue: new Guid("a0000002-0000-0000-0000-000000000001"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "tax_rates",
                keyColumn: "Id",
                keyValue: new Guid("a0000002-0000-0000-0000-000000000002"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "tax_rates",
                keyColumn: "Id",
                keyValue: new Guid("a0000002-0000-0000-0000-000000000003"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "tax_rates",
                keyColumn: "Id",
                keyValue: new Guid("a0000002-0000-0000-0000-000000000004"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "tax_rates",
                keyColumn: "Id",
                keyValue: new Guid("a0000002-0000-0000-0000-000000000005"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "tax_rates",
                keyColumn: "Id",
                keyValue: new Guid("a0000002-0000-0000-0000-000000000006"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "tax_rates",
                keyColumn: "Id",
                keyValue: new Guid("a0000002-0000-0000-0000-000000000007"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "tax_rates",
                keyColumn: "Id",
                keyValue: new Guid("a0000002-0000-0000-0000-000000000008"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "tax_rates",
                keyColumn: "Id",
                keyValue: new Guid("a0000002-0000-0000-0000-000000000009"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "tax_rates",
                keyColumn: "Id",
                keyValue: new Guid("a0000002-0000-0000-0000-00000000000a"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "tax_rates",
                keyColumn: "Id",
                keyValue: new Guid("a0000002-0000-0000-0000-00000000000b"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "vouchers",
                keyColumn: "Id",
                keyValue: new Guid("c0000001-0000-0000-0000-000000000001"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "vouchers",
                keyColumn: "Id",
                keyValue: new Guid("c0000001-0000-0000-0000-000000000002"),
                column: "TenantId",
                value: null);

            migrationBuilder.UpdateData(
                schema: "pos",
                table: "vouchers",
                keyColumn: "Id",
                keyValue: new Guid("c0000001-0000-0000-0000-000000000003"),
                column: "TenantId",
                value: null);

            migrationBuilder.CreateIndex(
                name: "IX_vouchers_TenantId",
                schema: "pos",
                table: "vouchers",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_vendors_TenantId",
                schema: "pos",
                table: "vendors",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_tax_rates_TenantId",
                schema: "pos",
                table: "tax_rates",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_stock_movements_TenantId",
                schema: "pos",
                table: "stock_movements",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_sales_quotations_TenantId",
                schema: "pos",
                table: "sales_quotations",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_sales_quotation_items_TenantId",
                schema: "pos",
                table: "sales_quotation_items",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_sales_orders_TenantId",
                schema: "pos",
                table: "sales_orders",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_sales_order_items_TenantId",
                schema: "pos",
                table: "sales_order_items",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_purchase_orders_TenantId",
                schema: "pos",
                table: "purchase_orders",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_purchase_order_items_TenantId",
                schema: "pos",
                table: "purchase_order_items",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_products_TenantId",
                schema: "pos",
                table: "products",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_product_categories_TenantId",
                schema: "pos",
                table: "product_categories",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pos_transactions_TenantId",
                schema: "pos",
                table: "pos_transactions",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pos_sessions_TenantId",
                schema: "pos",
                table: "pos_sessions",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pos_payments_TenantId",
                schema: "pos",
                table: "pos_payments",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pos_line_items_TenantId",
                schema: "pos",
                table: "pos_line_items",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_payment_terms_TenantId",
                schema: "pos",
                table: "payment_terms",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_payment_method_configs_TenantId",
                schema: "pos",
                table: "payment_method_configs",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_held_transactions_TenantId",
                schema: "pos",
                table: "held_transactions",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_customers_TenantId",
                schema: "pos",
                table: "customers",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_customer_groups_TenantId",
                schema: "pos",
                table: "customer_groups",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_currencies_TenantId",
                schema: "pos",
                table: "currencies",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_cash_movements_TenantId",
                schema: "pos",
                table: "cash_movements",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_vouchers_TenantId",
                schema: "pos",
                table: "vouchers");

            migrationBuilder.DropIndex(
                name: "IX_vendors_TenantId",
                schema: "pos",
                table: "vendors");

            migrationBuilder.DropIndex(
                name: "IX_tax_rates_TenantId",
                schema: "pos",
                table: "tax_rates");

            migrationBuilder.DropIndex(
                name: "IX_stock_movements_TenantId",
                schema: "pos",
                table: "stock_movements");

            migrationBuilder.DropIndex(
                name: "IX_sales_quotations_TenantId",
                schema: "pos",
                table: "sales_quotations");

            migrationBuilder.DropIndex(
                name: "IX_sales_quotation_items_TenantId",
                schema: "pos",
                table: "sales_quotation_items");

            migrationBuilder.DropIndex(
                name: "IX_sales_orders_TenantId",
                schema: "pos",
                table: "sales_orders");

            migrationBuilder.DropIndex(
                name: "IX_sales_order_items_TenantId",
                schema: "pos",
                table: "sales_order_items");

            migrationBuilder.DropIndex(
                name: "IX_purchase_orders_TenantId",
                schema: "pos",
                table: "purchase_orders");

            migrationBuilder.DropIndex(
                name: "IX_purchase_order_items_TenantId",
                schema: "pos",
                table: "purchase_order_items");

            migrationBuilder.DropIndex(
                name: "IX_products_TenantId",
                schema: "pos",
                table: "products");

            migrationBuilder.DropIndex(
                name: "IX_product_categories_TenantId",
                schema: "pos",
                table: "product_categories");

            migrationBuilder.DropIndex(
                name: "IX_pos_transactions_TenantId",
                schema: "pos",
                table: "pos_transactions");

            migrationBuilder.DropIndex(
                name: "IX_pos_sessions_TenantId",
                schema: "pos",
                table: "pos_sessions");

            migrationBuilder.DropIndex(
                name: "IX_pos_payments_TenantId",
                schema: "pos",
                table: "pos_payments");

            migrationBuilder.DropIndex(
                name: "IX_pos_line_items_TenantId",
                schema: "pos",
                table: "pos_line_items");

            migrationBuilder.DropIndex(
                name: "IX_payment_terms_TenantId",
                schema: "pos",
                table: "payment_terms");

            migrationBuilder.DropIndex(
                name: "IX_payment_method_configs_TenantId",
                schema: "pos",
                table: "payment_method_configs");

            migrationBuilder.DropIndex(
                name: "IX_held_transactions_TenantId",
                schema: "pos",
                table: "held_transactions");

            migrationBuilder.DropIndex(
                name: "IX_customers_TenantId",
                schema: "pos",
                table: "customers");

            migrationBuilder.DropIndex(
                name: "IX_customer_groups_TenantId",
                schema: "pos",
                table: "customer_groups");

            migrationBuilder.DropIndex(
                name: "IX_currencies_TenantId",
                schema: "pos",
                table: "currencies");

            migrationBuilder.DropIndex(
                name: "IX_cash_movements_TenantId",
                schema: "pos",
                table: "cash_movements");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "pos",
                table: "vouchers");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "pos",
                table: "vendors");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "pos",
                table: "tax_rates");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "pos",
                table: "stock_movements");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "pos",
                table: "sales_quotations");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "pos",
                table: "sales_quotation_items");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "pos",
                table: "sales_orders");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "pos",
                table: "sales_order_items");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "pos",
                table: "purchase_orders");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "pos",
                table: "purchase_order_items");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "pos",
                table: "products");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "pos",
                table: "product_categories");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "pos",
                table: "pos_transactions");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "pos",
                table: "pos_sessions");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "pos",
                table: "pos_payments");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "pos",
                table: "pos_line_items");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "pos",
                table: "payment_terms");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "pos",
                table: "payment_method_configs");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "pos",
                table: "held_transactions");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "pos",
                table: "customers");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "pos",
                table: "customer_groups");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "pos",
                table: "currencies");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "pos",
                table: "cash_movements");
        }
    }
}
