using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.RealEstate.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddListingConfidentiality : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "AgentUserId",
                schema: "real_estate",
                table: "PropertyUnits",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_PropertyUnits_AgentUserId",
                schema: "real_estate",
                table: "PropertyUnits",
                column: "AgentUserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_PropertyUnits_AgentUserId",
                schema: "real_estate",
                table: "PropertyUnits");

            migrationBuilder.DropColumn(
                name: "AgentUserId",
                schema: "real_estate",
                table: "PropertyUnits");
        }
    }
}
