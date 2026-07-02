using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class MakeRoleNameUniquePerTenant : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotent: production may have had this index swapped manually as a hotfix
            // before this migration lands, so guard both operations.
            migrationBuilder.Sql(@"
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_roles_Name' AND object_id = OBJECT_ID('[identity].[roles]'))
    DROP INDEX [IX_roles_Name] ON [identity].[roles];
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_roles_TenantId_Name' AND object_id = OBJECT_ID('[identity].[roles]'))
    CREATE UNIQUE INDEX [IX_roles_TenantId_Name] ON [identity].[roles] ([TenantId], [Name]) WHERE [TenantId] IS NOT NULL;
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_roles_TenantId_Name' AND object_id = OBJECT_ID('[identity].[roles]'))
    DROP INDEX [IX_roles_TenantId_Name] ON [identity].[roles];
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_roles_Name' AND object_id = OBJECT_ID('[identity].[roles]'))
    CREATE UNIQUE INDEX [IX_roles_Name] ON [identity].[roles] ([Name]);
");
        }
    }
}
