using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.CRM.Infrastructure.Persistence.Migrations
{
    public partial class InitialCreate : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(name: "crm");

            migrationBuilder.CreateTable(name: "leads", schema: "crm",
                columns: table => new
                {
                    Id             = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FirstName      = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    LastName       = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Title          = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Company        = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Industry       = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Email          = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Phone          = table.Column<string>(type: "nvarchar(50)",  maxLength: 50,  nullable: true),
                    Country        = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    City           = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Source         = table.Column<string>(type: "nvarchar(50)",  maxLength: 50,  nullable: true),
                    Status         = table.Column<string>(type: "nvarchar(20)",  maxLength: 20,  nullable: false, defaultValue: "new"),
                    Priority       = table.Column<string>(type: "nvarchar(20)",  maxLength: 20,  nullable: true,  defaultValue: "medium"),
                    Score          = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    EstimatedValue = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    Currency       = table.Column<string>(type: "nvarchar(10)",  maxLength: 10,  nullable: true),
                    AssignedTo     = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    CreatedDate    = table.Column<string>(type: "nvarchar(20)",  maxLength: 20,  nullable: true),
                    LastContactDate= table.Column<string>(type: "nvarchar(20)",  maxLength: 20,  nullable: true),
                    NextFollowUp   = table.Column<string>(type: "nvarchar(20)",  maxLength: 20,  nullable: true),
                    Notes          = table.Column<string>(type: "nvarchar(2000)",maxLength: 2000,nullable: true),
                    ConvertedDealId= table.Column<string>(type: "nvarchar(50)",  maxLength: 50,  nullable: true),
                    Tags           = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    IsDeleted      = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    CreatedAt      = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt      = table.Column<DateTime>(type: "datetime2", nullable: true),
                },
                constraints: table => table.PrimaryKey("PK_leads", x => x.Id));

            migrationBuilder.CreateTable(name: "customers", schema: "crm",
                columns: table => new
                {
                    Id             = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name           = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    TradeName      = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Industry       = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Website        = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Country        = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    City           = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Address        = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Phone          = table.Column<string>(type: "nvarchar(50)",  maxLength: 50,  nullable: true),
                    Email          = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Status         = table.Column<string>(type: "nvarchar(20)",  maxLength: 20,  nullable: false, defaultValue: "active"),
                    Tier           = table.Column<string>(type: "nvarchar(20)",  maxLength: 20,  nullable: true,  defaultValue: "standard"),
                    AccountManager = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Since          = table.Column<string>(type: "nvarchar(20)",  maxLength: 20,  nullable: true),
                    LastActivity   = table.Column<string>(type: "nvarchar(20)",  maxLength: 20,  nullable: true),
                    TotalRevenue   = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    OpenDeals      = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    Currency       = table.Column<string>(type: "nvarchar(10)",  maxLength: 10,  nullable: true),
                    Employees      = table.Column<string>(type: "nvarchar(20)",  maxLength: 20,  nullable: true),
                    Description    = table.Column<string>(type: "nvarchar(2000)",maxLength: 2000,nullable: true),
                    ContractRenewal= table.Column<string>(type: "nvarchar(20)",  maxLength: 20,  nullable: true),
                    NpsScore       = table.Column<int>(type: "int", nullable: true),
                    Tags           = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    IsDeleted      = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    CreatedAt      = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt      = table.Column<DateTime>(type: "datetime2", nullable: true),
                },
                constraints: table => table.PrimaryKey("PK_customers", x => x.Id));

            migrationBuilder.CreateTable(name: "deals", schema: "crm",
                columns: table => new
                {
                    Id                = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Title             = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Company           = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Value             = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    Currency          = table.Column<string>(type: "nvarchar(10)",  maxLength: 10,  nullable: true),
                    Stage             = table.Column<string>(type: "nvarchar(20)",  maxLength: 20,  nullable: false, defaultValue: "lead"),
                    Priority          = table.Column<string>(type: "nvarchar(20)",  maxLength: 20,  nullable: true,  defaultValue: "medium"),
                    Probability       = table.Column<int>(type: "int", nullable: false, defaultValue: 10),
                    ExpectedCloseDate = table.Column<string>(type: "nvarchar(20)",  maxLength: 20,  nullable: true),
                    CreatedDate       = table.Column<string>(type: "nvarchar(20)",  maxLength: 20,  nullable: true),
                    AssignedTo        = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Source            = table.Column<string>(type: "nvarchar(50)",  maxLength: 50,  nullable: true),
                    Industry          = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Description       = table.Column<string>(type: "nvarchar(2000)",maxLength: 2000,nullable: true),
                    NextAction        = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    NextActionDate    = table.Column<string>(type: "nvarchar(20)",  maxLength: 20,  nullable: true),
                    ContactJson       = table.Column<string>(type: "nvarchar(1000)",maxLength: 1000,nullable: true),
                    Tags              = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    IsDeleted         = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    CreatedAt         = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt         = table.Column<DateTime>(type: "datetime2", nullable: true),
                },
                constraints: table => table.PrimaryKey("PK_deals", x => x.Id));
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable("deals",     "crm");
            migrationBuilder.DropTable("customers", "crm");
            migrationBuilder.DropTable("leads",     "crm");
        }
    }
}
