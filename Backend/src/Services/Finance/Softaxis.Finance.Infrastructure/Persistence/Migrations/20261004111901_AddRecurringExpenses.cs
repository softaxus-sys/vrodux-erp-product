using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Finance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddRecurringExpenses : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "RecurringExpenseId",
                schema: "finance",
                table: "expenses",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "recurring_expenses",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TemplateName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Category = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    Vendor = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    PaymentMethod = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Frequency = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    StartDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EndDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    NextRunDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    AnchorDay = table.Column<int>(type: "int", nullable: false),
                    AutoPost = table.Column<bool>(type: "bit", nullable: false),
                    Reference = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    LastGeneratedDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    GeneratedCount = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_recurring_expenses", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_expenses_RecurringExpenseId",
                schema: "finance",
                table: "expenses",
                column: "RecurringExpenseId");

            migrationBuilder.CreateIndex(
                name: "IX_recurring_expenses_IsActive_NextRunDate",
                schema: "finance",
                table: "recurring_expenses",
                columns: new[] { "IsActive", "NextRunDate" });

            migrationBuilder.CreateIndex(
                name: "IX_recurring_expenses_TenantId",
                schema: "finance",
                table: "recurring_expenses",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "recurring_expenses",
                schema: "finance");

            migrationBuilder.DropIndex(
                name: "IX_expenses_RecurringExpenseId",
                schema: "finance",
                table: "expenses");

            migrationBuilder.DropColumn(
                name: "RecurringExpenseId",
                schema: "finance",
                table: "expenses");
        }
    }
}
