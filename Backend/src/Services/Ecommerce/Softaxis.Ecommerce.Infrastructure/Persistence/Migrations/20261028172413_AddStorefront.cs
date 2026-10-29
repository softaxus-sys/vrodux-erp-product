using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Ecommerce.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddStorefront : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "discount_codes",
                schema: "ecommerce",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Code = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    Kind = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Value = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    MinSubtotal = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    MaxUses = table.Column<int>(type: "int", nullable: true),
                    UsedCount = table.Column<int>(type: "int", nullable: false),
                    StartsAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    EndsAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_discount_codes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "shipping_zones",
                schema: "ecommerce",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    CountriesJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    FlatRate = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    FreeOver = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    MinOrder = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    EstimatedDays = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_shipping_zones", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "store_assets",
                schema: "ecommerce",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FileName = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    ContentType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Data = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    Size = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_store_assets", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "store_collections",
                schema: "ecommerce",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Slug = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    ImageAssetId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    TemplateIdsJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CategoryName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    IsPublished = table.Column<bool>(type: "bit", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_store_collections", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "store_customer_addresses",
                schema: "ecommerce",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CustomerId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Phone = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: true),
                    Line1 = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: false),
                    Line2 = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    City = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Region = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    PostalCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    Country = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: false),
                    IsDefault = table.Column<bool>(type: "bit", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_store_customer_addresses", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "store_customers",
                schema: "ecommerce",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Email = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: false),
                    PasswordHash = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    FirstName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    LastName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Phone = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: true),
                    AcceptsMarketing = table.Column<bool>(type: "bit", nullable: false),
                    ResetTokenHash = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ResetExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    FailedAttempts = table.Column<int>(type: "int", nullable: false),
                    LockedUntil = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastSignInAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_store_customers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "store_orders",
                schema: "ecommerce",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Seq = table.Column<int>(type: "int", nullable: false),
                    Number = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    AccessToken = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    CustomerId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Email = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: false),
                    Phone = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: true),
                    CustomerName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    ShipName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    ShipLine1 = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: false),
                    ShipLine2 = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    ShipCity = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    ShipRegion = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ShipPostal = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    ShipCountry = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: false),
                    ShippingMethod = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    Subtotal = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    DiscountTotal = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    DiscountCode = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: true),
                    ShippingTotal = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    TaxTotal = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    Total = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    CurrencyCode = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    PaymentMethod = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    PaymentStatus = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    StripeSessionId = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    PayPalOrderId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    PaymentReference = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    PaidAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TrackingCarrier = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    TrackingNumber = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    TrackingUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    ShippedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    DeliveredAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CancelledAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CancelReason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CustomerNote = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    StaffNote = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    StockTaken = table.Column<bool>(type: "bit", nullable: false),
                    StockReturned = table.Column<bool>(type: "bit", nullable: false),
                    MerchantNotified = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_store_orders", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "store_pages",
                schema: "ecommerce",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Slug = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Kind = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    IsPublished = table.Column<bool>(type: "bit", nullable: false),
                    SectionsJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SeoTitle = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    MetaDescription = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_store_pages", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "stores",
                schema: "ecommerce",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Slug = table.Column<string>(type: "nvarchar(63)", maxLength: 63, nullable: false),
                    CustomDomain = table.Column<string>(type: "nvarchar(253)", maxLength: 253, nullable: true),
                    IsPublished = table.Column<bool>(type: "bit", nullable: false),
                    CurrencyCode = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    Language = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: false),
                    ContactEmail = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: true),
                    ContactPhone = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: true),
                    Address = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    OrderNotifyEmail = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: true),
                    LogoAssetId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    FaviconAssetId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    AnnouncementText = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    SeoTitle = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    MetaDescription = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: true),
                    ThemeJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    HeaderMenuJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    FooterMenuJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SocialJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    TaxPercent = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: false),
                    PricesIncludeTax = table.Column<bool>(type: "bit", nullable: false),
                    AllowGuestCheckout = table.Column<bool>(type: "bit", nullable: false),
                    RequirePhone = table.Column<bool>(type: "bit", nullable: false),
                    CodEnabled = table.Column<bool>(type: "bit", nullable: false),
                    CodInstructions = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    BankEnabled = table.Column<bool>(type: "bit", nullable: false),
                    BankDetails = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    StripeEnabled = table.Column<bool>(type: "bit", nullable: false),
                    StripeSecretEnc = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    StripeWebhookSecretEnc = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    PayPalEnabled = table.Column<bool>(type: "bit", nullable: false),
                    PayPalClientId = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    PayPalSecretEnc = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    PayPalSandbox = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_stores", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "store_order_events",
                schema: "ecommerce",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OrderId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Kind = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Message = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    ByName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    At = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_store_order_events", x => x.Id);
                    table.ForeignKey(
                        name: "FK_store_order_events_store_orders_OrderId",
                        column: x => x.OrderId,
                        principalSchema: "ecommerce",
                        principalTable: "store_orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "store_order_lines",
                schema: "ecommerce",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OrderId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProductId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TemplateId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Title = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: false),
                    VariantName = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    Sku = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Quantity = table.Column<int>(type: "int", nullable: false),
                    UnitPrice = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    TrackInventory = table.Column<bool>(type: "bit", nullable: false),
                    StockTaken = table.Column<bool>(type: "bit", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_store_order_lines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_store_order_lines_store_orders_OrderId",
                        column: x => x.OrderId,
                        principalSchema: "ecommerce",
                        principalTable: "store_orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_discount_codes_TenantId",
                schema: "ecommerce",
                table: "discount_codes",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_discount_codes_TenantId_Code",
                schema: "ecommerce",
                table: "discount_codes",
                columns: new[] { "TenantId", "Code" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_shipping_zones_TenantId",
                schema: "ecommerce",
                table: "shipping_zones",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_store_assets_TenantId",
                schema: "ecommerce",
                table: "store_assets",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_store_collections_TenantId",
                schema: "ecommerce",
                table: "store_collections",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_store_collections_TenantId_Slug",
                schema: "ecommerce",
                table: "store_collections",
                columns: new[] { "TenantId", "Slug" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_store_customer_addresses_CustomerId",
                schema: "ecommerce",
                table: "store_customer_addresses",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_store_customer_addresses_TenantId",
                schema: "ecommerce",
                table: "store_customer_addresses",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_store_customers_TenantId",
                schema: "ecommerce",
                table: "store_customers",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_store_customers_TenantId_Email",
                schema: "ecommerce",
                table: "store_customers",
                columns: new[] { "TenantId", "Email" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_store_order_events_OrderId",
                schema: "ecommerce",
                table: "store_order_events",
                column: "OrderId");

            migrationBuilder.CreateIndex(
                name: "IX_store_order_events_TenantId",
                schema: "ecommerce",
                table: "store_order_events",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_store_order_lines_OrderId",
                schema: "ecommerce",
                table: "store_order_lines",
                column: "OrderId");

            migrationBuilder.CreateIndex(
                name: "IX_store_order_lines_TenantId",
                schema: "ecommerce",
                table: "store_order_lines",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_store_orders_CustomerId",
                schema: "ecommerce",
                table: "store_orders",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_store_orders_Status",
                schema: "ecommerce",
                table: "store_orders",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_store_orders_TenantId",
                schema: "ecommerce",
                table: "store_orders",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_store_orders_TenantId_Seq",
                schema: "ecommerce",
                table: "store_orders",
                columns: new[] { "TenantId", "Seq" },
                unique: true,
                filter: "[TenantId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_store_pages_TenantId",
                schema: "ecommerce",
                table: "store_pages",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_store_pages_TenantId_Slug",
                schema: "ecommerce",
                table: "store_pages",
                columns: new[] { "TenantId", "Slug" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_stores_CustomDomain",
                schema: "ecommerce",
                table: "stores",
                column: "CustomDomain",
                unique: true,
                filter: "[CustomDomain] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_stores_Slug",
                schema: "ecommerce",
                table: "stores",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_stores_TenantId",
                schema: "ecommerce",
                table: "stores",
                column: "TenantId",
                unique: true,
                filter: "[TenantId] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "discount_codes",
                schema: "ecommerce");

            migrationBuilder.DropTable(
                name: "shipping_zones",
                schema: "ecommerce");

            migrationBuilder.DropTable(
                name: "store_assets",
                schema: "ecommerce");

            migrationBuilder.DropTable(
                name: "store_collections",
                schema: "ecommerce");

            migrationBuilder.DropTable(
                name: "store_customer_addresses",
                schema: "ecommerce");

            migrationBuilder.DropTable(
                name: "store_customers",
                schema: "ecommerce");

            migrationBuilder.DropTable(
                name: "store_order_events",
                schema: "ecommerce");

            migrationBuilder.DropTable(
                name: "store_order_lines",
                schema: "ecommerce");

            migrationBuilder.DropTable(
                name: "store_pages",
                schema: "ecommerce");

            migrationBuilder.DropTable(
                name: "stores",
                schema: "ecommerce");

            migrationBuilder.DropTable(
                name: "store_orders",
                schema: "ecommerce");
        }
    }
}
