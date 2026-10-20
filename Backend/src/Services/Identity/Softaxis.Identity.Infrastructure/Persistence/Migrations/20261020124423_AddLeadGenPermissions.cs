using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Softaxis.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLeadGenPermissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                schema: "identity",
                table: "permissions",
                columns: new[] { "Id", "Action", "Description", "ModuleId" },
                values: new object[,]
                {
                    { new Guid("01c4b492-f6e9-a6bb-4862-dd8216431f1b"), "reveal", "Reveal leadgen prospects", "leadgen.prospects" },
                    { new Guid("0b3916c5-4a64-a6e6-259f-540d324f911b"), "view", "View leadgen searches", "leadgen.searches" },
                    { new Guid("20fc4191-de6c-b120-8320-33bf0b3bf06a"), "import", "Import leadgen prospects", "leadgen.prospects" },
                    { new Guid("212f1e83-ad9a-441c-6c0e-8991804d4e42"), "create", "Create leadgen prospects", "leadgen.prospects" },
                    { new Guid("28f331b6-a573-fbae-8d77-486a570a94e5"), "export", "Export leadgen reports", "leadgen.reports" },
                    { new Guid("28f99e50-8620-09f2-9a7c-f5783ee5a240"), "view", "View leadgen campaigns", "leadgen.campaigns" },
                    { new Guid("3134a989-39fc-2a22-18de-2f1eee6e963c"), "edit", "Edit leadgen settings", "leadgen.settings" },
                    { new Guid("3e4f85f6-5574-a222-c67b-ef753c392e92"), "edit", "Edit leadgen mailboxes", "leadgen.mailboxes" },
                    { new Guid("3f014554-447e-fbfc-22c8-b808846dd013"), "view", "View leadgen mailboxes", "leadgen.mailboxes" },
                    { new Guid("42364707-a6bd-06d0-8009-efe63554a022"), "send", "Send leadgen campaigns", "leadgen.campaigns" },
                    { new Guid("4338c152-eecd-41a2-5c1e-7fa225504a39"), "create", "Create leadgen searches", "leadgen.searches" },
                    { new Guid("4b1feb72-be00-33b6-d842-5f3cd067ad7e"), "create", "Create leadgen campaigns", "leadgen.campaigns" },
                    { new Guid("55309f80-e064-7d8f-e90a-fc527928c232"), "view", "View leadgen settings", "leadgen.settings" },
                    { new Guid("556786f9-9f17-f44d-15c4-17e49c887682"), "view", "View leadgen prospects", "leadgen.prospects" },
                    { new Guid("620eeb53-bf39-0b8f-136f-a552b34827c4"), "create", "Create leadgen mailboxes", "leadgen.mailboxes" },
                    { new Guid("7a77050e-a71d-4383-fdf6-0e33da49116a"), "send", "Send leadgen inbox", "leadgen.inbox" },
                    { new Guid("85243459-3069-ea0b-bff3-0ad703085afb"), "view", "View leadgen credits", "leadgen.credits" },
                    { new Guid("8f9afe00-ead8-5c25-d35b-0163e648c132"), "create", "Create leadgen credits", "leadgen.credits" },
                    { new Guid("959fc4b5-0e07-5f19-d6c2-70c25815b7a1"), "delete", "Delete leadgen campaigns", "leadgen.campaigns" },
                    { new Guid("9824f8ea-247c-ecc5-0707-dc102eb9859f"), "delete", "Delete leadgen searches", "leadgen.searches" },
                    { new Guid("a07e8e48-6653-a353-6ccd-ed35e6594aef"), "view", "View leadgen reports", "leadgen.reports" },
                    { new Guid("a6506256-8b37-b440-278a-d7ca9c25e488"), "view", "View leadgen inbox", "leadgen.inbox" },
                    { new Guid("b2796ac5-5559-8c29-bc10-4dbdb19ec50e"), "edit", "Edit leadgen credits", "leadgen.credits" },
                    { new Guid("b964efce-9b98-f406-7404-50995531d08a"), "edit", "Edit leadgen campaigns", "leadgen.campaigns" },
                    { new Guid("be438cf9-a15c-8dc6-b2ec-0d838fc9d14c"), "delete", "Delete leadgen mailboxes", "leadgen.mailboxes" },
                    { new Guid("e96b8092-5c32-5353-f405-f9dc3ec9e33a"), "edit", "Edit leadgen inbox", "leadgen.inbox" },
                    { new Guid("f2b4675d-70a0-b1c8-2fbd-2dc27ca3d5cb"), "export", "Export leadgen prospects", "leadgen.prospects" },
                    { new Guid("fc5d5de6-a1a4-6ea1-dba9-ac48f685faf1"), "delete", "Delete leadgen prospects", "leadgen.prospects" },
                    { new Guid("fcdf50e8-27b0-2e9e-37f9-126367dc3c86"), "edit", "Edit leadgen prospects", "leadgen.prospects" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("01c4b492-f6e9-a6bb-4862-dd8216431f1b"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("0b3916c5-4a64-a6e6-259f-540d324f911b"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("20fc4191-de6c-b120-8320-33bf0b3bf06a"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("212f1e83-ad9a-441c-6c0e-8991804d4e42"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("28f331b6-a573-fbae-8d77-486a570a94e5"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("28f99e50-8620-09f2-9a7c-f5783ee5a240"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("3134a989-39fc-2a22-18de-2f1eee6e963c"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("3e4f85f6-5574-a222-c67b-ef753c392e92"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("3f014554-447e-fbfc-22c8-b808846dd013"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("42364707-a6bd-06d0-8009-efe63554a022"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("4338c152-eecd-41a2-5c1e-7fa225504a39"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("4b1feb72-be00-33b6-d842-5f3cd067ad7e"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("55309f80-e064-7d8f-e90a-fc527928c232"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("556786f9-9f17-f44d-15c4-17e49c887682"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("620eeb53-bf39-0b8f-136f-a552b34827c4"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("7a77050e-a71d-4383-fdf6-0e33da49116a"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("85243459-3069-ea0b-bff3-0ad703085afb"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("8f9afe00-ead8-5c25-d35b-0163e648c132"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("959fc4b5-0e07-5f19-d6c2-70c25815b7a1"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("9824f8ea-247c-ecc5-0707-dc102eb9859f"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("a07e8e48-6653-a353-6ccd-ed35e6594aef"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("a6506256-8b37-b440-278a-d7ca9c25e488"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("b2796ac5-5559-8c29-bc10-4dbdb19ec50e"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("b964efce-9b98-f406-7404-50995531d08a"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("be438cf9-a15c-8dc6-b2ec-0d838fc9d14c"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("e96b8092-5c32-5353-f405-f9dc3ec9e33a"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("f2b4675d-70a0-b1c8-2fbd-2dc27ca3d5cb"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("fc5d5de6-a1a4-6ea1-dba9-ac48f685faf1"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("fcdf50e8-27b0-2e9e-37f9-126367dc3c86"));
        }
    }
}
