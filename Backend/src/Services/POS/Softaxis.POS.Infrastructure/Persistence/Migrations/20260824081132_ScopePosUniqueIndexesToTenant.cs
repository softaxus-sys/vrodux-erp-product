using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.POS.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ScopePosUniqueIndexesToTenant : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_vouchers_Code",
                schema: "pos",
                table: "vouchers");

            migrationBuilder.DropIndex(
                name: "IX_vendors_Code",
                schema: "pos",
                table: "vendors");

            migrationBuilder.DropIndex(
                name: "IX_tax_rates_Code",
                schema: "pos",
                table: "tax_rates");

            migrationBuilder.DropIndex(
                name: "IX_sales_quotations_QuotationNumber",
                schema: "pos",
                table: "sales_quotations");

            migrationBuilder.DropIndex(
                name: "IX_sales_orders_OrderNumber",
                schema: "pos",
                table: "sales_orders");

            migrationBuilder.DropIndex(
                name: "IX_purchase_orders_OrderNumber",
                schema: "pos",
                table: "purchase_orders");

            migrationBuilder.DropIndex(
                name: "IX_products_Barcode",
                schema: "pos",
                table: "products");

            migrationBuilder.DropIndex(
                name: "IX_products_SKU",
                schema: "pos",
                table: "products");

            migrationBuilder.DropIndex(
                name: "IX_product_categories_Name",
                schema: "pos",
                table: "product_categories");

            migrationBuilder.DropIndex(
                name: "IX_pos_transactions_TransactionNumber",
                schema: "pos",
                table: "pos_transactions");

            migrationBuilder.DropIndex(
                name: "IX_payment_terms_Code",
                schema: "pos",
                table: "payment_terms");

            migrationBuilder.DropIndex(
                name: "IX_payment_method_configs_Code",
                schema: "pos",
                table: "payment_method_configs");

            migrationBuilder.DropIndex(
                name: "IX_customers_Phone",
                schema: "pos",
                table: "customers");

            migrationBuilder.DropIndex(
                name: "IX_customer_groups_Code",
                schema: "pos",
                table: "customer_groups");

            migrationBuilder.DropIndex(
                name: "IX_currencies_Code",
                schema: "pos",
                table: "currencies");

            migrationBuilder.CreateIndex(
                name: "IX_vouchers_TenantId_Code",
                schema: "pos",
                table: "vouchers",
                columns: new[] { "TenantId", "Code" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_vendors_TenantId_Code",
                schema: "pos",
                table: "vendors",
                columns: new[] { "TenantId", "Code" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0 AND [Code] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_tax_rates_TenantId_Code",
                schema: "pos",
                table: "tax_rates",
                columns: new[] { "TenantId", "Code" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_sales_quotations_TenantId_QuotationNumber",
                schema: "pos",
                table: "sales_quotations",
                columns: new[] { "TenantId", "QuotationNumber" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_sales_orders_TenantId_OrderNumber",
                schema: "pos",
                table: "sales_orders",
                columns: new[] { "TenantId", "OrderNumber" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_purchase_orders_TenantId_OrderNumber",
                schema: "pos",
                table: "purchase_orders",
                columns: new[] { "TenantId", "OrderNumber" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_products_TenantId_Barcode",
                schema: "pos",
                table: "products",
                columns: new[] { "TenantId", "Barcode" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0 AND [barcode] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_products_TenantId_SKU",
                schema: "pos",
                table: "products",
                columns: new[] { "TenantId", "SKU" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0 AND [sku] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_product_categories_TenantId_Name",
                schema: "pos",
                table: "product_categories",
                columns: new[] { "TenantId", "Name" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_pos_transactions_TenantId_TransactionNumber",
                schema: "pos",
                table: "pos_transactions",
                columns: new[] { "TenantId", "TransactionNumber" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_payment_terms_TenantId_Code",
                schema: "pos",
                table: "payment_terms",
                columns: new[] { "TenantId", "Code" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_payment_method_configs_TenantId_Code",
                schema: "pos",
                table: "payment_method_configs",
                columns: new[] { "TenantId", "Code" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_customers_TenantId_Phone",
                schema: "pos",
                table: "customers",
                columns: new[] { "TenantId", "Phone" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0 AND [phone] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_customer_groups_TenantId_Code",
                schema: "pos",
                table: "customer_groups",
                columns: new[] { "TenantId", "Code" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_currencies_TenantId_Code",
                schema: "pos",
                table: "currencies",
                columns: new[] { "TenantId", "Code" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_vouchers_TenantId_Code",
                schema: "pos",
                table: "vouchers");

            migrationBuilder.DropIndex(
                name: "IX_vendors_TenantId_Code",
                schema: "pos",
                table: "vendors");

            migrationBuilder.DropIndex(
                name: "IX_tax_rates_TenantId_Code",
                schema: "pos",
                table: "tax_rates");

            migrationBuilder.DropIndex(
                name: "IX_sales_quotations_TenantId_QuotationNumber",
                schema: "pos",
                table: "sales_quotations");

            migrationBuilder.DropIndex(
                name: "IX_sales_orders_TenantId_OrderNumber",
                schema: "pos",
                table: "sales_orders");

            migrationBuilder.DropIndex(
                name: "IX_purchase_orders_TenantId_OrderNumber",
                schema: "pos",
                table: "purchase_orders");

            migrationBuilder.DropIndex(
                name: "IX_products_TenantId_Barcode",
                schema: "pos",
                table: "products");

            migrationBuilder.DropIndex(
                name: "IX_products_TenantId_SKU",
                schema: "pos",
                table: "products");

            migrationBuilder.DropIndex(
                name: "IX_product_categories_TenantId_Name",
                schema: "pos",
                table: "product_categories");

            migrationBuilder.DropIndex(
                name: "IX_pos_transactions_TenantId_TransactionNumber",
                schema: "pos",
                table: "pos_transactions");

            migrationBuilder.DropIndex(
                name: "IX_payment_terms_TenantId_Code",
                schema: "pos",
                table: "payment_terms");

            migrationBuilder.DropIndex(
                name: "IX_payment_method_configs_TenantId_Code",
                schema: "pos",
                table: "payment_method_configs");

            migrationBuilder.DropIndex(
                name: "IX_customers_TenantId_Phone",
                schema: "pos",
                table: "customers");

            migrationBuilder.DropIndex(
                name: "IX_customer_groups_TenantId_Code",
                schema: "pos",
                table: "customer_groups");

            migrationBuilder.DropIndex(
                name: "IX_currencies_TenantId_Code",
                schema: "pos",
                table: "currencies");

            migrationBuilder.CreateIndex(
                name: "IX_vouchers_Code",
                schema: "pos",
                table: "vouchers",
                column: "Code",
                unique: true,
                filter: "[IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_vendors_Code",
                schema: "pos",
                table: "vendors",
                column: "Code",
                unique: true,
                filter: "[IsDeleted] = 0 AND [Code] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_tax_rates_Code",
                schema: "pos",
                table: "tax_rates",
                column: "Code",
                unique: true,
                filter: "[IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_sales_quotations_QuotationNumber",
                schema: "pos",
                table: "sales_quotations",
                column: "QuotationNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_sales_orders_OrderNumber",
                schema: "pos",
                table: "sales_orders",
                column: "OrderNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_purchase_orders_OrderNumber",
                schema: "pos",
                table: "purchase_orders",
                column: "OrderNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_products_Barcode",
                schema: "pos",
                table: "products",
                column: "Barcode",
                unique: true,
                filter: "barcode IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_products_SKU",
                schema: "pos",
                table: "products",
                column: "SKU",
                unique: true,
                filter: "sku IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_product_categories_Name",
                schema: "pos",
                table: "product_categories",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pos_transactions_TransactionNumber",
                schema: "pos",
                table: "pos_transactions",
                column: "TransactionNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_payment_terms_Code",
                schema: "pos",
                table: "payment_terms",
                column: "Code",
                unique: true,
                filter: "[IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_payment_method_configs_Code",
                schema: "pos",
                table: "payment_method_configs",
                column: "Code",
                unique: true,
                filter: "[IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_customers_Phone",
                schema: "pos",
                table: "customers",
                column: "Phone",
                unique: true,
                filter: "phone IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_customer_groups_Code",
                schema: "pos",
                table: "customer_groups",
                column: "Code",
                unique: true,
                filter: "[IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_currencies_Code",
                schema: "pos",
                table: "currencies",
                column: "Code",
                unique: true,
                filter: "[IsDeleted] = 0");
        }
    }
}
