using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.VisaServices.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialVisaServices : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "visa");

            migrationBuilder.CreateTable(
                name: "applicants",
                schema: "visa",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VisaCaseId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FirstName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    LastName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Nationality = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    PassportNumber = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    PassportExpiry = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    DateOfBirth = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    EmiratesId = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    UidNumber = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    Relationship = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "primary"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_applicants", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "case_documents",
                schema: "visa",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VisaCaseId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ApplicantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "pending"),
                    FileUrl = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    ExpiryDate = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_case_documents", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "case_status_events",
                schema: "visa",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VisaCaseId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EventType = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    FromStatus = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    ToStatus = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    Note = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    ByName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_case_status_events", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "visa_cases",
                schema: "visa",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CaseNumber = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    VisaTypeId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VisaTypeName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Channel = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "manual"),
                    Emirate = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    CustomerId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CustomerName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "draft"),
                    Priority = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "medium"),
                    AssignedTo = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    ServiceFee = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    GovtFee = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    GovtReference = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    SlaDueDate = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    RejectionReason = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_visa_cases", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "visa_types",
                schema: "visa",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Category = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Channel = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "manual"),
                    DefaultGovtFee = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    DefaultServiceFee = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    ProcessingDays = table.Column<int>(type: "int", nullable: false),
                    RequiredDocuments = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_visa_types", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_applicants_PassportNumber",
                schema: "visa",
                table: "applicants",
                column: "PassportNumber");

            migrationBuilder.CreateIndex(
                name: "IX_applicants_TenantId",
                schema: "visa",
                table: "applicants",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_applicants_VisaCaseId",
                schema: "visa",
                table: "applicants",
                column: "VisaCaseId");

            migrationBuilder.CreateIndex(
                name: "IX_case_documents_TenantId",
                schema: "visa",
                table: "case_documents",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_case_documents_VisaCaseId",
                schema: "visa",
                table: "case_documents",
                column: "VisaCaseId");

            migrationBuilder.CreateIndex(
                name: "IX_case_status_events_TenantId",
                schema: "visa",
                table: "case_status_events",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_case_status_events_VisaCaseId",
                schema: "visa",
                table: "case_status_events",
                column: "VisaCaseId");

            migrationBuilder.CreateIndex(
                name: "IX_visa_cases_CaseNumber",
                schema: "visa",
                table: "visa_cases",
                column: "CaseNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_visa_cases_CustomerId",
                schema: "visa",
                table: "visa_cases",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_visa_cases_Status",
                schema: "visa",
                table: "visa_cases",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_visa_cases_TenantId",
                schema: "visa",
                table: "visa_cases",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_visa_types_Code",
                schema: "visa",
                table: "visa_types",
                column: "Code",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "applicants",
                schema: "visa");

            migrationBuilder.DropTable(
                name: "case_documents",
                schema: "visa");

            migrationBuilder.DropTable(
                name: "case_status_events",
                schema: "visa");

            migrationBuilder.DropTable(
                name: "visa_cases",
                schema: "visa");

            migrationBuilder.DropTable(
                name: "visa_types",
                schema: "visa");
        }
    }
}
