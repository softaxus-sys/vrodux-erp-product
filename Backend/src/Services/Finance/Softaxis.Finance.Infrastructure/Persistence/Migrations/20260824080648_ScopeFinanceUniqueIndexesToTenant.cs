using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Finance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ScopeFinanceUniqueIndexesToTenant : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_suppliers_Code",
                schema: "finance",
                table: "suppliers");

            migrationBuilder.DropIndex(
                name: "IX_receipt_vouchers_VoucherNumber",
                schema: "finance",
                table: "receipt_vouchers");

            migrationBuilder.DropIndex(
                name: "IX_purchase_bills_BillNumber",
                schema: "finance",
                table: "purchase_bills");

            migrationBuilder.DropIndex(
                name: "IX_payment_vouchers_VoucherNumber",
                schema: "finance",
                table: "payment_vouchers");

            migrationBuilder.DropIndex(
                name: "IX_journal_entries_EntryNumber",
                schema: "finance",
                table: "journal_entries");

            migrationBuilder.DropIndex(
                name: "IX_invoices_InvoiceNumber",
                schema: "finance",
                table: "invoices");

            migrationBuilder.DropIndex(
                name: "IX_fiscal_periods_PeriodCode",
                schema: "finance",
                table: "fiscal_periods");

            migrationBuilder.DropIndex(
                name: "IX_expenses_ExpenseNumber",
                schema: "finance",
                table: "expenses");

            migrationBuilder.DropIndex(
                name: "IX_customers_Code",
                schema: "finance",
                table: "customers");

            migrationBuilder.CreateIndex(
                name: "IX_suppliers_TenantId_Code",
                schema: "finance",
                table: "suppliers",
                columns: new[] { "TenantId", "Code" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_receipt_vouchers_TenantId_VoucherNumber",
                schema: "finance",
                table: "receipt_vouchers",
                columns: new[] { "TenantId", "VoucherNumber" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_purchase_bills_TenantId_BillNumber",
                schema: "finance",
                table: "purchase_bills",
                columns: new[] { "TenantId", "BillNumber" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_payment_vouchers_TenantId_VoucherNumber",
                schema: "finance",
                table: "payment_vouchers",
                columns: new[] { "TenantId", "VoucherNumber" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_journal_entries_TenantId_EntryNumber",
                schema: "finance",
                table: "journal_entries",
                columns: new[] { "TenantId", "EntryNumber" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_invoices_TenantId_InvoiceNumber",
                schema: "finance",
                table: "invoices",
                columns: new[] { "TenantId", "InvoiceNumber" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_fiscal_periods_TenantId_PeriodCode",
                schema: "finance",
                table: "fiscal_periods",
                columns: new[] { "TenantId", "PeriodCode" },
                unique: true,
                filter: "[TenantId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_expenses_TenantId_ExpenseNumber",
                schema: "finance",
                table: "expenses",
                columns: new[] { "TenantId", "ExpenseNumber" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_customers_TenantId_Code",
                schema: "finance",
                table: "customers",
                columns: new[] { "TenantId", "Code" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_suppliers_TenantId_Code",
                schema: "finance",
                table: "suppliers");

            migrationBuilder.DropIndex(
                name: "IX_receipt_vouchers_TenantId_VoucherNumber",
                schema: "finance",
                table: "receipt_vouchers");

            migrationBuilder.DropIndex(
                name: "IX_purchase_bills_TenantId_BillNumber",
                schema: "finance",
                table: "purchase_bills");

            migrationBuilder.DropIndex(
                name: "IX_payment_vouchers_TenantId_VoucherNumber",
                schema: "finance",
                table: "payment_vouchers");

            migrationBuilder.DropIndex(
                name: "IX_journal_entries_TenantId_EntryNumber",
                schema: "finance",
                table: "journal_entries");

            migrationBuilder.DropIndex(
                name: "IX_invoices_TenantId_InvoiceNumber",
                schema: "finance",
                table: "invoices");

            migrationBuilder.DropIndex(
                name: "IX_fiscal_periods_TenantId_PeriodCode",
                schema: "finance",
                table: "fiscal_periods");

            migrationBuilder.DropIndex(
                name: "IX_expenses_TenantId_ExpenseNumber",
                schema: "finance",
                table: "expenses");

            migrationBuilder.DropIndex(
                name: "IX_customers_TenantId_Code",
                schema: "finance",
                table: "customers");

            migrationBuilder.CreateIndex(
                name: "IX_suppliers_Code",
                schema: "finance",
                table: "suppliers",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_receipt_vouchers_VoucherNumber",
                schema: "finance",
                table: "receipt_vouchers",
                column: "VoucherNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_purchase_bills_BillNumber",
                schema: "finance",
                table: "purchase_bills",
                column: "BillNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_payment_vouchers_VoucherNumber",
                schema: "finance",
                table: "payment_vouchers",
                column: "VoucherNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_journal_entries_EntryNumber",
                schema: "finance",
                table: "journal_entries",
                column: "EntryNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_invoices_InvoiceNumber",
                schema: "finance",
                table: "invoices",
                column: "InvoiceNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_fiscal_periods_PeriodCode",
                schema: "finance",
                table: "fiscal_periods",
                column: "PeriodCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_expenses_ExpenseNumber",
                schema: "finance",
                table: "expenses",
                column: "ExpenseNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_customers_Code",
                schema: "finance",
                table: "customers",
                column: "Code",
                unique: true);
        }
    }
}
