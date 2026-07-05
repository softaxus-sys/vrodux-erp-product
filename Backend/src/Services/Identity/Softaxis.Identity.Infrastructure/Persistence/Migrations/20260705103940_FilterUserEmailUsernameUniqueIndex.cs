using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class FilterUserEmailUsernameUniqueIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_users_email",
                schema: "identity",
                table: "users");

            migrationBuilder.DropIndex(
                name: "IX_users_Username",
                schema: "identity",
                table: "users");

            migrationBuilder.CreateIndex(
                name: "IX_users_email",
                schema: "identity",
                table: "users",
                column: "email",
                unique: true,
                filter: "[IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_users_Username",
                schema: "identity",
                table: "users",
                column: "Username",
                unique: true,
                filter: "[IsDeleted] = 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_users_email",
                schema: "identity",
                table: "users");

            migrationBuilder.DropIndex(
                name: "IX_users_Username",
                schema: "identity",
                table: "users");

            migrationBuilder.CreateIndex(
                name: "IX_users_email",
                schema: "identity",
                table: "users",
                column: "email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_users_Username",
                schema: "identity",
                table: "users",
                column: "Username",
                unique: true);
        }
    }
}
