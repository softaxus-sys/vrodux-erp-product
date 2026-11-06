using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Finance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEInvoicing : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "CreditedAmount",
                schema: "finance",
                table: "invoices",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateTable(
                name: "credit_notes",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreditNoteNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    InvoiceId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    InvoiceNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    CustomerId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CustomerName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    CustomerEmail = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    CustomerAddress = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CustomerTrn = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    CreditDate = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    TaxRate = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: false),
                    CurrencyCode = table.Column<string>(type: "nvarchar(3)", maxLength: 3, nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    JournalEntryId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IssuedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_credit_notes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_credit_notes_invoices_InvoiceId",
                        column: x => x.InvoiceId,
                        principalSchema: "finance",
                        principalTable: "invoices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "einvoice_settings",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProviderKey = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    Environment = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: false),
                    Enabled = table.Column<bool>(type: "bit", nullable: false),
                    GoLiveDate = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    LegalIdScheme = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    LegalId = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: true),
                    RegistrationAuthority = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    SupplierCity = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_einvoice_settings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "einvoice_submissions",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DocumentType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    DocumentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DocumentNumber = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: false),
                    ProviderKey = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Attempts = table.Column<int>(type: "int", nullable: false),
                    NextAttemptAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ExternalId = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    LastError = table.Column<string>(type: "nvarchar(1500)", maxLength: 1500, nullable: true),
                    XmlSnapshot = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    PayloadHash = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    SentAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_einvoice_submissions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "credit_note_items",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreditNoteId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Quantity = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    UnitPrice = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    TaxCategory = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    UnitCode = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    ExemptionReason = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_credit_note_items", x => x.Id);
                    table.ForeignKey(
                        name: "FK_credit_note_items_credit_notes_CreditNoteId",
                        column: x => x.CreditNoteId,
                        principalSchema: "finance",
                        principalTable: "credit_notes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_credit_note_items_CreditNoteId",
                schema: "finance",
                table: "credit_note_items",
                column: "CreditNoteId");

            migrationBuilder.CreateIndex(
                name: "IX_credit_note_items_TenantId",
                schema: "finance",
                table: "credit_note_items",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_credit_notes_InvoiceId",
                schema: "finance",
                table: "credit_notes",
                column: "InvoiceId");

            migrationBuilder.CreateIndex(
                name: "IX_credit_notes_TenantId",
                schema: "finance",
                table: "credit_notes",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_credit_notes_TenantId_CreditNoteNumber",
                schema: "finance",
                table: "credit_notes",
                columns: new[] { "TenantId", "CreditNoteNumber" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_einvoice_settings_TenantId",
                schema: "finance",
                table: "einvoice_settings",
                column: "TenantId",
                unique: true,
                filter: "[TenantId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_einvoice_submissions_Status_NextAttemptAt",
                schema: "finance",
                table: "einvoice_submissions",
                columns: new[] { "Status", "NextAttemptAt" });

            migrationBuilder.CreateIndex(
                name: "IX_einvoice_submissions_TenantId",
                schema: "finance",
                table: "einvoice_submissions",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_einvoice_submissions_TenantId_DocumentType_DocumentId",
                schema: "finance",
                table: "einvoice_submissions",
                columns: new[] { "TenantId", "DocumentType", "DocumentId" },
                unique: true,
                filter: "[TenantId] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "credit_note_items",
                schema: "finance");

            migrationBuilder.DropTable(
                name: "einvoice_settings",
                schema: "finance");

            migrationBuilder.DropTable(
                name: "einvoice_submissions",
                schema: "finance");

            migrationBuilder.DropTable(
                name: "credit_notes",
                schema: "finance");

            migrationBuilder.DropColumn(
                name: "CreditedAmount",
                schema: "finance",
                table: "invoices");
        }
    }
}
