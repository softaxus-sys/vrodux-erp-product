using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Sales.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddQuotationDocumentAndTemplates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CoverNote",
                schema: "sales",
                table: "sales_quotations",
                type: "nvarchar(4000)",
                maxLength: 4000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CurrencyCode",
                schema: "sales",
                table: "sales_quotations",
                type: "nvarchar(3)",
                maxLength: 3,
                nullable: false,
                defaultValue: "");

            // Existing quotations predate the column, so EF backfills them with "". Stamp each
            // one with its own tenant's operating currency instead — that is what the UI has
            // always rendered them in, and an empty code would format as a bare number.
            // "identity" is a reserved keyword and must be bracketed.
            migrationBuilder.Sql("""
                UPDATE q
                SET    q.[CurrencyCode] = COALESCE(NULLIF(LEFT(t.[Currency], 3), ''), 'AED')
                FROM   [sales].[sales_quotations] q
                LEFT   JOIN [identity].[tenants] t ON t.[Id] = q.[TenantId]
                WHERE  q.[CurrencyCode] IS NULL OR q.[CurrencyCode] = '';
                """);

            migrationBuilder.AddColumn<string>(
                name: "CustomFields",
                schema: "sales",
                table: "sales_quotations",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CustomerAddress",
                schema: "sales",
                table: "sales_quotations",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CustomerEmail",
                schema: "sales",
                table: "sales_quotations",
                type: "nvarchar(320)",
                maxLength: 320,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CustomerPhone",
                schema: "sales",
                table: "sales_quotations",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "InvoiceId",
                schema: "sales",
                table: "sales_quotations",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "InvoiceNumber",
                schema: "sales",
                table: "sales_quotations",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "IssueDate",
                schema: "sales",
                table: "sales_quotations",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaymentTerms",
                schema: "sales",
                table: "sales_quotations",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PreparedByName",
                schema: "sales",
                table: "sales_quotations",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Reference",
                schema: "sales",
                table: "sales_quotations",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RespondedAt",
                schema: "sales",
                table: "sales_quotations",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RespondedByName",
                schema: "sales",
                table: "sales_quotations",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ResponseComment",
                schema: "sales",
                table: "sales_quotations",
                type: "nvarchar(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SentAt",
                schema: "sales",
                table: "sales_quotations",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SentTo",
                schema: "sales",
                table: "sales_quotations",
                type: "nvarchar(320)",
                maxLength: 320,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ShareToken",
                schema: "sales",
                table: "sales_quotations",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TermsAndConditions",
                schema: "sales",
                table: "sales_quotations",
                type: "nvarchar(max)",
                maxLength: 8000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Title",
                schema: "sales",
                table: "sales_quotations",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ViewedAt",
                schema: "sales",
                table: "sales_quotations",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsOptional",
                schema: "sales",
                table: "sales_quotation_items",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Notes",
                schema: "sales",
                table: "sales_quotation_items",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "SectionId",
                schema: "sales",
                table: "sales_quotation_items",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SortOrder",
                schema: "sales",
                table: "sales_quotation_items",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Unit",
                schema: "sales",
                table: "sales_quotation_items",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "quotation_templates",
                schema: "sales",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    TitleTemplate = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    CoverNote = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: true),
                    TermsAndConditions = table.Column<string>(type: "nvarchar(max)", maxLength: 8000, nullable: true),
                    PaymentTerms = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    FooterNote = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    ValidityDays = table.Column<int>(type: "int", nullable: false),
                    DefaultTaxRate = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: false),
                    DefaultDiscount = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: false),
                    AccentColor = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    ShowLogo = table.Column<bool>(type: "bit", nullable: false),
                    CustomFields = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IsDefault = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_quotation_templates", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "sales_quotation_sections",
                schema: "sales",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    QuotationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sales_quotation_sections", x => x.Id);
                    table.ForeignKey(
                        name: "FK_sales_quotation_sections_sales_quotations_QuotationId",
                        column: x => x.QuotationId,
                        principalSchema: "sales",
                        principalTable: "sales_quotations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "quotation_template_items",
                schema: "sales",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TemplateId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Unit = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    Quantity = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    UnitPrice = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    DiscountPercent = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: false),
                    TaxRate = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: false),
                    SectionTitle = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    IsOptional = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_quotation_template_items", x => x.Id);
                    table.ForeignKey(
                        name: "FK_quotation_template_items_quotation_templates_TemplateId",
                        column: x => x.TemplateId,
                        principalSchema: "sales",
                        principalTable: "quotation_templates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_sales_quotations_InvoiceId",
                schema: "sales",
                table: "sales_quotations",
                column: "InvoiceId");

            migrationBuilder.CreateIndex(
                name: "IX_sales_quotations_ShareToken",
                schema: "sales",
                table: "sales_quotations",
                column: "ShareToken",
                unique: true,
                filter: "[ShareToken] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_sales_quotation_items_SectionId",
                schema: "sales",
                table: "sales_quotation_items",
                column: "SectionId");

            migrationBuilder.CreateIndex(
                name: "IX_quotation_template_items_TemplateId",
                schema: "sales",
                table: "quotation_template_items",
                column: "TemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_quotation_template_items_TenantId",
                schema: "sales",
                table: "quotation_template_items",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_quotation_templates_TenantId",
                schema: "sales",
                table: "quotation_templates",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_sales_quotation_sections_QuotationId",
                schema: "sales",
                table: "sales_quotation_sections",
                column: "QuotationId");

            migrationBuilder.CreateIndex(
                name: "IX_sales_quotation_sections_TenantId",
                schema: "sales",
                table: "sales_quotation_sections",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "quotation_template_items",
                schema: "sales");

            migrationBuilder.DropTable(
                name: "sales_quotation_sections",
                schema: "sales");

            migrationBuilder.DropTable(
                name: "quotation_templates",
                schema: "sales");

            migrationBuilder.DropIndex(
                name: "IX_sales_quotations_InvoiceId",
                schema: "sales",
                table: "sales_quotations");

            migrationBuilder.DropIndex(
                name: "IX_sales_quotations_ShareToken",
                schema: "sales",
                table: "sales_quotations");

            migrationBuilder.DropIndex(
                name: "IX_sales_quotation_items_SectionId",
                schema: "sales",
                table: "sales_quotation_items");

            migrationBuilder.DropColumn(
                name: "CoverNote",
                schema: "sales",
                table: "sales_quotations");

            migrationBuilder.DropColumn(
                name: "CurrencyCode",
                schema: "sales",
                table: "sales_quotations");

            migrationBuilder.DropColumn(
                name: "CustomFields",
                schema: "sales",
                table: "sales_quotations");

            migrationBuilder.DropColumn(
                name: "CustomerAddress",
                schema: "sales",
                table: "sales_quotations");

            migrationBuilder.DropColumn(
                name: "CustomerEmail",
                schema: "sales",
                table: "sales_quotations");

            migrationBuilder.DropColumn(
                name: "CustomerPhone",
                schema: "sales",
                table: "sales_quotations");

            migrationBuilder.DropColumn(
                name: "InvoiceId",
                schema: "sales",
                table: "sales_quotations");

            migrationBuilder.DropColumn(
                name: "InvoiceNumber",
                schema: "sales",
                table: "sales_quotations");

            migrationBuilder.DropColumn(
                name: "IssueDate",
                schema: "sales",
                table: "sales_quotations");

            migrationBuilder.DropColumn(
                name: "PaymentTerms",
                schema: "sales",
                table: "sales_quotations");

            migrationBuilder.DropColumn(
                name: "PreparedByName",
                schema: "sales",
                table: "sales_quotations");

            migrationBuilder.DropColumn(
                name: "Reference",
                schema: "sales",
                table: "sales_quotations");

            migrationBuilder.DropColumn(
                name: "RespondedAt",
                schema: "sales",
                table: "sales_quotations");

            migrationBuilder.DropColumn(
                name: "RespondedByName",
                schema: "sales",
                table: "sales_quotations");

            migrationBuilder.DropColumn(
                name: "ResponseComment",
                schema: "sales",
                table: "sales_quotations");

            migrationBuilder.DropColumn(
                name: "SentAt",
                schema: "sales",
                table: "sales_quotations");

            migrationBuilder.DropColumn(
                name: "SentTo",
                schema: "sales",
                table: "sales_quotations");

            migrationBuilder.DropColumn(
                name: "ShareToken",
                schema: "sales",
                table: "sales_quotations");

            migrationBuilder.DropColumn(
                name: "TermsAndConditions",
                schema: "sales",
                table: "sales_quotations");

            migrationBuilder.DropColumn(
                name: "Title",
                schema: "sales",
                table: "sales_quotations");

            migrationBuilder.DropColumn(
                name: "ViewedAt",
                schema: "sales",
                table: "sales_quotations");

            migrationBuilder.DropColumn(
                name: "IsOptional",
                schema: "sales",
                table: "sales_quotation_items");

            migrationBuilder.DropColumn(
                name: "Notes",
                schema: "sales",
                table: "sales_quotation_items");

            migrationBuilder.DropColumn(
                name: "SectionId",
                schema: "sales",
                table: "sales_quotation_items");

            migrationBuilder.DropColumn(
                name: "SortOrder",
                schema: "sales",
                table: "sales_quotation_items");

            migrationBuilder.DropColumn(
                name: "Unit",
                schema: "sales",
                table: "sales_quotation_items");
        }
    }
}
