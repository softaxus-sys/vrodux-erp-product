using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Softaxis.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddProjectManagementPermissions : Migration
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
                    { new Guid("00bd5152-4790-6bec-38c8-04fc3e683c69"), "edit", "Edit project-management boards", "project-management.boards" },
                    { new Guid("051c3686-5005-352e-2ecc-139a91256248"), "view", "View project-management issues", "project-management.issues" },
                    { new Guid("16a51a80-e82c-cf90-ff42-9d45fb65cdb8"), "create", "Create project-management projects", "project-management.projects" },
                    { new Guid("18671174-7bec-d1df-8b9e-86b1fbea0579"), "delete", "Delete project-management sprints", "project-management.sprints" },
                    { new Guid("40d8dcfe-99b8-8d64-fc4a-77a38a87ed9f"), "edit", "Edit project-management sprints", "project-management.sprints" },
                    { new Guid("47f38351-9553-b3e5-fe74-c550bf76bfc9"), "create", "Create project-management labels", "project-management.labels" },
                    { new Guid("489e93f5-766a-81e6-137e-5b83f12c0c49"), "delete", "Delete project-management issues", "project-management.issues" },
                    { new Guid("5c8ef311-9483-1edb-abac-157b94360757"), "view", "View project-management projects", "project-management.projects" },
                    { new Guid("a107e633-3277-4767-3293-e5ed4275ec8b"), "delete", "Delete project-management projects", "project-management.projects" },
                    { new Guid("b1cfa67d-ea33-315d-acf1-b88ae01143fe"), "create", "Create project-management sprints", "project-management.sprints" },
                    { new Guid("b38d69f2-9808-4eff-51b0-070eaf7a5980"), "view", "View project-management sprints", "project-management.sprints" },
                    { new Guid("b6762b04-baf8-8676-0af0-d9bdb52fd40e"), "edit", "Edit project-management issues", "project-management.issues" },
                    { new Guid("bd820bc2-276b-a144-e157-75036e22bd5b"), "view", "View project-management labels", "project-management.labels" },
                    { new Guid("c90af273-fe09-62ad-d270-7fba027da776"), "delete", "Delete project-management boards", "project-management.boards" },
                    { new Guid("e6febf8c-f744-7b33-5ce7-c6fa08bf9923"), "create", "Create project-management boards", "project-management.boards" },
                    { new Guid("e9ac5cb5-9fc6-3400-5c9c-4181910091d9"), "view", "View project-management boards", "project-management.boards" },
                    { new Guid("f1317258-217c-b68e-0330-f20e2871fbbc"), "create", "Create project-management issues", "project-management.issues" },
                    { new Guid("f617bf97-49aa-792e-b058-2d6a34294be5"), "edit", "Edit project-management labels", "project-management.labels" },
                    { new Guid("f9962e25-cda0-8dec-61f4-cc591ec39d09"), "delete", "Delete project-management labels", "project-management.labels" },
                    { new Guid("fcd125cc-3d8f-4345-30bd-263dce041e19"), "edit", "Edit project-management projects", "project-management.projects" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("00bd5152-4790-6bec-38c8-04fc3e683c69"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("051c3686-5005-352e-2ecc-139a91256248"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("16a51a80-e82c-cf90-ff42-9d45fb65cdb8"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("18671174-7bec-d1df-8b9e-86b1fbea0579"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("40d8dcfe-99b8-8d64-fc4a-77a38a87ed9f"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("47f38351-9553-b3e5-fe74-c550bf76bfc9"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("489e93f5-766a-81e6-137e-5b83f12c0c49"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("5c8ef311-9483-1edb-abac-157b94360757"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("a107e633-3277-4767-3293-e5ed4275ec8b"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("b1cfa67d-ea33-315d-acf1-b88ae01143fe"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("b38d69f2-9808-4eff-51b0-070eaf7a5980"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("b6762b04-baf8-8676-0af0-d9bdb52fd40e"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("bd820bc2-276b-a144-e157-75036e22bd5b"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("c90af273-fe09-62ad-d270-7fba027da776"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("e6febf8c-f744-7b33-5ce7-c6fa08bf9923"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("e9ac5cb5-9fc6-3400-5c9c-4181910091d9"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("f1317258-217c-b68e-0330-f20e2871fbbc"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("f617bf97-49aa-792e-b058-2d6a34294be5"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("f9962e25-cda0-8dec-61f4-cc591ec39d09"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("fcd125cc-3d8f-4345-30bd-263dce041e19"));
        }
    }
}
