using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.CRM.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLeadPurchaseTimeframe : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PurchaseTimeframe",
                schema: "crm",
                table: "leads",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PurchaseTimeframe",
                schema: "crm",
                table: "leads");
        }
    }
}
