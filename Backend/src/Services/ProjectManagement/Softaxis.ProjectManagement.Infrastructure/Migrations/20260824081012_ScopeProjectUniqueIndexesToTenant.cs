using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.ProjectManagement.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ScopeProjectUniqueIndexesToTenant : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_projects_Key",
                schema: "projectmanagement",
                table: "projects");

            migrationBuilder.CreateIndex(
                name: "IX_projects_TenantId_Key",
                schema: "projectmanagement",
                table: "projects",
                columns: new[] { "TenantId", "Key" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_projects_TenantId_Key",
                schema: "projectmanagement",
                table: "projects");

            migrationBuilder.CreateIndex(
                name: "IX_projects_Key",
                schema: "projectmanagement",
                table: "projects",
                column: "Key",
                unique: true);
        }
    }
}
