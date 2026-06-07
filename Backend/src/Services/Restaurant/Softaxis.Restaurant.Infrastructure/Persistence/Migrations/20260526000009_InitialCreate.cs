using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Restaurant.Infrastructure.Persistence.Migrations
{
    public partial class InitialCreate : Migration
    {
        protected override void Up(MigrationBuilder mb)
        {
            mb.EnsureSchema("restaurant");

            mb.CreateTable("Tables", t => new
            {
                Id             = t.Column<Guid>(nullable: false),
                TableNumber    = t.Column<string>(maxLength: 20,  nullable: false),
                Section        = t.Column<string>(maxLength: 50,  nullable: false),
                Capacity       = t.Column<int>(nullable: false),
                Status         = t.Column<string>(maxLength: 30,  nullable: false),
                CurrentOrderId = t.Column<Guid>(nullable: true),
                CurrentWaiter  = t.Column<string>(maxLength: 200, nullable: true),
                OccupiedSince  = t.Column<DateTime>(nullable: true),
                IsDeleted      = t.Column<bool>(nullable: false, defaultValue: false),
                CreatedAt      = t.Column<DateTime>(nullable: false),
                UpdatedAt      = t.Column<DateTime>(nullable: false),
            }, schema: "restaurant",
            constraints: t => t.PrimaryKey("PK_Tables", x => x.Id));

            mb.CreateTable("MenuCategories", t => new
            {
                Id          = t.Column<Guid>(nullable: false),
                Name        = t.Column<string>(maxLength: 100, nullable: false),
                Description = t.Column<string>(maxLength: 500, nullable: true),
                SortOrder   = t.Column<int>(nullable: false),
                IsActive    = t.Column<bool>(nullable: false),
                IsDeleted   = t.Column<bool>(nullable: false, defaultValue: false),
                CreatedAt   = t.Column<DateTime>(nullable: false),
            }, schema: "restaurant",
            constraints: t => t.PrimaryKey("PK_MenuCategories", x => x.Id));

            mb.CreateTable("MenuItems", t => new
            {
                Id              = t.Column<Guid>(nullable: false),
                CategoryId      = t.Column<Guid>(nullable: false),
                Name            = t.Column<string>(maxLength: 200,  nullable: false),
                Description     = t.Column<string>(maxLength: 1000, nullable: true),
                Price           = t.Column<decimal>(precision: 18, scale: 2, nullable: false),
                PrepTimeMinutes = t.Column<int>(nullable: false),
                Allergens       = t.Column<string>(maxLength: 500, nullable: true),
                IsAvailable     = t.Column<bool>(nullable: false),
                IsDeleted       = t.Column<bool>(nullable: false, defaultValue: false),
                CreatedAt       = t.Column<DateTime>(nullable: false),
                UpdatedAt       = t.Column<DateTime>(nullable: false),
            }, schema: "restaurant",
            constraints: t =>
            {
                t.PrimaryKey("PK_MenuItems", x => x.Id);
                t.ForeignKey(
                    name: "FK_MenuItems_MenuCategories",
                    column: x => x.CategoryId,
                    principalSchema: "restaurant",
                    principalTable: "MenuCategories",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

            mb.CreateTable("Orders", t => new
            {
                Id             = t.Column<Guid>(nullable: false),
                OrderNumber    = t.Column<string>(maxLength: 50,   nullable: false),
                TableId        = t.Column<Guid>(nullable: false),
                TableNumber    = t.Column<string>(maxLength: 20,   nullable: false),
                Waiter         = t.Column<string>(maxLength: 200,  nullable: false),
                Covers         = t.Column<int>(nullable: false),
                Status         = t.Column<string>(maxLength: 30,   nullable: false),
                OrderType      = t.Column<string>(maxLength: 30,   nullable: false),
                SubTotal       = t.Column<decimal>(precision: 18, scale: 2, nullable: false),
                TaxAmount      = t.Column<decimal>(precision: 18, scale: 2, nullable: false),
                DiscountAmount = t.Column<decimal>(precision: 18, scale: 2, nullable: false),
                Total          = t.Column<decimal>(precision: 18, scale: 2, nullable: false),
                PaymentMethod  = t.Column<string>(maxLength: 50,   nullable: true),
                Notes          = t.Column<string>(maxLength: 1000, nullable: true),
                IsDeleted      = t.Column<bool>(nullable: false, defaultValue: false),
                CreatedAt      = t.Column<DateTime>(nullable: false),
                UpdatedAt      = t.Column<DateTime>(nullable: false),
            }, schema: "restaurant",
            constraints: t => t.PrimaryKey("PK_Orders", x => x.Id));

            mb.CreateTable("OrderItems", t => new
            {
                Id         = t.Column<Guid>(nullable: false),
                OrderId    = t.Column<Guid>(nullable: false),
                MenuItemId = t.Column<Guid>(nullable: false),
                ItemName   = t.Column<string>(maxLength: 200, nullable: false),
                Quantity   = t.Column<int>(nullable: false),
                UnitPrice  = t.Column<decimal>(precision: 18, scale: 2, nullable: false),
                Modifiers  = t.Column<string>(maxLength: 500, nullable: true),
                Status     = t.Column<string>(maxLength: 30,  nullable: false),
                IsDeleted  = t.Column<bool>(nullable: false, defaultValue: false),
                CreatedAt  = t.Column<DateTime>(nullable: false),
            }, schema: "restaurant",
            constraints: t =>
            {
                t.PrimaryKey("PK_OrderItems", x => x.Id);
                t.ForeignKey(
                    name: "FK_OrderItems_Orders",
                    column: x => x.OrderId,
                    principalSchema: "restaurant",
                    principalTable: "Orders",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

            mb.CreateTable("Reservations", t => new
            {
                Id                = t.Column<Guid>(nullable: false),
                ReservationNumber = t.Column<string>(maxLength: 50,   nullable: false),
                TableId           = t.Column<Guid>(nullable: true),
                TableNumber       = t.Column<string>(maxLength: 20,   nullable: true),
                GuestName         = t.Column<string>(maxLength: 200,  nullable: false),
                GuestPhone        = t.Column<string>(maxLength: 50,   nullable: false),
                GuestEmail        = t.Column<string>(maxLength: 200,  nullable: true),
                Covers            = t.Column<int>(nullable: false),
                ReservationDate   = t.Column<string>(maxLength: 20,   nullable: false),
                ReservationTime   = t.Column<string>(maxLength: 10,   nullable: false),
                Status            = t.Column<string>(maxLength: 30,   nullable: false),
                SpecialRequests   = t.Column<string>(maxLength: 1000, nullable: true),
                IsDeleted         = t.Column<bool>(nullable: false, defaultValue: false),
                CreatedAt         = t.Column<DateTime>(nullable: false),
                UpdatedAt         = t.Column<DateTime>(nullable: false),
            }, schema: "restaurant",
            constraints: t => t.PrimaryKey("PK_Reservations", x => x.Id));
        }

        protected override void Down(MigrationBuilder mb)
        {
            mb.DropTable("OrderItems",      "restaurant");
            mb.DropTable("Orders",          "restaurant");
            mb.DropTable("MenuItems",       "restaurant");
            mb.DropTable("MenuCategories",  "restaurant");
            mb.DropTable("Reservations",    "restaurant");
            mb.DropTable("Tables",          "restaurant");
        }
    }
}
