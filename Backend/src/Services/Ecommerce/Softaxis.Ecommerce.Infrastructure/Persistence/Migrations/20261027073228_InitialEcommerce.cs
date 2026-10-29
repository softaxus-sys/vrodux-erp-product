using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Ecommerce.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialEcommerce : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "ecommerce");

            migrationBuilder.CreateTable(
                name: "channel_listings",
                schema: "ecommerce",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ChannelId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TemplateId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TemplateName = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: false),
                    ExternalProductId = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: true),
                    ExternalHandle = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ContentHash = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    ImagesHash = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    FailedHash = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    LastError = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    LastSyncedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_channel_listings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "channel_orders",
                schema: "ecommerce",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ChannelId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ExternalId = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: false),
                    OrderNumber = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    CustomerName = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    Email = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: true),
                    FinancialStatus = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: true),
                    FulfillmentStatus = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: true),
                    Total = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    CurrencyCode = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    PlacedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ImportedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Note = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_channel_orders", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "sales_channels",
                schema: "ecommerce",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Kind = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    ShopDomain = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    EncryptedToken = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ExternalLocationId = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: true),
                    LocationName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    CurrencyCode = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    SyncStock = table.Column<bool>(type: "bit", nullable: false),
                    SyncContent = table.Column<bool>(type: "bit", nullable: false),
                    ImportOrders = table.Column<bool>(type: "bit", nullable: false),
                    LastSyncAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    OrdersCursor = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastError = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    ConsecutiveFailures = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sales_channels", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "channel_listing_variants",
                schema: "ecommerce",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ListingId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProductId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ExternalVariantId = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: false),
                    ExternalInventoryItemId = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: true),
                    Sku = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    LastPushedQuantity = table.Column<int>(type: "int", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_channel_listing_variants", x => x.Id);
                    table.ForeignKey(
                        name: "FK_channel_listing_variants_channel_listings_ListingId",
                        column: x => x.ListingId,
                        principalSchema: "ecommerce",
                        principalTable: "channel_listings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "channel_order_lines",
                schema: "ecommerce",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OrderId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Sku = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ExternalVariantId = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: true),
                    Quantity = table.Column<decimal>(type: "decimal(18,3)", precision: 18, scale: 3, nullable: false),
                    UnitPrice = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    ProductId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    StockTaken = table.Column<bool>(type: "bit", nullable: false),
                    StockReturned = table.Column<bool>(type: "bit", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_channel_order_lines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_channel_order_lines_channel_orders_OrderId",
                        column: x => x.OrderId,
                        principalSchema: "ecommerce",
                        principalTable: "channel_orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_channel_listing_variants_ExternalVariantId",
                schema: "ecommerce",
                table: "channel_listing_variants",
                column: "ExternalVariantId");

            migrationBuilder.CreateIndex(
                name: "IX_channel_listing_variants_ListingId",
                schema: "ecommerce",
                table: "channel_listing_variants",
                column: "ListingId");

            migrationBuilder.CreateIndex(
                name: "IX_channel_listing_variants_ProductId",
                schema: "ecommerce",
                table: "channel_listing_variants",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_channel_listing_variants_TenantId",
                schema: "ecommerce",
                table: "channel_listing_variants",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_channel_listings_ChannelId",
                schema: "ecommerce",
                table: "channel_listings",
                column: "ChannelId");

            migrationBuilder.CreateIndex(
                name: "IX_channel_listings_TemplateId",
                schema: "ecommerce",
                table: "channel_listings",
                column: "TemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_channel_listings_TenantId",
                schema: "ecommerce",
                table: "channel_listings",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_channel_listings_TenantId_ChannelId_TemplateId",
                schema: "ecommerce",
                table: "channel_listings",
                columns: new[] { "TenantId", "ChannelId", "TemplateId" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_channel_order_lines_OrderId",
                schema: "ecommerce",
                table: "channel_order_lines",
                column: "OrderId");

            migrationBuilder.CreateIndex(
                name: "IX_channel_order_lines_TenantId",
                schema: "ecommerce",
                table: "channel_order_lines",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_channel_orders_ChannelId",
                schema: "ecommerce",
                table: "channel_orders",
                column: "ChannelId");

            migrationBuilder.CreateIndex(
                name: "IX_channel_orders_PlacedAt",
                schema: "ecommerce",
                table: "channel_orders",
                column: "PlacedAt");

            migrationBuilder.CreateIndex(
                name: "IX_channel_orders_TenantId",
                schema: "ecommerce",
                table: "channel_orders",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_channel_orders_TenantId_ChannelId_ExternalId",
                schema: "ecommerce",
                table: "channel_orders",
                columns: new[] { "TenantId", "ChannelId", "ExternalId" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_sales_channels_TenantId",
                schema: "ecommerce",
                table: "sales_channels",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_sales_channels_TenantId_Kind_ShopDomain",
                schema: "ecommerce",
                table: "sales_channels",
                columns: new[] { "TenantId", "Kind", "ShopDomain" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "channel_listing_variants",
                schema: "ecommerce");

            migrationBuilder.DropTable(
                name: "channel_order_lines",
                schema: "ecommerce");

            migrationBuilder.DropTable(
                name: "sales_channels",
                schema: "ecommerce");

            migrationBuilder.DropTable(
                name: "channel_listings",
                schema: "ecommerce");

            migrationBuilder.DropTable(
                name: "channel_orders",
                schema: "ecommerce");
        }
    }
}
