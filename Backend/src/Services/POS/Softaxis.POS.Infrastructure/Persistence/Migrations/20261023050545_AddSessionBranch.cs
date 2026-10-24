using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.POS.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSessionBranch : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "BranchId",
                schema: "pos",
                table: "pos_sessions",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_pos_sessions_BranchId_Status",
                schema: "pos",
                table: "pos_sessions",
                columns: new[] { "BranchId", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_pos_sessions_BranchId_Status",
                schema: "pos",
                table: "pos_sessions");

            migrationBuilder.DropColumn(
                name: "BranchId",
                schema: "pos",
                table: "pos_sessions");
        }
    }
}
