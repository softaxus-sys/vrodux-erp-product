using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Library.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFinePayments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "fine_payments",
                schema: "library",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FineId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MemberId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    Method = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    PaidOn = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    JournalEntryId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    JournalEntryNumber = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: true),
                    PostedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_fine_payments", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_fine_payments_FineId",
                schema: "library",
                table: "fine_payments",
                column: "FineId");

            migrationBuilder.CreateIndex(
                name: "IX_fine_payments_JournalEntryId",
                schema: "library",
                table: "fine_payments",
                column: "JournalEntryId");

            migrationBuilder.CreateIndex(
                name: "IX_fine_payments_PaidOn",
                schema: "library",
                table: "fine_payments",
                column: "PaidOn");

            migrationBuilder.CreateIndex(
                name: "IX_fine_payments_TenantId",
                schema: "library",
                table: "fine_payments",
                column: "TenantId");

            // Money already taken on existing fines becomes one payment each, dated when the fine was
            // settled (or raised, for a part-payment). Without this, everything collected before today
            // would be missing from the collections report and could never be posted to Finance.
            migrationBuilder.Sql(@"
                INSERT INTO [library].[fine_payments] (Id, FineId, MemberId, Amount, Method, PaidOn, CreatedAt, TenantId)
                SELECT NEWID(), f.Id, f.MemberId, f.AmountPaid, LOWER(ISNULL(NULLIF(f.PaymentMethod, ''), 'cash')),
                       ISNULL(f.SettledOn, f.CreatedOn), f.CreatedAt, f.TenantId
                FROM [library].[fines] f
                WHERE f.AmountPaid > 0;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "fine_payments",
                schema: "library");
        }
    }
}
