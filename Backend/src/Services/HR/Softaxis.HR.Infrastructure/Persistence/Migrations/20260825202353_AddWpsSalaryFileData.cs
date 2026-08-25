using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.HR.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddWpsSalaryFileData : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BankRoutingCode",
                schema: "hr",
                table: "employees",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LabourCardNumber",
                schema: "hr",
                table: "employees",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "wps_configurations",
                schema: "hr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EmployerUniqueId = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    EmployerBankRoutingCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    FileSequence = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_wps_configurations", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_wps_configurations_TenantId",
                schema: "hr",
                table: "wps_configurations",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "wps_configurations",
                schema: "hr");

            migrationBuilder.DropColumn(
                name: "BankRoutingCode",
                schema: "hr",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "LabourCardNumber",
                schema: "hr",
                table: "employees");
        }
    }
}
