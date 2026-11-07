using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Softaxis.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFitnessPermissions : Migration
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
                    { new Guid("0f5a9880-6f4b-03a4-7474-f7ed3257440a"), "edit", "Edit fitness checkin", "fitness.checkin" },
                    { new Guid("1c83aecf-2e7a-149c-44b3-48e365bb9793"), "edit", "Edit fitness members", "fitness.members" },
                    { new Guid("1c9c070f-af8a-bc56-3722-1a52a5b23216"), "delete", "Delete fitness facility", "fitness.facility" },
                    { new Guid("1ea51cc0-b8ee-192f-660b-b532d68b95f4"), "view", "View fitness reports", "fitness.reports" },
                    { new Guid("2166bc0d-484f-c56c-c97c-e4724be5c995"), "delete", "Delete fitness training", "fitness.training" },
                    { new Guid("243688b5-0560-72ac-1b71-3e474e67a562"), "view", "View fitness classes", "fitness.classes" },
                    { new Guid("253f94ff-b1aa-b10b-8616-575c871d2422"), "edit", "Edit fitness memberships", "fitness.memberships" },
                    { new Guid("2619ce54-a6b5-3208-c27c-43c66b9fd0de"), "view", "View fitness setup", "fitness.setup" },
                    { new Guid("2b5f1fbf-1242-967b-00a5-5b38f033dc25"), "edit", "Edit fitness classes", "fitness.classes" },
                    { new Guid("3132dec3-0a0f-2fe8-53b7-3ba65136ca0c"), "edit", "Edit fitness setup", "fitness.setup" },
                    { new Guid("327e426a-ad41-73bf-0970-43e4bcd44a4b"), "view", "View fitness payments", "fitness.payments" },
                    { new Guid("34ae5841-254c-ca2d-62a9-75a5d3ae23c5"), "edit", "Edit fitness leads", "fitness.leads" },
                    { new Guid("3840bc02-8703-5fdf-1a85-0eb95837f6e1"), "view", "View fitness training", "fitness.training" },
                    { new Guid("3f010403-077c-d12d-946e-5cf81aafc733"), "create", "Create fitness classes", "fitness.classes" },
                    { new Guid("4085eff2-0198-686b-7197-c5ffd50a0655"), "delete", "Delete fitness classes", "fitness.classes" },
                    { new Guid("419cabf8-85ed-91fa-361e-4751f3f65c03"), "view", "View fitness checkin", "fitness.checkin" },
                    { new Guid("4c417fe8-f9e7-77a8-0865-b5dba562dd56"), "create", "Create fitness training", "fitness.training" },
                    { new Guid("5c6f4784-d3f0-fc7e-d227-6d0f8bd890c5"), "delete", "Delete fitness leads", "fitness.leads" },
                    { new Guid("6215cf60-8294-f3e1-85d4-d1f75558101c"), "approve", "Approve fitness payments", "fitness.payments" },
                    { new Guid("65187528-c722-94c3-817a-588d34e94ae6"), "view", "View fitness members", "fitness.members" },
                    { new Guid("6ff210dc-69ca-d19f-fbc6-da6168e790bc"), "create", "Create fitness members", "fitness.members" },
                    { new Guid("724ea2ea-8bca-57dc-b98e-85e9042fed5f"), "create", "Create fitness checkin", "fitness.checkin" },
                    { new Guid("762af34b-f540-4039-c71f-b94db42f859c"), "create", "Create fitness memberships", "fitness.memberships" },
                    { new Guid("8f5eb88d-6878-211d-8a9c-a2b381ea9380"), "edit", "Edit fitness training", "fitness.training" },
                    { new Guid("91af8731-2d13-713d-42c3-9dd9ae30f52c"), "create", "Create fitness payments", "fitness.payments" },
                    { new Guid("94931e4c-f145-ecf6-f0fd-51c33a97a268"), "create", "Create fitness facility", "fitness.facility" },
                    { new Guid("b905cdaa-b641-a849-4119-c143d89a32b1"), "edit", "Edit fitness facility", "fitness.facility" },
                    { new Guid("bb0c6ac1-9574-650a-a1c1-a21d9de52f12"), "view", "View fitness leads", "fitness.leads" },
                    { new Guid("c751d2d0-d129-6ced-5f96-649507139077"), "view", "View fitness memberships", "fitness.memberships" },
                    { new Guid("d387fb92-6db1-c6f2-1a6d-704d3b181c4e"), "view", "View fitness facility", "fitness.facility" },
                    { new Guid("f1ff5c80-198e-9f8c-8b75-b0e1f117666a"), "delete", "Delete fitness members", "fitness.members" },
                    { new Guid("f9228fc3-d2b1-060e-0729-0b1b4eab7b20"), "create", "Create fitness leads", "fitness.leads" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("0f5a9880-6f4b-03a4-7474-f7ed3257440a"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("1c83aecf-2e7a-149c-44b3-48e365bb9793"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("1c9c070f-af8a-bc56-3722-1a52a5b23216"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("1ea51cc0-b8ee-192f-660b-b532d68b95f4"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("2166bc0d-484f-c56c-c97c-e4724be5c995"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("243688b5-0560-72ac-1b71-3e474e67a562"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("253f94ff-b1aa-b10b-8616-575c871d2422"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("2619ce54-a6b5-3208-c27c-43c66b9fd0de"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("2b5f1fbf-1242-967b-00a5-5b38f033dc25"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("3132dec3-0a0f-2fe8-53b7-3ba65136ca0c"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("327e426a-ad41-73bf-0970-43e4bcd44a4b"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("34ae5841-254c-ca2d-62a9-75a5d3ae23c5"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("3840bc02-8703-5fdf-1a85-0eb95837f6e1"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("3f010403-077c-d12d-946e-5cf81aafc733"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("4085eff2-0198-686b-7197-c5ffd50a0655"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("419cabf8-85ed-91fa-361e-4751f3f65c03"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("4c417fe8-f9e7-77a8-0865-b5dba562dd56"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("5c6f4784-d3f0-fc7e-d227-6d0f8bd890c5"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("6215cf60-8294-f3e1-85d4-d1f75558101c"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("65187528-c722-94c3-817a-588d34e94ae6"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("6ff210dc-69ca-d19f-fbc6-da6168e790bc"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("724ea2ea-8bca-57dc-b98e-85e9042fed5f"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("762af34b-f540-4039-c71f-b94db42f859c"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("8f5eb88d-6878-211d-8a9c-a2b381ea9380"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("91af8731-2d13-713d-42c3-9dd9ae30f52c"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("94931e4c-f145-ecf6-f0fd-51c33a97a268"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("b905cdaa-b641-a849-4119-c143d89a32b1"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("bb0c6ac1-9574-650a-a1c1-a21d9de52f12"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("c751d2d0-d129-6ced-5f96-649507139077"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("d387fb92-6db1-c6f2-1a6d-704d3b181c4e"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("f1ff5c80-198e-9f8c-8b75-b0e1f117666a"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("f9228fc3-d2b1-060e-0729-0b1b4eab7b20"));
        }
    }
}
