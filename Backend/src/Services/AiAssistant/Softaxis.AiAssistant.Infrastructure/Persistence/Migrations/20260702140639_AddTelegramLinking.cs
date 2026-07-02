using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.AiAssistant.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTelegramLinking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ProtectedTelegramBotToken",
                schema: "aiassistant",
                table: "tenant_ai_settings",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TelegramBotUsername",
                schema: "aiassistant",
                table: "tenant_ai_settings",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TelegramInboundKey",
                schema: "aiassistant",
                table: "tenant_ai_settings",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "user_telegram_links",
                schema: "aiassistant",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    LinkCode = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    TelegramChatId = table.Column<long>(type: "bigint", nullable: true),
                    TelegramUsername = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    IsLinked = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    LinkedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_telegram_links", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_user_telegram_links_LinkCode",
                schema: "aiassistant",
                table: "user_telegram_links",
                column: "LinkCode");

            migrationBuilder.CreateIndex(
                name: "IX_user_telegram_links_TelegramChatId",
                schema: "aiassistant",
                table: "user_telegram_links",
                column: "TelegramChatId");

            migrationBuilder.CreateIndex(
                name: "IX_user_telegram_links_TenantId",
                schema: "aiassistant",
                table: "user_telegram_links",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_user_telegram_links_UserId",
                schema: "aiassistant",
                table: "user_telegram_links",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "user_telegram_links",
                schema: "aiassistant");

            migrationBuilder.DropColumn(
                name: "ProtectedTelegramBotToken",
                schema: "aiassistant",
                table: "tenant_ai_settings");

            migrationBuilder.DropColumn(
                name: "TelegramBotUsername",
                schema: "aiassistant",
                table: "tenant_ai_settings");

            migrationBuilder.DropColumn(
                name: "TelegramInboundKey",
                schema: "aiassistant",
                table: "tenant_ai_settings");
        }
    }
}
