using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.CRM.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddActivityAssignee : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "AssignedToUserId",
                schema: "crm",
                table: "activities",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_activities_AssignedToUserId",
                schema: "crm",
                table: "activities",
                column: "AssignedToUserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_activities_AssignedToUserId",
                schema: "crm",
                table: "activities");

            migrationBuilder.DropColumn(
                name: "AssignedToUserId",
                schema: "crm",
                table: "activities");
        }
    }
}
