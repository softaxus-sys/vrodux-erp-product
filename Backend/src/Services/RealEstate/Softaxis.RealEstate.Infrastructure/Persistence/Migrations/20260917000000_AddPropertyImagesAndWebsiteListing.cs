using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.RealEstate.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPropertyImagesAndWebsiteListing : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "ListOnWebsite",
                schema: "real_estate",
                table: "Properties",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "PublishedAt",
                schema: "real_estate",
                table: "Properties",
                type: "datetime2",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "PropertyImages",
                schema: "real_estate",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PropertyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Data = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    ContentType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    FileName = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    Caption = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    IsPrimary = table.Column<bool>(type: "bit", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    OwnerTenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PropertyImages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PropertyImages_Properties_PropertyId",
                        column: x => x.PropertyId,
                        principalSchema: "real_estate",
                        principalTable: "Properties",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PropertyImages_OwnerTenantId",
                schema: "real_estate",
                table: "PropertyImages",
                column: "OwnerTenantId");

            migrationBuilder.CreateIndex(
                name: "IX_PropertyImages_PropertyId",
                schema: "real_estate",
                table: "PropertyImages",
                column: "PropertyId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PropertyImages",
                schema: "real_estate");

            migrationBuilder.DropColumn(
                name: "ListOnWebsite",
                schema: "real_estate",
                table: "Properties");

            migrationBuilder.DropColumn(
                name: "PublishedAt",
                schema: "real_estate",
                table: "Properties");
        }
    }
}
