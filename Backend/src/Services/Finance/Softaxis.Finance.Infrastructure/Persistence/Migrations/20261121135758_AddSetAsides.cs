using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Finance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSetAsides : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "SetAsidesJson",
                schema: "finance",
                table: "recurring_invoices",
                type: "nvarchar(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SetAsidesJson",
                schema: "finance",
                table: "invoices",
                type: "nvarchar(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "set_aside_entries",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EventId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SourceKey = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: false),
                    InvoiceId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    InvoiceNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    LedgerAmount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    BaseLedgerAmount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    CurrencyCode = table.Column<string>(type: "nvarchar(3)", maxLength: 3, nullable: false),
                    AccruedOn = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    JournalEntryId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    PayoutId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_set_aside_entries", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "set_aside_payouts",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PaidOn = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    FromAccountNumber = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Total = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    Reference = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    JournalEntryId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_set_aside_payouts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "set_aside_rules",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Kind = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    Value = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    AutoApply = table.Column<bool>(type: "bit", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_set_aside_rules", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "set_aside_state",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LastReminderMonth = table.Column<string>(type: "nvarchar(7)", maxLength: 7, nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_set_aside_state", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_set_aside_entries_InvoiceId",
                schema: "finance",
                table: "set_aside_entries",
                column: "InvoiceId");

            migrationBuilder.CreateIndex(
                name: "IX_set_aside_entries_PayoutId",
                schema: "finance",
                table: "set_aside_entries",
                column: "PayoutId");

            migrationBuilder.CreateIndex(
                name: "IX_set_aside_entries_SourceKey",
                schema: "finance",
                table: "set_aside_entries",
                column: "SourceKey");

            migrationBuilder.CreateIndex(
                name: "IX_set_aside_entries_TenantId",
                schema: "finance",
                table: "set_aside_entries",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_set_aside_payouts_TenantId",
                schema: "finance",
                table: "set_aside_payouts",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_set_aside_rules_TenantId",
                schema: "finance",
                table: "set_aside_rules",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_set_aside_state_TenantId",
                schema: "finance",
                table: "set_aside_state",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "set_aside_entries",
                schema: "finance");

            migrationBuilder.DropTable(
                name: "set_aside_payouts",
                schema: "finance");

            migrationBuilder.DropTable(
                name: "set_aside_rules",
                schema: "finance");

            migrationBuilder.DropTable(
                name: "set_aside_state",
                schema: "finance");

            migrationBuilder.DropColumn(
                name: "SetAsidesJson",
                schema: "finance",
                table: "recurring_invoices");

            migrationBuilder.DropColumn(
                name: "SetAsidesJson",
                schema: "finance",
                table: "invoices");
        }
    }
}
