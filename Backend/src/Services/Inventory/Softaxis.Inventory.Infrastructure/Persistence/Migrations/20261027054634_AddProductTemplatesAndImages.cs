using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Inventory.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddProductTemplatesAndImages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "HeightCm",
                schema: "inventory",
                table: "products",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "LengthCm",
                schema: "inventory",
                table: "products",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "SellOnline",
                schema: "inventory",
                table: "products",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TemplateId",
                schema: "inventory",
                table: "products",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "VariantOptionsJson",
                schema: "inventory",
                table: "products",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "WeightGrams",
                schema: "inventory",
                table: "products",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "WidthCm",
                schema: "inventory",
                table: "products",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "product_templates",
                schema: "inventory",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ShortDescription = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CategoryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BrandId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Slug = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    SeoTitle = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    MetaDescription = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: true),
                    Tags = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    OptionsJson = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: true),
                    PublishedOnline = table.Column<bool>(type: "bit", nullable: false),
                    PublishedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_product_templates", x => x.Id);
                    table.ForeignKey(
                        name: "FK_product_templates_brands_BrandId",
                        column: x => x.BrandId,
                        principalSchema: "inventory",
                        principalTable: "brands",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_product_templates_product_categories_CategoryId",
                        column: x => x.CategoryId,
                        principalSchema: "inventory",
                        principalTable: "product_categories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "product_images",
                schema: "inventory",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TemplateId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProductId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Data = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    ObjectKey = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: true),
                    ContentType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    SizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    FileName = table.Column<string>(type: "nvarchar(260)", maxLength: 260, nullable: true),
                    AltText = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    IsPrimary = table.Column<bool>(type: "bit", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_product_images", x => x.Id);
                    table.ForeignKey(
                        name: "FK_product_images_product_templates_TemplateId",
                        column: x => x.TemplateId,
                        principalSchema: "inventory",
                        principalTable: "product_templates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_products_TemplateId",
                schema: "inventory",
                table: "products",
                column: "TemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_product_images_ProductId",
                schema: "inventory",
                table: "product_images",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_product_images_TemplateId",
                schema: "inventory",
                table: "product_images",
                column: "TemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_product_images_TenantId",
                schema: "inventory",
                table: "product_images",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_product_templates_BrandId",
                schema: "inventory",
                table: "product_templates",
                column: "BrandId");

            migrationBuilder.CreateIndex(
                name: "IX_product_templates_CategoryId",
                schema: "inventory",
                table: "product_templates",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_product_templates_PublishedOnline",
                schema: "inventory",
                table: "product_templates",
                column: "PublishedOnline");

            migrationBuilder.CreateIndex(
                name: "IX_product_templates_TenantId",
                schema: "inventory",
                table: "product_templates",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_product_templates_TenantId_Slug",
                schema: "inventory",
                table: "product_templates",
                columns: new[] { "TenantId", "Slug" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");

            migrationBuilder.AddForeignKey(
                name: "FK_products_product_templates_TemplateId",
                schema: "inventory",
                table: "products",
                column: "TemplateId",
                principalSchema: "inventory",
                principalTable: "product_templates",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_products_product_templates_TemplateId",
                schema: "inventory",
                table: "products");

            migrationBuilder.DropTable(
                name: "product_images",
                schema: "inventory");

            migrationBuilder.DropTable(
                name: "product_templates",
                schema: "inventory");

            migrationBuilder.DropIndex(
                name: "IX_products_TemplateId",
                schema: "inventory",
                table: "products");

            migrationBuilder.DropColumn(
                name: "HeightCm",
                schema: "inventory",
                table: "products");

            migrationBuilder.DropColumn(
                name: "LengthCm",
                schema: "inventory",
                table: "products");

            migrationBuilder.DropColumn(
                name: "SellOnline",
                schema: "inventory",
                table: "products");

            migrationBuilder.DropColumn(
                name: "TemplateId",
                schema: "inventory",
                table: "products");

            migrationBuilder.DropColumn(
                name: "VariantOptionsJson",
                schema: "inventory",
                table: "products");

            migrationBuilder.DropColumn(
                name: "WeightGrams",
                schema: "inventory",
                table: "products");

            migrationBuilder.DropColumn(
                name: "WidthCm",
                schema: "inventory",
                table: "products");
        }
    }
}
