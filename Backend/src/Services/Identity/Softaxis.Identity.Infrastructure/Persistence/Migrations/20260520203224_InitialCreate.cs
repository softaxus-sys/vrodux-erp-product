using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Softaxis.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "identity");

            migrationBuilder.CreateTable(
                name: "permissions",
                schema: "identity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ModuleId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Action = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_permissions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "roles",
                schema: "identity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    IsSystem = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false, defaultValue: "system"),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    DeletedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_roles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "users",
                schema: "identity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    email = table.Column<string>(type: "nvarchar(254)", maxLength: 254, nullable: false),
                    Username = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    FirstName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    LastName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    PasswordHash = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    EmailVerified = table.Column<bool>(type: "bit", nullable: false),
                    AvatarUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    PhoneNumber = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    LastLoginAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    FailedLoginCount = table.Column<int>(type: "int", nullable: false),
                    LockedUntil = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false, defaultValue: "system"),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    DeletedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "role_permissions",
                schema: "identity",
                columns: table => new
                {
                    RoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PermissionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_role_permissions", x => new { x.RoleId, x.PermissionId });
                    table.ForeignKey(
                        name: "FK_role_permissions_permissions_PermissionId",
                        column: x => x.PermissionId,
                        principalSchema: "identity",
                        principalTable: "permissions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_role_permissions_roles_RoleId",
                        column: x => x.RoleId,
                        principalSchema: "identity",
                        principalTable: "roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "audit_logs",
                schema: "identity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Action = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    EntityType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    EntityId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    OldValues = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    NewValues = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IpAddress = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    UserAgent = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Succeeded = table.Column<bool>(type: "bit", nullable: false),
                    OccurredOn = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_audit_logs", x => x.Id);
                    table.CheckConstraint("ck_audit_logs_immutable", "1=1");
                    table.ForeignKey(
                        name: "FK_audit_logs_users_UserId",
                        column: x => x.UserId,
                        principalSchema: "identity",
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "refresh_tokens",
                schema: "identity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TokenHash = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedByIp = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    RevokedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RevokedByIp = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    ReplacedByTokenHash = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_refresh_tokens", x => x.Id);
                    table.ForeignKey(
                        name: "FK_refresh_tokens_users_UserId",
                        column: x => x.UserId,
                        principalSchema: "identity",
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "user_roles",
                schema: "identity",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AssignedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    AssignedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false, defaultValue: "system")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_roles", x => new { x.UserId, x.RoleId });
                    table.ForeignKey(
                        name: "FK_user_roles_roles_RoleId",
                        column: x => x.RoleId,
                        principalSchema: "identity",
                        principalTable: "roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_user_roles_users_UserId",
                        column: x => x.UserId,
                        principalSchema: "identity",
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                schema: "identity",
                table: "permissions",
                columns: new[] { "Id", "Action", "Description", "ModuleId" },
                values: new object[,]
                {
                    { new Guid("00851cd9-e968-dee3-b939-92f20f225761"), "create", "Create hr leaves", "hr.leaves" },
                    { new Guid("03bdd99b-663f-1163-6709-6270d3cba743"), "create", "Create settings users", "settings.users" },
                    { new Guid("08d6801a-51a4-d8b4-538e-9d60ff6eaf33"), "create", "Create hr payroll", "hr.payroll" },
                    { new Guid("09380234-5b0d-e57c-2f3b-4731527db4c6"), "export", "Export inventory movements", "inventory.movements" },
                    { new Guid("09dc5980-a3bd-e464-035f-5f2905d0aa5f"), "view", "View sales quotations", "sales.quotations" },
                    { new Guid("0a730d1f-5612-8b91-654d-31ea891064f7"), "delete", "Delete hr recruitment", "hr.recruitment" },
                    { new Guid("0b8987cb-2358-8f8f-aded-d9913b52d449"), "view", "View finance invoicing", "finance.invoicing" },
                    { new Guid("0d73186c-9868-2b7c-64db-79677c668f9b"), "print", "Print pos transactions", "pos.transactions" },
                    { new Guid("0d7bb139-0a34-c185-a1ea-eb62bbb5112f"), "edit", "Edit inventory stock", "inventory.stock" },
                    { new Guid("0db8f10b-92af-ded4-3150-a755eb7758d9"), "view", "View purchase vendors", "purchase.vendors" },
                    { new Guid("0e67bce5-3a80-d6b6-1415-2a04bbe9ee65"), "delete", "Delete purchase vendors", "purchase.vendors" },
                    { new Guid("0ed0ed95-f4e2-5bf5-f8cb-bf139d2e6392"), "approve", "Approve hr payroll", "hr.payroll" },
                    { new Guid("0f02656c-0cda-3b8d-1830-3bb2d4de379f"), "export", "Export crm customers", "crm.customers" },
                    { new Guid("10b9c004-bd5d-a6dc-a6a6-08dc6c0d22c3"), "view", "View hr recruitment", "hr.recruitment" },
                    { new Guid("1163928c-8faf-d6d0-7ac9-c6a8eb16d375"), "create", "Create finance gl", "finance.gl" },
                    { new Guid("12d040d1-56fa-8c03-95d7-983522eca589"), "view", "View inventory stock", "inventory.stock" },
                    { new Guid("142c5ebb-c03f-6a5e-e240-05300eccb6f6"), "approve", "Approve inventory transfers", "inventory.transfers" },
                    { new Guid("1516998e-3131-554f-a927-e3701add1736"), "edit", "Edit settings integrations", "settings.integrations" },
                    { new Guid("17a109bc-8cc2-5f9c-ec8c-123b7ebb01ec"), "view", "View purchase approvals", "purchase.approvals" },
                    { new Guid("1b4f2ce0-c5ed-be7d-726c-e2325e8a519d"), "discount", "Discount pos transactions", "pos.transactions" },
                    { new Guid("1cdb57c8-b2c5-050e-3b48-352ecbd3253c"), "edit", "Edit crm pipeline", "crm.pipeline" },
                    { new Guid("1d400ab9-b01d-c5e9-e815-320ec777ae61"), "create", "Create pos transactions", "pos.transactions" },
                    { new Guid("1db07341-3ec7-16df-c62a-f7db4a88cdb6"), "view", "View sales returns", "sales.returns" },
                    { new Guid("2039deff-d48a-7de1-a04c-66455068430e"), "export", "Export finance expenses", "finance.expenses" },
                    { new Guid("22c78c57-ae77-544d-b429-604a25d1868c"), "export", "Export sales orders", "sales.orders" },
                    { new Guid("259c60e2-6c13-092a-56f4-3228f1ef41a5"), "export", "Export purchase vendors", "purchase.vendors" },
                    { new Guid("25d6ff61-0de7-f925-a25a-eef7feae833e"), "view", "View pos products", "pos.products" },
                    { new Guid("25ec787a-af3b-0042-f7dd-c0edc02c46e7"), "create", "Create finance banking", "finance.banking" },
                    { new Guid("261e3c0b-aa92-361f-b67a-f471fc6377c4"), "view", "View settings audit", "settings.audit" },
                    { new Guid("2873be88-aeaa-4205-9101-fe48fc3a4a34"), "print", "Print purchase orders", "purchase.orders" },
                    { new Guid("2aab70c9-fabd-b8b0-9ce3-39be45c66c58"), "adjust", "Adjust inventory stock", "inventory.stock" },
                    { new Guid("2bc6429d-df19-9dd1-66f4-c980e29d888c"), "view", "View inventory transfers", "inventory.transfers" },
                    { new Guid("2db15f6d-1d40-1f1f-7481-cac26cbb7248"), "approve", "Approve finance expenses", "finance.expenses" },
                    { new Guid("35867692-e25e-1c77-7a77-65ab50c06a0e"), "create", "Create sales quotations", "sales.quotations" },
                    { new Guid("36f7a0d8-bb6b-ec6e-df3f-17ab3642397f"), "export", "Export finance invoicing", "finance.invoicing" },
                    { new Guid("3766ec26-fc01-82da-62c8-879218601587"), "export", "Export sales quotations", "sales.quotations" },
                    { new Guid("39cbaea2-69dc-b6e9-b4b2-a3b882de67be"), "delete", "Delete settings branches", "settings.branches" },
                    { new Guid("3c08a1af-731a-2597-38b7-9c685fd844f5"), "delete", "Delete finance accounting", "finance.accounting" },
                    { new Guid("3ff801b3-862e-b12b-3a91-c87da958fa4e"), "view", "View purchase orders", "purchase.orders" },
                    { new Guid("40e55301-1c6f-23f9-20bd-3a6c4f64d2ed"), "create", "Create finance expenses", "finance.expenses" },
                    { new Guid("421678da-7746-7031-3b42-13ebb17d3200"), "create", "Create sales orders", "sales.orders" },
                    { new Guid("42799ff4-cd81-eb9f-599d-773d8d0fcc82"), "edit", "Edit hr employees", "hr.employees" },
                    { new Guid("4337fccc-5f50-ebf0-7262-60cfc23d384a"), "export", "Export finance tax", "finance.tax" },
                    { new Guid("43f41588-55f8-3c94-47b5-077a2eb7f11d"), "export", "Export pos reports", "pos.reports" },
                    { new Guid("450a40f0-1f43-ac4b-8696-44e8f9946791"), "print", "Print finance journals", "finance.journals" },
                    { new Guid("45fde95e-6ee2-10f3-34a1-029e5040ea89"), "create", "Create purchase vendors", "purchase.vendors" },
                    { new Guid("47876f94-8ed6-4615-08aa-90cb3f0140c3"), "create", "Create hr recruitment", "hr.recruitment" },
                    { new Guid("47de56d8-7111-61ce-c5cd-4be228cebfaf"), "edit", "Edit finance journals", "finance.journals" },
                    { new Guid("4a91c1df-6ed2-3068-1eb5-d0f906a8340d"), "export", "Export inventory stock", "inventory.stock" },
                    { new Guid("4b2e8910-911f-f2d5-4a88-c019a51f64d9"), "delete", "Delete sales quotations", "sales.quotations" },
                    { new Guid("4bb726b4-4e3a-de23-1b53-d775ae7766ff"), "edit", "Edit settings general", "settings.general" },
                    { new Guid("4ef3b94d-c1b2-c694-060c-89dac598021a"), "edit", "Edit pos products", "pos.products" },
                    { new Guid("52c817c4-3c58-13ff-30cf-8cb3f4a7181a"), "create", "Create finance invoicing", "finance.invoicing" },
                    { new Guid("52ddb860-3193-6c3a-0ded-79ff611a879c"), "edit", "Edit finance invoicing", "finance.invoicing" },
                    { new Guid("5357e13f-c491-ccea-2062-2c548c61ba6e"), "edit", "Edit sales orders", "sales.orders" },
                    { new Guid("55755526-b800-551b-7992-b01c80f84d3f"), "view", "View finance journals", "finance.journals" },
                    { new Guid("5674e6bc-11ec-3e6e-6475-2fa42caf3e78"), "delete", "Delete settings roles", "settings.roles" },
                    { new Guid("56d5f2b5-1c28-3c4f-8480-e6f56f8dc48b"), "export", "Export crm leads", "crm.leads" },
                    { new Guid("57f8682a-d2e1-48cd-1661-b1451acfa308"), "view", "View hr attendance", "hr.attendance" },
                    { new Guid("58206a04-d33c-bd77-2cce-969a9503b144"), "export", "Export sales returns", "sales.returns" },
                    { new Guid("5b084af3-7561-b8ad-1f7d-277c7f394ba8"), "approve", "Approve sales quotations", "sales.quotations" },
                    { new Guid("5c325fdc-fff2-02fc-e3e8-c99164bc6d36"), "view", "View inventory movements", "inventory.movements" },
                    { new Guid("6124136a-7756-b13b-8a19-7b1b64c9773a"), "print", "Print sales quotations", "sales.quotations" },
                    { new Guid("62598b11-db9c-6015-f02e-8008c4d2210d"), "edit", "Edit purchase orders", "purchase.orders" },
                    { new Guid("631f2514-5a9b-4727-bc82-8addcbf31aee"), "edit", "Edit finance banking", "finance.banking" },
                    { new Guid("65741ea7-01d8-f15c-f88a-2340b6a7b32c"), "delete", "Delete finance invoicing", "finance.invoicing" },
                    { new Guid("68c2c635-8f5e-3308-657a-d48bbb0d0006"), "view", "View hr employees", "hr.employees" },
                    { new Guid("6a04e48d-fa7f-8fe9-3e0e-74edbbbb86e1"), "create", "Create finance accounting", "finance.accounting" },
                    { new Guid("6a38fad5-dab3-5912-d9b0-2f23d976a156"), "approve", "Approve hr leaves", "hr.leaves" },
                    { new Guid("6b611978-9231-03e0-2a8d-55a255a5f4bf"), "edit", "Edit finance tax", "finance.tax" },
                    { new Guid("6b82f536-a590-abd6-a145-5de8ce231ee0"), "approve", "Approve sales returns", "sales.returns" },
                    { new Guid("6fc00bfb-f3c8-cecc-fbe5-77011199ffb8"), "create", "Create sales returns", "sales.returns" },
                    { new Guid("702538eb-9040-0ad3-a670-1cb2f1f50675"), "edit", "Edit hr attendance", "hr.attendance" },
                    { new Guid("735e60ce-17e4-dbfd-cde1-358016347b9b"), "edit", "Edit crm leads", "crm.leads" },
                    { new Guid("749f2090-dfa2-4817-b2f4-65df02f416a5"), "view", "View finance budgeting", "finance.budgeting" },
                    { new Guid("74a7207a-1766-4fb4-efad-f7fe83c35fbd"), "create", "Create settings branches", "settings.branches" },
                    { new Guid("761dbde0-90bf-5fe1-3491-a40123848e8f"), "export", "Export inventory transfers", "inventory.transfers" },
                    { new Guid("78b08b61-dd2e-4683-e4de-4d078a38825c"), "view", "View hr performance", "hr.performance" },
                    { new Guid("78f1f772-a581-9a0e-c41c-f2bb642e92fe"), "delete", "Delete inventory stock", "inventory.stock" },
                    { new Guid("798d7327-cf70-de73-8c56-253dcea1289c"), "create", "Create pos products", "pos.products" },
                    { new Guid("79a62438-f821-8421-cf3c-d56904f14bd0"), "view", "View crm leads", "crm.leads" },
                    { new Guid("7bd87e96-2bd6-4e36-4208-0afbc79f5ce0"), "edit", "Edit purchase vendors", "purchase.vendors" },
                    { new Guid("7cd97338-5243-a31b-b03f-8a05f89c8fc6"), "export", "Export crm pipeline", "crm.pipeline" },
                    { new Guid("7f298efc-8130-666c-2a94-8ce31baa7384"), "delete", "Delete pos products", "pos.products" },
                    { new Guid("7f915ac1-9c18-f651-d366-2168634329e6"), "edit", "Edit settings users", "settings.users" },
                    { new Guid("806ea39b-dba2-df21-334a-f4d99377da0b"), "delete", "Delete inventory warehouses", "inventory.warehouses" },
                    { new Guid("8289e208-9cff-175e-92f7-e6d70907f387"), "approve", "Approve finance gl", "finance.gl" },
                    { new Guid("83ef5fb5-ffe6-3ba9-c67a-cd1a5f962135"), "edit", "Edit finance expenses", "finance.expenses" },
                    { new Guid("845123ad-5481-b26b-0118-0a1e957b8a03"), "view", "View finance accounting", "finance.accounting" },
                    { new Guid("84728a1a-f18b-73f9-6946-ebeb256a3812"), "export", "Export finance accounting", "finance.accounting" },
                    { new Guid("8508c5fc-ddb5-0975-d6dc-8b4b20efca03"), "view", "View finance gl", "finance.gl" },
                    { new Guid("8573d9f5-cdf9-9327-602a-02984606d445"), "create", "Create pos sessions", "pos.sessions" },
                    { new Guid("86ab676b-ee77-479c-1624-7bb6938decb9"), "export", "Export hr attendance", "hr.attendance" },
                    { new Guid("8866544e-af18-c401-6d80-b508ac2487eb"), "create", "Create purchase orders", "purchase.orders" },
                    { new Guid("88aff01f-acc0-552d-cff9-ff4da867c157"), "export", "Export finance gl", "finance.gl" },
                    { new Guid("8a968a19-e34e-c6f9-d3c6-6e1773219874"), "view", "View pos sessions", "pos.sessions" },
                    { new Guid("8bea5bd6-3281-badc-9d37-c48c5e68304c"), "edit", "Edit sales quotations", "sales.quotations" },
                    { new Guid("8ec6842e-fac7-53cc-9371-21711bf96e57"), "view", "View finance banking", "finance.banking" },
                    { new Guid("90583b87-eb65-747a-c43c-3fb59f02fbc3"), "approve", "Approve finance journals", "finance.journals" },
                    { new Guid("949f5297-cb11-55fe-0577-363d69638021"), "create", "Create inventory transfers", "inventory.transfers" },
                    { new Guid("94b139af-76e9-256a-d059-d86f449b1306"), "edit", "Edit inventory warehouses", "inventory.warehouses" },
                    { new Guid("979535a2-c577-72a3-0a02-1505c6137bfd"), "create", "Create inventory stock", "inventory.stock" },
                    { new Guid("98a99a98-e46c-35ca-f9b0-d563081a66f0"), "approve", "Approve finance budgeting", "finance.budgeting" },
                    { new Guid("999557ec-2542-c0c4-d4b1-50756133ae3a"), "create", "Create inventory movements", "inventory.movements" },
                    { new Guid("99ced367-20ed-f493-7962-879dd4e5c414"), "edit", "Edit finance gl", "finance.gl" },
                    { new Guid("9a7bcd5f-7ca1-5ecc-8510-916170531b40"), "export", "Export hr employees", "hr.employees" },
                    { new Guid("9b07f66d-daf9-0955-59be-305f376fdf56"), "edit", "Edit hr performance", "hr.performance" },
                    { new Guid("9bdc65a6-2f43-f578-4638-37de4e7df84c"), "view", "View settings general", "settings.general" },
                    { new Guid("9cf3758c-cd6d-f2f6-89c0-3936cd62030e"), "view", "View settings roles", "settings.roles" },
                    { new Guid("9dc5dbba-794a-6de8-14bb-b8abf5376350"), "print", "Print pos reports", "pos.reports" },
                    { new Guid("9f0f26ea-ac1d-05ee-ae2f-bfdd55cecaa1"), "approve", "Approve sales orders", "sales.orders" },
                    { new Guid("a06251f8-5567-2b5e-5306-aa6104396053"), "edit", "Edit settings branches", "settings.branches" },
                    { new Guid("a0f4acd9-3121-db4b-c620-c7aa71d2eaf8"), "delete", "Delete crm leads", "crm.leads" },
                    { new Guid("a2bbfd4e-e9fc-76d4-803a-22189426cf31"), "export", "Export purchase orders", "purchase.orders" },
                    { new Guid("a364b3d3-7551-ded0-cc05-c406bc7ae159"), "view", "View settings integrations", "settings.integrations" },
                    { new Guid("a488dc7e-080c-a214-6a38-dd8955ef38f1"), "print", "Print hr payroll", "hr.payroll" },
                    { new Guid("a4fe4013-b96e-0bb9-0f9c-44bd79b95c02"), "approve", "Approve finance invoicing", "finance.invoicing" },
                    { new Guid("a76c1be4-f17b-6e9d-2aff-07ae11771b4b"), "print", "Print finance invoicing", "finance.invoicing" },
                    { new Guid("a9bff2ba-d2ff-a758-e995-5139b3f1e767"), "export", "Export hr performance", "hr.performance" },
                    { new Guid("ac7952a0-cbdf-56c2-fdb5-bfade4312a0b"), "view", "View pos reports", "pos.reports" },
                    { new Guid("b1dd8c02-0230-2ada-1a1b-6043300b5cea"), "create", "Create hr employees", "hr.employees" },
                    { new Guid("b50c76d2-bedc-181d-0c0c-d66c681d41c2"), "create", "Create crm leads", "crm.leads" },
                    { new Guid("b5310148-f1f1-c1d7-da15-c8b6db74732f"), "approve", "Approve finance tax", "finance.tax" },
                    { new Guid("b6ad8a35-b8fb-798c-b9a2-9f6fdc493807"), "create", "Create hr performance", "hr.performance" },
                    { new Guid("b6cc81a9-56bb-042c-37e3-129a6d7d75b8"), "print", "Print sales orders", "sales.orders" },
                    { new Guid("b6f689c0-e154-5dcb-bd9c-52aecd48f003"), "view", "View finance tax", "finance.tax" },
                    { new Guid("b938f392-b592-0b05-6ca1-36fcaf076970"), "edit", "Edit finance budgeting", "finance.budgeting" },
                    { new Guid("b9da45f5-1e8a-4c58-9538-b5203879a508"), "create", "Create finance budgeting", "finance.budgeting" },
                    { new Guid("bc1adb71-bfd0-a90c-4a90-487f6488474a"), "export", "Export hr payroll", "hr.payroll" },
                    { new Guid("bc854ce2-13bd-2582-1b91-539b749f48e5"), "export", "Export finance budgeting", "finance.budgeting" },
                    { new Guid("bd8e8f62-3e0f-0881-c4e3-c97e66587e51"), "approve", "Approve pos sessions", "pos.sessions" },
                    { new Guid("bea957d2-6f47-8847-9eaf-8ce5dd47b3a4"), "create", "Create hr attendance", "hr.attendance" },
                    { new Guid("c151bc21-e8b1-4bcf-049c-85f43d2a2054"), "create", "Create finance journals", "finance.journals" },
                    { new Guid("c32f81ee-cc6a-b1f5-fc15-a5a4f83178a7"), "export", "Export finance journals", "finance.journals" },
                    { new Guid("c4ec0c4d-fa44-786c-618c-0a8c0978abed"), "view", "View settings branches", "settings.branches" },
                    { new Guid("c96b5653-6cac-645a-90bc-efadadad0234"), "void", "Void pos transactions", "pos.transactions" },
                    { new Guid("cc2a0879-75f7-4230-69ec-928afde57097"), "edit", "Edit hr leaves", "hr.leaves" },
                    { new Guid("cca9f732-e3b7-dcef-a839-9fbe553f467b"), "delete", "Delete finance expenses", "finance.expenses" },
                    { new Guid("ccc9a5e7-e602-c0fd-3a97-8d1bfce9b427"), "edit", "Edit hr recruitment", "hr.recruitment" },
                    { new Guid("cfb192eb-36ba-8e2c-6238-503306b7c22d"), "view", "View hr payroll", "hr.payroll" },
                    { new Guid("d1688e62-55aa-645c-1f43-95e20cbeeae5"), "delete", "Delete hr employees", "hr.employees" },
                    { new Guid("d21fb540-2870-4296-cc15-be61630c2c26"), "approve", "Approve purchase approvals", "purchase.approvals" },
                    { new Guid("d527ca7a-af89-5749-b303-a7cb3df3f425"), "view", "View crm pipeline", "crm.pipeline" },
                    { new Guid("d5e71685-7f8a-6037-e3b4-a9362bef7294"), "edit", "Edit finance accounting", "finance.accounting" },
                    { new Guid("d8010522-2afb-a9db-cb7f-4dca22798ac0"), "edit", "Edit crm customers", "crm.customers" },
                    { new Guid("d97815c8-92c0-794d-6358-4d08130b4566"), "create", "Create inventory warehouses", "inventory.warehouses" },
                    { new Guid("d9a2807f-166a-c688-a170-ff95f319d303"), "view", "View sales orders", "sales.orders" },
                    { new Guid("da82bd85-8e4e-ef72-ba4b-5b0afc5b7e1b"), "view", "View finance expenses", "finance.expenses" },
                    { new Guid("dc3ec71d-f469-730e-391a-699c2b68f888"), "refund", "Refund pos transactions", "pos.transactions" },
                    { new Guid("dc73e6c4-4878-f781-3315-66e1cb059e85"), "create", "Create crm customers", "crm.customers" },
                    { new Guid("dcae8e99-aa29-d21f-c7cb-d6668641613e"), "view", "View inventory warehouses", "inventory.warehouses" },
                    { new Guid("dd3c95f7-4edf-8d02-c910-37c077c289aa"), "print", "Print sales returns", "sales.returns" },
                    { new Guid("ddc9cdce-46f1-e3fc-d666-ff6293b68451"), "edit", "Edit settings roles", "settings.roles" },
                    { new Guid("dec37dd5-eec5-b587-b5fd-a187b3cf4e1a"), "view", "View settings users", "settings.users" },
                    { new Guid("e266623d-f395-40bb-d92b-8ae64b393594"), "create", "Create crm pipeline", "crm.pipeline" },
                    { new Guid("e2e0eda3-5001-071e-c9e1-9c3fc9eb2b5f"), "view", "View crm customers", "crm.customers" },
                    { new Guid("e336c05e-910b-4d5c-e329-67c7c6bb6513"), "approve", "Approve purchase orders", "purchase.orders" },
                    { new Guid("e4924a1b-db2f-b479-b05b-80c1765b5301"), "export", "Export finance banking", "finance.banking" },
                    { new Guid("e739ca62-4ba4-0139-5580-da339d74efd3"), "delete", "Delete settings users", "settings.users" },
                    { new Guid("e8000586-6ddf-1ad3-3af5-92ba967f2e18"), "export", "Export settings audit", "settings.audit" },
                    { new Guid("ea978f1f-ce9d-28b0-ee21-ab27de3a2264"), "adjust", "Adjust hr attendance", "hr.attendance" },
                    { new Guid("ebf79e7d-7ecb-4263-39aa-34c04ecbd8b4"), "view", "View pos transactions", "pos.transactions" },
                    { new Guid("edc0de3f-6682-4a50-fbe1-d52e417196b5"), "create", "Create finance tax", "finance.tax" },
                    { new Guid("edefa0bd-ae66-6cbb-5f1a-536ed8d7be17"), "create", "Create settings roles", "settings.roles" },
                    { new Guid("f0b98871-2695-51e7-1a0d-b22ec71126c9"), "delete", "Delete crm customers", "crm.customers" },
                    { new Guid("f2a0fdf3-679b-210c-4cec-96d3dc9af698"), "approve", "Approve finance banking", "finance.banking" },
                    { new Guid("f4953692-968a-5af8-43c7-5034bb034fc8"), "adjust", "Adjust inventory movements", "inventory.movements" },
                    { new Guid("f4c76f95-669c-ed81-b309-9922036d5c71"), "view", "View hr leaves", "hr.leaves" },
                    { new Guid("fd79a9bd-68d4-0f0f-f322-6571b1011db3"), "approve", "Approve finance accounting", "finance.accounting" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_audit_logs_UserId",
                schema: "identity",
                table: "audit_logs",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_permissions_ModuleId_Action",
                schema: "identity",
                table: "permissions",
                columns: new[] { "ModuleId", "Action" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_refresh_tokens_TokenHash",
                schema: "identity",
                table: "refresh_tokens",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_refresh_tokens_UserId",
                schema: "identity",
                table: "refresh_tokens",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_role_permissions_PermissionId",
                schema: "identity",
                table: "role_permissions",
                column: "PermissionId");

            migrationBuilder.CreateIndex(
                name: "IX_roles_Name",
                schema: "identity",
                table: "roles",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_user_roles_RoleId",
                schema: "identity",
                table: "user_roles",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "IX_users_email",
                schema: "identity",
                table: "users",
                column: "email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_users_Username",
                schema: "identity",
                table: "users",
                column: "Username",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "audit_logs",
                schema: "identity");

            migrationBuilder.DropTable(
                name: "refresh_tokens",
                schema: "identity");

            migrationBuilder.DropTable(
                name: "role_permissions",
                schema: "identity");

            migrationBuilder.DropTable(
                name: "user_roles",
                schema: "identity");

            migrationBuilder.DropTable(
                name: "permissions",
                schema: "identity");

            migrationBuilder.DropTable(
                name: "roles",
                schema: "identity");

            migrationBuilder.DropTable(
                name: "users",
                schema: "identity");
        }
    }
}
