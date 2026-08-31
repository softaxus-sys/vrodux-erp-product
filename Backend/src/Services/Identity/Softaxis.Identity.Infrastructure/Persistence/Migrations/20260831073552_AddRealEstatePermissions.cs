using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Softaxis.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddRealEstatePermissions : Migration
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
                    { new Guid("0630b446-2037-6ddb-7ab3-502899d6551f"), "view", "View real-estate brokers", "real-estate.brokers" },
                    { new Guid("07fee2ac-cb8b-8bb6-53e1-552cb9910cc8"), "view", "View real-estate alerts", "real-estate.alerts" },
                    { new Guid("10d74235-fc94-84bd-bedc-b64e1270a19c"), "create", "Create real-estate sales", "real-estate.sales" },
                    { new Guid("13405b97-5a5b-f0d0-789f-72461d66a27e"), "view", "View real-estate rent", "real-estate.rent" },
                    { new Guid("22f91dd9-eea3-b9b9-2cd0-1ea6fb3026ba"), "create", "Create real-estate tenants", "real-estate.tenants" },
                    { new Guid("3004852b-855e-2a4c-a149-f15380100644"), "delete", "Delete real-estate sales", "real-estate.sales" },
                    { new Guid("32c092d2-2d35-9e42-80bb-d0914ea4babe"), "view", "View real-estate contracts", "real-estate.contracts" },
                    { new Guid("33e5b521-cfce-d55f-e5dd-f3120a91100e"), "create", "Create real-estate brokers", "real-estate.brokers" },
                    { new Guid("34be49d0-1b26-2754-7c66-d79ebf4e1634"), "edit", "Edit real-estate tenants", "real-estate.tenants" },
                    { new Guid("3bd10f32-38f6-48b9-7589-73f0ad21679e"), "view", "View real-estate units", "real-estate.units" },
                    { new Guid("3e906d97-5b2c-14e3-612f-fd972c529a43"), "remind", "Remind real-estate rent", "real-estate.rent" },
                    { new Guid("46228751-6453-55b1-46a5-a04622f09f63"), "view", "View real-estate tenants", "real-estate.tenants" },
                    { new Guid("484758d0-e98f-687e-3d37-eef21c299436"), "edit", "Edit real-estate brokers", "real-estate.brokers" },
                    { new Guid("4cb38c2a-3889-8459-66f2-380e10194bfc"), "delete", "Delete real-estate tenants", "real-estate.tenants" },
                    { new Guid("4d476c66-aaea-d35d-eda6-02e03ca1c169"), "edit", "Edit real-estate units", "real-estate.units" },
                    { new Guid("59d3309f-83fc-04ee-b456-8df47dede005"), "delete", "Delete real-estate brokers", "real-estate.brokers" },
                    { new Guid("6232f824-6933-0193-081f-69c7caef3962"), "edit", "Edit real-estate contracts", "real-estate.contracts" },
                    { new Guid("6d30b219-643d-a24f-ea08-167c993ab47c"), "edit", "Edit real-estate properties", "real-estate.properties" },
                    { new Guid("6f3619cb-7de8-b9fc-4bf9-48f365b57e6a"), "record", "Record real-estate rent", "real-estate.rent" },
                    { new Guid("73fae703-be00-4f5c-2788-ed602e032ae2"), "delete", "Delete real-estate units", "real-estate.units" },
                    { new Guid("76514e29-57dd-e772-7640-aaca4d6634e4"), "view", "View real-estate properties", "real-estate.properties" },
                    { new Guid("91c0e44f-44e3-c155-f2cc-07f9ea97a0c5"), "edit", "Edit real-estate sales", "real-estate.sales" },
                    { new Guid("97a944b5-4e64-fd5b-76c8-f2b73172c107"), "create", "Create real-estate units", "real-estate.units" },
                    { new Guid("a3f90ee3-ddc3-35d1-df2f-53d1716efdd4"), "delete", "Delete real-estate properties", "real-estate.properties" },
                    { new Guid("c17cb5f1-f820-98ab-d211-4117198b1dd9"), "view", "View real-estate sales", "real-estate.sales" },
                    { new Guid("cf8f0945-d969-1527-ac58-a4b8a5e9caa3"), "edit", "Edit real-estate alerts", "real-estate.alerts" },
                    { new Guid("d9c95c34-e1de-b44d-2586-23d18dc04fff"), "create", "Create real-estate contracts", "real-estate.contracts" },
                    { new Guid("efa78dba-684d-3119-92de-5ac9056927f1"), "create", "Create real-estate properties", "real-estate.properties" },
                    { new Guid("f043655d-f024-f61c-f89f-8a9ad8c4072b"), "delete", "Delete real-estate contracts", "real-estate.contracts" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("0630b446-2037-6ddb-7ab3-502899d6551f"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("07fee2ac-cb8b-8bb6-53e1-552cb9910cc8"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("10d74235-fc94-84bd-bedc-b64e1270a19c"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("13405b97-5a5b-f0d0-789f-72461d66a27e"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("22f91dd9-eea3-b9b9-2cd0-1ea6fb3026ba"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("3004852b-855e-2a4c-a149-f15380100644"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("32c092d2-2d35-9e42-80bb-d0914ea4babe"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("33e5b521-cfce-d55f-e5dd-f3120a91100e"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("34be49d0-1b26-2754-7c66-d79ebf4e1634"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("3bd10f32-38f6-48b9-7589-73f0ad21679e"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("3e906d97-5b2c-14e3-612f-fd972c529a43"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("46228751-6453-55b1-46a5-a04622f09f63"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("484758d0-e98f-687e-3d37-eef21c299436"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("4cb38c2a-3889-8459-66f2-380e10194bfc"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("4d476c66-aaea-d35d-eda6-02e03ca1c169"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("59d3309f-83fc-04ee-b456-8df47dede005"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("6232f824-6933-0193-081f-69c7caef3962"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("6d30b219-643d-a24f-ea08-167c993ab47c"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("6f3619cb-7de8-b9fc-4bf9-48f365b57e6a"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("73fae703-be00-4f5c-2788-ed602e032ae2"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("76514e29-57dd-e772-7640-aaca4d6634e4"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("91c0e44f-44e3-c155-f2cc-07f9ea97a0c5"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("97a944b5-4e64-fd5b-76c8-f2b73172c107"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("a3f90ee3-ddc3-35d1-df2f-53d1716efdd4"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("c17cb5f1-f820-98ab-d211-4117198b1dd9"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("cf8f0945-d969-1527-ac58-a4b8a5e9caa3"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("d9c95c34-e1de-b44d-2586-23d18dc04fff"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("efa78dba-684d-3119-92de-5ac9056927f1"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("f043655d-f024-f61c-f89f-8a9ad8c4072b"));
        }
    }
}
