using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTenantBranchServers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "BranchServersEnabled",
                schema: "identity",
                table: "tenants",
                type: "bit",
                nullable: false,
                defaultValue: false);

            // Workspaces that already issued branch keys keep working: they become "cloud + continuous operations".
            migrationBuilder.Sql(@"
                IF OBJECT_ID('[sync].[branch_keys]') IS NOT NULL
                BEGIN
                    EXEC('UPDATE [identity].[tenants] SET BranchServersEnabled = 1
                          WHERE DeploymentType = ''Cloud'' AND Id IN (SELECT DISTINCT TenantId FROM [sync].[branch_keys])');
                END");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BranchServersEnabled",
                schema: "identity",
                table: "tenants");
        }
    }
}
