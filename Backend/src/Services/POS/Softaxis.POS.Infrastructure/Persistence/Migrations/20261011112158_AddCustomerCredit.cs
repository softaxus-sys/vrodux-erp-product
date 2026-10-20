using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.POS.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCustomerCredit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "CreditHold",
                schema: "pos",
                table: "customers",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "CreditHoldReason",
                schema: "pos",
                table: "customers",
                type: "nvarchar(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CreditTermsDays",
                schema: "pos",
                table: "customers",
                type: "int",
                nullable: false,
                defaultValue: 30);

            migrationBuilder.AddColumn<DateTime>(
                name: "DueOn",
                schema: "pos",
                table: "customer_wallet_transactions",
                type: "datetime2",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CreditHold",
                schema: "pos",
                table: "customers");

            migrationBuilder.DropColumn(
                name: "CreditHoldReason",
                schema: "pos",
                table: "customers");

            migrationBuilder.DropColumn(
                name: "CreditTermsDays",
                schema: "pos",
                table: "customers");

            migrationBuilder.DropColumn(
                name: "DueOn",
                schema: "pos",
                table: "customer_wallet_transactions");
        }
    }
}
