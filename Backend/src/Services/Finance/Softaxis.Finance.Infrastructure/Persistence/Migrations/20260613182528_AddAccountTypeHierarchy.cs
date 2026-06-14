using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Finance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAccountTypeHierarchy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ParentId",
                schema: "finance",
                table: "account_types",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_account_types_ParentId_SortOrder",
                schema: "finance",
                table: "account_types",
                columns: new[] { "ParentId", "SortOrder" });

            migrationBuilder.AddForeignKey(
                name: "FK_account_types_account_types_ParentId",
                schema: "finance",
                table: "account_types",
                column: "ParentId",
                principalSchema: "finance",
                principalTable: "account_types",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_account_types_account_types_ParentId",
                schema: "finance",
                table: "account_types");

            migrationBuilder.DropIndex(
                name: "IX_account_types_ParentId_SortOrder",
                schema: "finance",
                table: "account_types");

            migrationBuilder.DropColumn(
                name: "ParentId",
                schema: "finance",
                table: "account_types");
        }
    }
}
