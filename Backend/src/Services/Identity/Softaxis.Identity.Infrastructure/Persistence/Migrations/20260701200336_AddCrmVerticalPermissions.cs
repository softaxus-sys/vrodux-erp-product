using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Softaxis.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCrmVerticalPermissions : Migration
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
                    { new Guid("00971e21-8960-0523-74d6-fd4e9aa5a84b"), "delete", "Delete insurance renewals", "insurance.renewals" },
                    { new Guid("01f2ed53-6a2f-3b9f-8a27-b61648686f57"), "delete", "Delete b2b tickets", "b2b.tickets" },
                    { new Guid("04573603-c8ca-44a4-47c2-03c9bb676671"), "edit", "Edit insurance claims", "insurance.claims" },
                    { new Guid("0d0decde-1413-1cd1-5b0e-a10491ee5cab"), "delete", "Delete insurance policies", "insurance.policies" },
                    { new Guid("16d7cebb-6902-1d79-f5e9-ad5eb43bcb95"), "create", "Create healthcare patients", "healthcare.patients" },
                    { new Guid("1a32c6a2-9d02-4c51-6a45-dc906389e773"), "view", "View education admissions", "education.admissions" },
                    { new Guid("1cc3f793-f290-9369-df8f-c03270ac85a3"), "view", "View b2b contracts", "b2b.contracts" },
                    { new Guid("1fc6f62a-0d1c-8cbd-0ae5-986f8b45c118"), "edit", "Edit healthcare appointments", "healthcare.appointments" },
                    { new Guid("2090757d-45db-1fbe-bc3a-83c50ee9662f"), "view", "View healthcare patients", "healthcare.patients" },
                    { new Guid("2866290d-8400-f9cc-0a1c-251bcc8f6fd5"), "edit", "Edit healthcare patients", "healthcare.patients" },
                    { new Guid("289de8ac-78b7-411c-2ca8-6541ae32a8a4"), "view", "View education enrollments", "education.enrollments" },
                    { new Guid("2a2e789b-f072-4274-d0be-ed0b491406ba"), "edit", "Edit healthcare treatment-plans", "healthcare.treatment-plans" },
                    { new Guid("2c6b2c24-28a7-40ae-efb7-1969e8bd2f25"), "approve", "Approve insurance claims", "insurance.claims" },
                    { new Guid("2fd73645-e204-fd4c-34fb-d406faf0b826"), "create", "Create insurance claims", "insurance.claims" },
                    { new Guid("345e6645-b72c-e13f-bd6f-15abe08c679e"), "edit", "Edit b2b proposals", "b2b.proposals" },
                    { new Guid("3ee5af4d-c26e-658d-8935-8407bdb9e815"), "view", "View education students", "education.students" },
                    { new Guid("3fa39b76-5403-ea27-2d6c-9061e5889f6f"), "edit", "Edit insurance policies", "insurance.policies" },
                    { new Guid("420b69d4-a819-588e-317c-74ca4d02d0ba"), "edit", "Edit education enrollments", "education.enrollments" },
                    { new Guid("45ca67de-e1ff-22c1-0a1e-5b7aaa049ee5"), "edit", "Edit insurance renewals", "insurance.renewals" },
                    { new Guid("48df5252-3d62-031d-d8ac-b6f96eb8eb40"), "delete", "Delete healthcare treatment-plans", "healthcare.treatment-plans" },
                    { new Guid("4cac82c9-5675-ae47-a0bb-dab393dca150"), "delete", "Delete education admissions", "education.admissions" },
                    { new Guid("69d73d3e-af83-f607-d8d1-ba5c935d4864"), "delete", "Delete education students", "education.students" },
                    { new Guid("76517e22-f5b9-67e7-41de-abffd24b49ad"), "view", "View b2b proposals", "b2b.proposals" },
                    { new Guid("768e6fa3-db8e-416a-5e5d-e44f07dfadc7"), "delete", "Delete healthcare appointments", "healthcare.appointments" },
                    { new Guid("77ca7840-5b48-3b8d-7f4a-595f5214974e"), "delete", "Delete education enrollments", "education.enrollments" },
                    { new Guid("7c8c925e-1427-c922-ed11-88dc56391e8a"), "edit", "Edit education students", "education.students" },
                    { new Guid("7e49773d-6947-101f-7cb6-135ff2cab75e"), "edit", "Edit b2b tickets", "b2b.tickets" },
                    { new Guid("82fbfcb3-2ae3-ce8c-af57-cd142c735701"), "delete", "Delete b2b proposals", "b2b.proposals" },
                    { new Guid("85cb3e5f-c7df-4607-f558-3981848a2748"), "create", "Create education enrollments", "education.enrollments" },
                    { new Guid("95017077-d87e-810a-0fef-65543a270cb7"), "view", "View insurance policies", "insurance.policies" },
                    { new Guid("9d668e67-5e3e-9e63-ea96-7fc35164baaa"), "create", "Create healthcare treatment-plans", "healthcare.treatment-plans" },
                    { new Guid("9f42f5cf-6c96-fed9-9dc5-c9af99cb9abf"), "create", "Create insurance renewals", "insurance.renewals" },
                    { new Guid("9f99eb15-57dc-e6ab-8a60-f0f298a1b394"), "create", "Create healthcare appointments", "healthcare.appointments" },
                    { new Guid("a6a658cd-eeb6-98e1-09ff-a82dfefb04de"), "delete", "Delete healthcare patients", "healthcare.patients" },
                    { new Guid("af74d799-ca8f-9b82-57c7-df5b94ecd063"), "create", "Create b2b tickets", "b2b.tickets" },
                    { new Guid("b009b9dc-8746-01c1-40d1-5ca2f954d7bd"), "edit", "Edit b2b contracts", "b2b.contracts" },
                    { new Guid("b0ee5e57-dac8-a765-87d2-edd5f4f6481b"), "delete", "Delete b2b contracts", "b2b.contracts" },
                    { new Guid("ba2be52a-ba9f-13c6-2a7c-b09441a5f6cf"), "create", "Create education admissions", "education.admissions" },
                    { new Guid("c1b6820b-9408-e550-2b2e-6789c47bd1a0"), "view", "View b2b tickets", "b2b.tickets" },
                    { new Guid("c3ca1038-4631-b8e4-743e-5d63940c4c70"), "edit", "Edit education admissions", "education.admissions" },
                    { new Guid("c91240aa-e5f6-2844-1aa5-0088643f36e1"), "view", "View healthcare treatment-plans", "healthcare.treatment-plans" },
                    { new Guid("cd8fea8c-268b-caa7-8259-9035227bf54d"), "create", "Create b2b proposals", "b2b.proposals" },
                    { new Guid("cfd82763-84c2-e2e5-0993-0256897dc906"), "delete", "Delete insurance claims", "insurance.claims" },
                    { new Guid("e1b65c21-e086-4504-9ff2-d809c225b9af"), "view", "View insurance claims", "insurance.claims" },
                    { new Guid("e67e72f4-5a2d-0e4e-471c-13ce26fba1df"), "create", "Create education students", "education.students" },
                    { new Guid("f11c37db-40bc-61b7-c531-24d648812db6"), "create", "Create b2b contracts", "b2b.contracts" },
                    { new Guid("f474d967-58fc-ead5-3699-bee06110d903"), "view", "View healthcare appointments", "healthcare.appointments" },
                    { new Guid("fc74e937-55f8-8a18-c1b1-86b55253bfd1"), "view", "View insurance renewals", "insurance.renewals" },
                    { new Guid("ff6e49ff-a8bd-f63b-10b9-f3c6b96d55d2"), "create", "Create insurance policies", "insurance.policies" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("00971e21-8960-0523-74d6-fd4e9aa5a84b"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("01f2ed53-6a2f-3b9f-8a27-b61648686f57"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("04573603-c8ca-44a4-47c2-03c9bb676671"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("0d0decde-1413-1cd1-5b0e-a10491ee5cab"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("16d7cebb-6902-1d79-f5e9-ad5eb43bcb95"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("1a32c6a2-9d02-4c51-6a45-dc906389e773"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("1cc3f793-f290-9369-df8f-c03270ac85a3"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("1fc6f62a-0d1c-8cbd-0ae5-986f8b45c118"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("2090757d-45db-1fbe-bc3a-83c50ee9662f"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("2866290d-8400-f9cc-0a1c-251bcc8f6fd5"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("289de8ac-78b7-411c-2ca8-6541ae32a8a4"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("2a2e789b-f072-4274-d0be-ed0b491406ba"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("2c6b2c24-28a7-40ae-efb7-1969e8bd2f25"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("2fd73645-e204-fd4c-34fb-d406faf0b826"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("345e6645-b72c-e13f-bd6f-15abe08c679e"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("3ee5af4d-c26e-658d-8935-8407bdb9e815"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("3fa39b76-5403-ea27-2d6c-9061e5889f6f"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("420b69d4-a819-588e-317c-74ca4d02d0ba"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("45ca67de-e1ff-22c1-0a1e-5b7aaa049ee5"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("48df5252-3d62-031d-d8ac-b6f96eb8eb40"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("4cac82c9-5675-ae47-a0bb-dab393dca150"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("69d73d3e-af83-f607-d8d1-ba5c935d4864"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("76517e22-f5b9-67e7-41de-abffd24b49ad"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("768e6fa3-db8e-416a-5e5d-e44f07dfadc7"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("77ca7840-5b48-3b8d-7f4a-595f5214974e"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("7c8c925e-1427-c922-ed11-88dc56391e8a"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("7e49773d-6947-101f-7cb6-135ff2cab75e"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("82fbfcb3-2ae3-ce8c-af57-cd142c735701"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("85cb3e5f-c7df-4607-f558-3981848a2748"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("95017077-d87e-810a-0fef-65543a270cb7"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("9d668e67-5e3e-9e63-ea96-7fc35164baaa"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("9f42f5cf-6c96-fed9-9dc5-c9af99cb9abf"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("9f99eb15-57dc-e6ab-8a60-f0f298a1b394"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("a6a658cd-eeb6-98e1-09ff-a82dfefb04de"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("af74d799-ca8f-9b82-57c7-df5b94ecd063"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("b009b9dc-8746-01c1-40d1-5ca2f954d7bd"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("b0ee5e57-dac8-a765-87d2-edd5f4f6481b"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("ba2be52a-ba9f-13c6-2a7c-b09441a5f6cf"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("c1b6820b-9408-e550-2b2e-6789c47bd1a0"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("c3ca1038-4631-b8e4-743e-5d63940c4c70"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("c91240aa-e5f6-2844-1aa5-0088643f36e1"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("cd8fea8c-268b-caa7-8259-9035227bf54d"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("cfd82763-84c2-e2e5-0993-0256897dc906"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("e1b65c21-e086-4504-9ff2-d809c225b9af"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("e67e72f4-5a2d-0e4e-471c-13ce26fba1df"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("f11c37db-40bc-61b7-c531-24d648812db6"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("f474d967-58fc-ead5-3699-bee06110d903"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("fc74e937-55f8-8a18-c1b1-86b55253bfd1"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("ff6e49ff-a8bd-f63b-10b9-f3c6b96d55d2"));
        }
    }
}
