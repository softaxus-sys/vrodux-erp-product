using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Finance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddExpensePostingAccounts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ExpenseAccountId",
                schema: "finance",
                table: "recurring_expenses",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "PaymentAccountId",
                schema: "finance",
                table: "recurring_expenses",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ExpenseAccountId",
                schema: "finance",
                table: "expenses",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "PaymentAccountId",
                schema: "finance",
                table: "expenses",
                type: "uniqueidentifier",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ExpenseAccountId",
                schema: "finance",
                table: "recurring_expenses");

            migrationBuilder.DropColumn(
                name: "PaymentAccountId",
                schema: "finance",
                table: "recurring_expenses");

            migrationBuilder.DropColumn(
                name: "ExpenseAccountId",
                schema: "finance",
                table: "expenses");

            migrationBuilder.DropColumn(
                name: "PaymentAccountId",
                schema: "finance",
                table: "expenses");
        }
    }
}
