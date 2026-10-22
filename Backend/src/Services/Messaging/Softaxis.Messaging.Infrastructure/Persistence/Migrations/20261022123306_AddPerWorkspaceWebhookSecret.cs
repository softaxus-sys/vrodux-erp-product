using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Messaging.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPerWorkspaceWebhookSecret : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AppSecretCipher",
                schema: "messaging",
                table: "wa_connections",
                type: "nvarchar(4000)",
                maxLength: 4000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WebhookVerifyToken",
                schema: "messaging",
                table: "wa_connections",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_wa_connections_WebhookVerifyToken",
                schema: "messaging",
                table: "wa_connections",
                column: "WebhookVerifyToken",
                unique: true,
                filter: "[WebhookVerifyToken] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_wa_connections_WebhookVerifyToken",
                schema: "messaging",
                table: "wa_connections");

            migrationBuilder.DropColumn(
                name: "AppSecretCipher",
                schema: "messaging",
                table: "wa_connections");

            migrationBuilder.DropColumn(
                name: "WebhookVerifyToken",
                schema: "messaging",
                table: "wa_connections");
        }
    }
}
