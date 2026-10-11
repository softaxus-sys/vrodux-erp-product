using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Finance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddBankReconciliation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "MatchedAt",
                schema: "finance",
                table: "bank_transactions",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MatchedByName",
                schema: "finance",
                table: "bank_transactions",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MatchedEntryNumber",
                schema: "finance",
                table: "bank_transactions",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "MatchedJournalEntryId",
                schema: "finance",
                table: "bank_transactions",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "MatchedJournalLineId",
                schema: "finance",
                table: "bank_transactions",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "LedgerAccountId",
                schema: "finance",
                table: "bank_accounts",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_bank_transactions_MatchedJournalLineId",
                schema: "finance",
                table: "bank_transactions",
                column: "MatchedJournalLineId",
                unique: true,
                filter: "[MatchedJournalLineId] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_bank_transactions_MatchedJournalLineId",
                schema: "finance",
                table: "bank_transactions");

            migrationBuilder.DropColumn(
                name: "MatchedAt",
                schema: "finance",
                table: "bank_transactions");

            migrationBuilder.DropColumn(
                name: "MatchedByName",
                schema: "finance",
                table: "bank_transactions");

            migrationBuilder.DropColumn(
                name: "MatchedEntryNumber",
                schema: "finance",
                table: "bank_transactions");

            migrationBuilder.DropColumn(
                name: "MatchedJournalEntryId",
                schema: "finance",
                table: "bank_transactions");

            migrationBuilder.DropColumn(
                name: "MatchedJournalLineId",
                schema: "finance",
                table: "bank_transactions");

            migrationBuilder.DropColumn(
                name: "LedgerAccountId",
                schema: "finance",
                table: "bank_accounts");
        }
    }
}
