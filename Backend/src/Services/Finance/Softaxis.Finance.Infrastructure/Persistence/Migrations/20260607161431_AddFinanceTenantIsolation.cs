using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Finance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFinanceTenantIsolation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "finance",
                table: "tax_transactions",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "finance",
                table: "tax_periods",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "finance",
                table: "recurring_invoices",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "finance",
                table: "recurring_invoice_lines",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "finance",
                table: "journal_entry_lines",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "finance",
                table: "journal_entries",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "finance",
                table: "invoices",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "finance",
                table: "invoice_items",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "finance",
                table: "expenses",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "finance",
                table: "budgets",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "finance",
                table: "budget_lines",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "finance",
                table: "bank_transactions",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "finance",
                table: "bank_accounts",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "finance",
                table: "accounts",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_tax_transactions_TenantId",
                schema: "finance",
                table: "tax_transactions",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_tax_periods_TenantId",
                schema: "finance",
                table: "tax_periods",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_recurring_invoices_TenantId",
                schema: "finance",
                table: "recurring_invoices",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_recurring_invoice_lines_TenantId",
                schema: "finance",
                table: "recurring_invoice_lines",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_journal_entry_lines_TenantId",
                schema: "finance",
                table: "journal_entry_lines",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_journal_entries_TenantId",
                schema: "finance",
                table: "journal_entries",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_invoices_TenantId",
                schema: "finance",
                table: "invoices",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_invoice_items_TenantId",
                schema: "finance",
                table: "invoice_items",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_expenses_TenantId",
                schema: "finance",
                table: "expenses",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_budgets_TenantId",
                schema: "finance",
                table: "budgets",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_budget_lines_TenantId",
                schema: "finance",
                table: "budget_lines",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_bank_transactions_TenantId",
                schema: "finance",
                table: "bank_transactions",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_bank_accounts_TenantId",
                schema: "finance",
                table: "bank_accounts",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_accounts_TenantId",
                schema: "finance",
                table: "accounts",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_tax_transactions_TenantId",
                schema: "finance",
                table: "tax_transactions");

            migrationBuilder.DropIndex(
                name: "IX_tax_periods_TenantId",
                schema: "finance",
                table: "tax_periods");

            migrationBuilder.DropIndex(
                name: "IX_recurring_invoices_TenantId",
                schema: "finance",
                table: "recurring_invoices");

            migrationBuilder.DropIndex(
                name: "IX_recurring_invoice_lines_TenantId",
                schema: "finance",
                table: "recurring_invoice_lines");

            migrationBuilder.DropIndex(
                name: "IX_journal_entry_lines_TenantId",
                schema: "finance",
                table: "journal_entry_lines");

            migrationBuilder.DropIndex(
                name: "IX_journal_entries_TenantId",
                schema: "finance",
                table: "journal_entries");

            migrationBuilder.DropIndex(
                name: "IX_invoices_TenantId",
                schema: "finance",
                table: "invoices");

            migrationBuilder.DropIndex(
                name: "IX_invoice_items_TenantId",
                schema: "finance",
                table: "invoice_items");

            migrationBuilder.DropIndex(
                name: "IX_expenses_TenantId",
                schema: "finance",
                table: "expenses");

            migrationBuilder.DropIndex(
                name: "IX_budgets_TenantId",
                schema: "finance",
                table: "budgets");

            migrationBuilder.DropIndex(
                name: "IX_budget_lines_TenantId",
                schema: "finance",
                table: "budget_lines");

            migrationBuilder.DropIndex(
                name: "IX_bank_transactions_TenantId",
                schema: "finance",
                table: "bank_transactions");

            migrationBuilder.DropIndex(
                name: "IX_bank_accounts_TenantId",
                schema: "finance",
                table: "bank_accounts");

            migrationBuilder.DropIndex(
                name: "IX_accounts_TenantId",
                schema: "finance",
                table: "accounts");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "finance",
                table: "tax_transactions");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "finance",
                table: "tax_periods");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "finance",
                table: "recurring_invoices");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "finance",
                table: "recurring_invoice_lines");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "finance",
                table: "journal_entry_lines");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "finance",
                table: "journal_entries");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "finance",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "finance",
                table: "invoice_items");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "finance",
                table: "expenses");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "finance",
                table: "budgets");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "finance",
                table: "budget_lines");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "finance",
                table: "bank_transactions");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "finance",
                table: "bank_accounts");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "finance",
                table: "accounts");
        }
    }
}
