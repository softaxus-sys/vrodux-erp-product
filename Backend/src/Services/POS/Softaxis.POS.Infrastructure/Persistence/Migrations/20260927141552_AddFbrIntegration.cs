using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.POS.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFbrIntegration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "FbrAttempts",
                schema: "pos",
                table: "pos_transactions",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "FbrInvoiceNumber",
                schema: "pos",
                table: "pos_transactions",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FbrLastError",
                schema: "pos",
                table: "pos_transactions",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "FbrNextAttemptAt",
                schema: "pos",
                table: "pos_transactions",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "FbrServiceFee",
                schema: "pos",
                table: "pos_transactions",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "FbrStatus",
                schema: "pos",
                table: "pos_transactions",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "FbrSubmittedAt",
                schema: "pos",
                table: "pos_transactions",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FbrDefaultPctCode",
                schema: "pos",
                table: "pos_settings",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "FbrEnabled",
                schema: "pos",
                table: "pos_settings",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "FbrEnvironment",
                schema: "pos",
                table: "pos_settings",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "sandbox");

            migrationBuilder.AddColumn<long>(
                name: "FbrPosId",
                schema: "pos",
                table: "pos_settings",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "FbrServiceFee",
                schema: "pos",
                table: "pos_settings",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 1m);

            migrationBuilder.AddColumn<string>(
                name: "FbrTokenProtected",
                schema: "pos",
                table: "pos_settings",
                type: "nvarchar(4000)",
                maxLength: 4000,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_pos_transactions_FbrStatus_FbrNextAttemptAt",
                schema: "pos",
                table: "pos_transactions",
                columns: new[] { "FbrStatus", "FbrNextAttemptAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_pos_transactions_FbrStatus_FbrNextAttemptAt",
                schema: "pos",
                table: "pos_transactions");

            migrationBuilder.DropColumn(
                name: "FbrAttempts",
                schema: "pos",
                table: "pos_transactions");

            migrationBuilder.DropColumn(
                name: "FbrInvoiceNumber",
                schema: "pos",
                table: "pos_transactions");

            migrationBuilder.DropColumn(
                name: "FbrLastError",
                schema: "pos",
                table: "pos_transactions");

            migrationBuilder.DropColumn(
                name: "FbrNextAttemptAt",
                schema: "pos",
                table: "pos_transactions");

            migrationBuilder.DropColumn(
                name: "FbrServiceFee",
                schema: "pos",
                table: "pos_transactions");

            migrationBuilder.DropColumn(
                name: "FbrStatus",
                schema: "pos",
                table: "pos_transactions");

            migrationBuilder.DropColumn(
                name: "FbrSubmittedAt",
                schema: "pos",
                table: "pos_transactions");

            migrationBuilder.DropColumn(
                name: "FbrDefaultPctCode",
                schema: "pos",
                table: "pos_settings");

            migrationBuilder.DropColumn(
                name: "FbrEnabled",
                schema: "pos",
                table: "pos_settings");

            migrationBuilder.DropColumn(
                name: "FbrEnvironment",
                schema: "pos",
                table: "pos_settings");

            migrationBuilder.DropColumn(
                name: "FbrPosId",
                schema: "pos",
                table: "pos_settings");

            migrationBuilder.DropColumn(
                name: "FbrServiceFee",
                schema: "pos",
                table: "pos_settings");

            migrationBuilder.DropColumn(
                name: "FbrTokenProtected",
                schema: "pos",
                table: "pos_settings");
        }
    }
}
