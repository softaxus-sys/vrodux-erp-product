using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Library.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSameTitleReserveWait : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "SameTitleReserveAfterDays",
                schema: "library",
                table: "membership_types",
                type: "int",
                nullable: false,
                defaultValue: 1); // existing types keep the one-day wait
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SameTitleReserveAfterDays",
                schema: "library",
                table: "membership_types");
        }
    }
}
