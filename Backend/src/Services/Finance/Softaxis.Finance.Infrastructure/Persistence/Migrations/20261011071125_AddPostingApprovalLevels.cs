using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Finance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPostingApprovalLevels : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "SubmittedAt",
                schema: "finance",
                table: "posting_items",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SubmittedByName",
                schema: "finance",
                table: "posting_items",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "SubmittedByUserId",
                schema: "finance",
                table: "posting_items",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ApprovalLimit",
                schema: "finance",
                table: "integration_settings",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "RequireSeparateApprover",
                schema: "finance",
                table: "integration_settings",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SubmittedAt",
                schema: "finance",
                table: "posting_items");

            migrationBuilder.DropColumn(
                name: "SubmittedByName",
                schema: "finance",
                table: "posting_items");

            migrationBuilder.DropColumn(
                name: "SubmittedByUserId",
                schema: "finance",
                table: "posting_items");

            migrationBuilder.DropColumn(
                name: "ApprovalLimit",
                schema: "finance",
                table: "integration_settings");

            migrationBuilder.DropColumn(
                name: "RequireSeparateApprover",
                schema: "finance",
                table: "integration_settings");
        }
    }
}
