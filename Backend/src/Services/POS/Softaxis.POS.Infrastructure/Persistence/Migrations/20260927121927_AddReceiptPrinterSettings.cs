using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.POS.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddReceiptPrinterSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PrinterIp",
                schema: "pos",
                table: "pos_settings",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PrinterMode",
                schema: "pos",
                table: "pos_settings",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PrinterName",
                schema: "pos",
                table: "pos_settings",
                type: "nvarchar(256)",
                maxLength: 256,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PrinterPort",
                schema: "pos",
                table: "pos_settings",
                type: "int",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PrinterIp",
                schema: "pos",
                table: "pos_settings");

            migrationBuilder.DropColumn(
                name: "PrinterMode",
                schema: "pos",
                table: "pos_settings");

            migrationBuilder.DropColumn(
                name: "PrinterName",
                schema: "pos",
                table: "pos_settings");

            migrationBuilder.DropColumn(
                name: "PrinterPort",
                schema: "pos",
                table: "pos_settings");
        }
    }
}
