using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Recipe.Infrastructure.Persistence.Migrations
{
    public partial class InitialCreate : Migration
    {
        protected override void Up(MigrationBuilder mb)
        {
            mb.EnsureSchema("recipe");

            mb.CreateTable("Recipes", t => new
            {
                Id              = t.Column<Guid>(nullable: false),
                RecipeNumber    = t.Column<string>(maxLength: 50,   nullable: false),
                MenuItemId      = t.Column<Guid>(nullable: false),
                MenuItemName    = t.Column<string>(maxLength: 200,  nullable: false),
                Description     = t.Column<string>(maxLength: 1000, nullable: true),
                Servings        = t.Column<int>(nullable: false),
                PrepTimeMinutes = t.Column<int>(nullable: false),
                CookTimeMinutes = t.Column<int>(nullable: false),
                Status          = t.Column<string>(maxLength: 30,   nullable: false),
                Instructions    = t.Column<string>(maxLength: 4000, nullable: true),
                Notes           = t.Column<string>(maxLength: 1000, nullable: true),
                IsDeleted       = t.Column<bool>(nullable: false, defaultValue: false),
                CreatedAt       = t.Column<DateTime>(nullable: false),
                UpdatedAt       = t.Column<DateTime>(nullable: false),
            }, schema: "recipe",
            constraints: t => t.PrimaryKey("PK_Recipes", x => x.Id));

            mb.CreateTable("RecipeIngredients", t => new
            {
                Id                 = t.Column<Guid>(nullable: false),
                RecipeId           = t.Column<Guid>(nullable: false),
                InventoryProductId = t.Column<Guid>(nullable: true),
                ProductName        = t.Column<string>(maxLength: 200, nullable: false),
                Quantity           = t.Column<decimal>(precision: 18, scale: 4, nullable: false),
                Unit               = t.Column<string>(maxLength: 30,  nullable: false),
                CostPerUnit        = t.Column<decimal>(precision: 18, scale: 4, nullable: false),
                IsDeleted          = t.Column<bool>(nullable: false, defaultValue: false),
                CreatedAt          = t.Column<DateTime>(nullable: false),
            }, schema: "recipe",
            constraints: t =>
            {
                t.PrimaryKey("PK_RecipeIngredients", x => x.Id);
                t.ForeignKey(
                    name: "FK_RecipeIngredients_Recipes",
                    column: x => x.RecipeId,
                    principalSchema: "recipe",
                    principalTable: "Recipes",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });
        }

        protected override void Down(MigrationBuilder mb)
        {
            mb.DropTable("RecipeIngredients", "recipe");
            mb.DropTable("Recipes",           "recipe");
        }
    }
}
