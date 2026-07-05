using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTenantCurrency : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Currency",
                schema: "identity",
                table: "tenants",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Currency",
                schema: "identity",
                table: "tenants");
        }
    }
}
