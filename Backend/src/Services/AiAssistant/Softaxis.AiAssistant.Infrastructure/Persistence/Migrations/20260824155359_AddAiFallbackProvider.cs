using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.AiAssistant.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAiFallbackProvider : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "FallbackModel",
                schema: "aiassistant",
                table: "tenant_ai_settings",
                type: "nvarchar(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FallbackProtectedApiKey",
                schema: "aiassistant",
                table: "tenant_ai_settings",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FallbackProvider",
                schema: "aiassistant",
                table: "tenant_ai_settings",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "UsedFallback",
                schema: "aiassistant",
                table: "ai_chat_messages",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FallbackModel",
                schema: "aiassistant",
                table: "tenant_ai_settings");

            migrationBuilder.DropColumn(
                name: "FallbackProtectedApiKey",
                schema: "aiassistant",
                table: "tenant_ai_settings");

            migrationBuilder.DropColumn(
                name: "FallbackProvider",
                schema: "aiassistant",
                table: "tenant_ai_settings");

            migrationBuilder.DropColumn(
                name: "UsedFallback",
                schema: "aiassistant",
                table: "ai_chat_messages");
        }
    }
}
