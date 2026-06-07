using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Inventory.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddBrandAndUnitOfMeasure : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "BrandId",
                schema: "inventory",
                table: "products",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "UnitOfMeasureId",
                schema: "inventory",
                table: "products",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "brands",
                schema: "inventory",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Description = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    LogoUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_brands", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "units_of_measure",
                schema: "inventory",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Symbol = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_units_of_measure", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_products_BrandId",
                schema: "inventory",
                table: "products",
                column: "BrandId");

            migrationBuilder.CreateIndex(
                name: "IX_products_UnitOfMeasureId",
                schema: "inventory",
                table: "products",
                column: "UnitOfMeasureId");

            migrationBuilder.CreateIndex(
                name: "IX_brands_Code",
                schema: "inventory",
                table: "brands",
                column: "Code",
                unique: true,
                filter: "[Code] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_brands_Name",
                schema: "inventory",
                table: "brands",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_units_of_measure_Symbol",
                schema: "inventory",
                table: "units_of_measure",
                column: "Symbol",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_products_brands_BrandId",
                schema: "inventory",
                table: "products",
                column: "BrandId",
                principalSchema: "inventory",
                principalTable: "brands",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_products_units_of_measure_UnitOfMeasureId",
                schema: "inventory",
                table: "products",
                column: "UnitOfMeasureId",
                principalSchema: "inventory",
                principalTable: "units_of_measure",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_products_brands_BrandId",
                schema: "inventory",
                table: "products");

            migrationBuilder.DropForeignKey(
                name: "FK_products_units_of_measure_UnitOfMeasureId",
                schema: "inventory",
                table: "products");

            migrationBuilder.DropTable(
                name: "brands",
                schema: "inventory");

            migrationBuilder.DropTable(
                name: "units_of_measure",
                schema: "inventory");

            migrationBuilder.DropIndex(
                name: "IX_products_BrandId",
                schema: "inventory",
                table: "products");

            migrationBuilder.DropIndex(
                name: "IX_products_UnitOfMeasureId",
                schema: "inventory",
                table: "products");

            migrationBuilder.DropColumn(
                name: "BrandId",
                schema: "inventory",
                table: "products");

            migrationBuilder.DropColumn(
                name: "UnitOfMeasureId",
                schema: "inventory",
                table: "products");
        }
    }
}
