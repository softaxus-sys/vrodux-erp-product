using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.CRM.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLeadMarketingFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AdName",
                schema: "crm",
                table: "leads",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AdSetName",
                schema: "crm",
                table: "leads",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Budget",
                schema: "crm",
                table: "leads",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Campaign",
                schema: "crm",
                table: "leads",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CustomFields",
                schema: "crm",
                table: "leads",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FormName",
                schema: "crm",
                table: "leads",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "InterestedIn",
                schema: "crm",
                table: "leads",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsOrganic",
                schema: "crm",
                table: "leads",
                type: "bit",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Message",
                schema: "crm",
                table: "leads",
                type: "nvarchar(4000)",
                maxLength: 4000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Platform",
                schema: "crm",
                table: "leads",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PlatformCreatedTime",
                schema: "crm",
                table: "leads",
                type: "nvarchar(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WhatsApp",
                schema: "crm",
                table: "leads",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AdName",
                schema: "crm",
                table: "leads");

            migrationBuilder.DropColumn(
                name: "AdSetName",
                schema: "crm",
                table: "leads");

            migrationBuilder.DropColumn(
                name: "Budget",
                schema: "crm",
                table: "leads");

            migrationBuilder.DropColumn(
                name: "Campaign",
                schema: "crm",
                table: "leads");

            migrationBuilder.DropColumn(
                name: "CustomFields",
                schema: "crm",
                table: "leads");

            migrationBuilder.DropColumn(
                name: "FormName",
                schema: "crm",
                table: "leads");

            migrationBuilder.DropColumn(
                name: "InterestedIn",
                schema: "crm",
                table: "leads");

            migrationBuilder.DropColumn(
                name: "IsOrganic",
                schema: "crm",
                table: "leads");

            migrationBuilder.DropColumn(
                name: "Message",
                schema: "crm",
                table: "leads");

            migrationBuilder.DropColumn(
                name: "Platform",
                schema: "crm",
                table: "leads");

            migrationBuilder.DropColumn(
                name: "PlatformCreatedTime",
                schema: "crm",
                table: "leads");

            migrationBuilder.DropColumn(
                name: "WhatsApp",
                schema: "crm",
                table: "leads");
        }
    }
}
