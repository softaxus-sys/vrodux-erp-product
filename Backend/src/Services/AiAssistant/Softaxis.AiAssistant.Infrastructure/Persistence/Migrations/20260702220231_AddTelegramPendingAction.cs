using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.AiAssistant.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTelegramPendingAction : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PendingArgumentsJson",
                schema: "aiassistant",
                table: "user_telegram_links",
                type: "nvarchar(4000)",
                maxLength: 4000,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PendingCreatedAt",
                schema: "aiassistant",
                table: "user_telegram_links",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PendingSummary",
                schema: "aiassistant",
                table: "user_telegram_links",
                type: "nvarchar(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PendingToolName",
                schema: "aiassistant",
                table: "user_telegram_links",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PendingArgumentsJson",
                schema: "aiassistant",
                table: "user_telegram_links");

            migrationBuilder.DropColumn(
                name: "PendingCreatedAt",
                schema: "aiassistant",
                table: "user_telegram_links");

            migrationBuilder.DropColumn(
                name: "PendingSummary",
                schema: "aiassistant",
                table: "user_telegram_links");

            migrationBuilder.DropColumn(
                name: "PendingToolName",
                schema: "aiassistant",
                table: "user_telegram_links");
        }
    }
}
