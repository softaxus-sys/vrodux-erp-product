using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddRefreshTokenDeviceInfo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_refresh_tokens_UserId",
                schema: "identity",
                table: "refresh_tokens");

            migrationBuilder.AddColumn<string>(
                name: "DeviceId",
                schema: "identity",
                table: "refresh_tokens",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeviceName",
                schema: "identity",
                table: "refresh_tokens",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Platform",
                schema: "identity",
                table: "refresh_tokens",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_refresh_tokens_UserId_DeviceId",
                schema: "identity",
                table: "refresh_tokens",
                columns: new[] { "UserId", "DeviceId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_refresh_tokens_UserId_DeviceId",
                schema: "identity",
                table: "refresh_tokens");

            migrationBuilder.DropColumn(
                name: "DeviceId",
                schema: "identity",
                table: "refresh_tokens");

            migrationBuilder.DropColumn(
                name: "DeviceName",
                schema: "identity",
                table: "refresh_tokens");

            migrationBuilder.DropColumn(
                name: "Platform",
                schema: "identity",
                table: "refresh_tokens");

            migrationBuilder.CreateIndex(
                name: "IX_refresh_tokens_UserId",
                schema: "identity",
                table: "refresh_tokens",
                column: "UserId");
        }
    }
}
