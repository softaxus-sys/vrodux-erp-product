using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class FixAppSettingsTenantUniqueness : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_app_settings_Category_Key",
                schema: "identity",
                table: "app_settings");

            migrationBuilder.DropIndex(
                name: "IX_app_settings_Category_Key_UserId",
                schema: "identity",
                table: "app_settings");

            migrationBuilder.CreateIndex(
                name: "IX_app_settings_TenantId_Category_Key",
                schema: "identity",
                table: "app_settings",
                columns: new[] { "TenantId", "Category", "Key" },
                unique: true,
                filter: "[UserId] IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_app_settings_TenantId_Category_Key_UserId",
                schema: "identity",
                table: "app_settings",
                columns: new[] { "TenantId", "Category", "Key", "UserId" },
                unique: true,
                filter: "[UserId] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_app_settings_TenantId_Category_Key",
                schema: "identity",
                table: "app_settings");

            migrationBuilder.DropIndex(
                name: "IX_app_settings_TenantId_Category_Key_UserId",
                schema: "identity",
                table: "app_settings");

            migrationBuilder.CreateIndex(
                name: "IX_app_settings_Category_Key",
                schema: "identity",
                table: "app_settings",
                columns: new[] { "Category", "Key" },
                unique: true,
                filter: "[UserId] IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_app_settings_Category_Key_UserId",
                schema: "identity",
                table: "app_settings",
                columns: new[] { "Category", "Key", "UserId" },
                unique: true,
                filter: "[UserId] IS NOT NULL");
        }
    }
}
