using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class FilterTenantSlugUniqueIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_tenants_Slug",
                schema: "identity",
                table: "tenants");

            migrationBuilder.CreateIndex(
                name: "IX_tenants_Slug",
                schema: "identity",
                table: "tenants",
                column: "Slug",
                unique: true,
                filter: "[IsDeleted] = 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_tenants_Slug",
                schema: "identity",
                table: "tenants");

            migrationBuilder.CreateIndex(
                name: "IX_tenants_Slug",
                schema: "identity",
                table: "tenants",
                column: "Slug",
                unique: true);
        }
    }
}
