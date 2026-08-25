using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.HR.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEmployeePersonalAndBankDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BankAccount",
                schema: "hr",
                table: "employees",
                type: "nvarchar(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EmiratesId",
                schema: "hr",
                table: "employees",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Iban",
                schema: "hr",
                table: "employees",
                type: "nvarchar(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MedicalInsurance",
                schema: "hr",
                table: "employees",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Nationality",
                schema: "hr",
                table: "employees",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PassportNumber",
                schema: "hr",
                table: "employees",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReportingTo",
                schema: "hr",
                table: "employees",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "VisaExpiry",
                schema: "hr",
                table: "employees",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BankAccount",
                schema: "hr",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "EmiratesId",
                schema: "hr",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "Iban",
                schema: "hr",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "MedicalInsurance",
                schema: "hr",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "Nationality",
                schema: "hr",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "PassportNumber",
                schema: "hr",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "ReportingTo",
                schema: "hr",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "VisaExpiry",
                schema: "hr",
                table: "employees");
        }
    }
}
