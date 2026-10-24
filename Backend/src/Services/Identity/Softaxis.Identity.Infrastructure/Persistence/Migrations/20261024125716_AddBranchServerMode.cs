using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddBranchServerMode : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ServerMode",
                schema: "identity",
                table: "branches",
                type: "nvarchar(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "cloud");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ServerMode",
                schema: "identity",
                table: "branches");
        }
    }
}
