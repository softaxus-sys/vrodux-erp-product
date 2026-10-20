using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Finance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddUaeVatReturns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "uae_vat_profiles",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Trn = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: false),
                    NameEn = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    NameAr = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Address = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    DefaultEmirate = table.Column<string>(type: "nvarchar(3)", maxLength: 3, nullable: false),
                    TaxAgencyName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Tan = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    TaxAgentName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Taan = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_uae_vat_profiles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "vat_returns",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TaxPeriodId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PeriodLabel = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    FromDate = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    ToDate = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Trn = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: false),
                    OutputVat = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    InputVat = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    NetVat = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    BoxesJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IssuesJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ReconciliationJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    HasBlockingErrors = table.Column<bool>(type: "bit", nullable: false),
                    IsReconciled = table.Column<bool>(type: "bit", nullable: false),
                    FafContent = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ReturnXml = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ContentHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    IdempotencyKey = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    PreparedByName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    PreparedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ApprovedByUserId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ApprovedByName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    ApprovedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Environment = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    SubmissionReference = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    SubmittedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    AcknowledgedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RejectionReason = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    FiledByName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_vat_returns", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "vat_return_attempts",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VatReturnId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AttemptNumber = table.Column<int>(type: "int", nullable: false),
                    Environment = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    IdempotencyKey = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    ContentHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    StartedByName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    StartedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Outcome = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    HttpStatus = table.Column<int>(type: "int", nullable: true),
                    ExternalReference = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Message = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_vat_return_attempts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_vat_return_attempts_vat_returns_VatReturnId",
                        column: x => x.VatReturnId,
                        principalSchema: "finance",
                        principalTable: "vat_returns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_uae_vat_profiles_TenantId",
                schema: "finance",
                table: "uae_vat_profiles",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_vat_return_attempts_one_in_flight",
                schema: "finance",
                table: "vat_return_attempts",
                column: "VatReturnId",
                unique: true,
                filter: "[Outcome] = 'in_progress'");

            migrationBuilder.CreateIndex(
                name: "IX_vat_return_attempts_TenantId",
                schema: "finance",
                table: "vat_return_attempts",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_vat_returns_TaxPeriodId",
                schema: "finance",
                table: "vat_returns",
                column: "TaxPeriodId");

            migrationBuilder.CreateIndex(
                name: "IX_vat_returns_TenantId",
                schema: "finance",
                table: "vat_returns",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "uae_vat_profiles",
                schema: "finance");

            migrationBuilder.DropTable(
                name: "vat_return_attempts",
                schema: "finance");

            migrationBuilder.DropTable(
                name: "vat_returns",
                schema: "finance");
        }
    }
}
