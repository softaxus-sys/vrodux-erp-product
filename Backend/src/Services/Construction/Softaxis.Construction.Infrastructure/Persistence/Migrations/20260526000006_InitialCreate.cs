using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Construction.Infrastructure.Persistence.Migrations
{
    public partial class InitialCreate : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(name: "construction");

            migrationBuilder.CreateTable(name: "projects", schema: "construction",
                columns: table => new
                {
                    Id             = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProjectNumber  = table.Column<string>(type: "nvarchar(50)",  maxLength: 50,  nullable: false),
                    Name           = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Client         = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Location       = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    ProjectType    = table.Column<string>(type: "nvarchar(30)",  maxLength: 30,  nullable: true),
                    Status         = table.Column<string>(type: "nvarchar(20)",  maxLength: 20,  nullable: false, defaultValue: "planning"),
                    StartDate      = table.Column<string>(type: "nvarchar(20)",  maxLength: 20,  nullable: true),
                    EndDate        = table.Column<string>(type: "nvarchar(20)",  maxLength: 20,  nullable: true),
                    ContractValue  = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    BudgetSpent    = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    CompletionPct  = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    ProjectManager = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    SiteEngineer   = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Workers        = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    Notes          = table.Column<string>(type: "nvarchar(2000)",maxLength: 2000,nullable: true),
                    IsDeleted      = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    CreatedAt      = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt      = table.Column<DateTime>(type: "datetime2", nullable: true),
                },
                constraints: table => table.PrimaryKey("PK_projects", x => x.Id));

            migrationBuilder.CreateTable(name: "project_phases", schema: "construction",
                columns: table => new
                {
                    Id            = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProjectId     = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name          = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    StartDate     = table.Column<string>(type: "nvarchar(20)",  maxLength: 20,  nullable: true),
                    EndDate       = table.Column<string>(type: "nvarchar(20)",  maxLength: 20,  nullable: true),
                    Status        = table.Column<string>(type: "nvarchar(20)",  maxLength: 20,  nullable: true, defaultValue: "not_started"),
                    CompletionPct = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_project_phases", x => x.Id);
                    table.ForeignKey(
                        name: "FK_project_phases_projects_ProjectId",
                        column: x => x.ProjectId,
                        principalSchema: "construction",
                        principalTable: "projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(name: "sites", schema: "construction",
                columns: table => new
                {
                    Id                 = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SiteCode           = table.Column<string>(type: "nvarchar(30)",  maxLength: 30,  nullable: false),
                    Name               = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    ProjectId          = table.Column<string>(type: "nvarchar(50)",  maxLength: 50,  nullable: true),
                    ProjectName        = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Address            = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    City               = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Emirate            = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Lat                = table.Column<string>(type: "nvarchar(20)",  maxLength: 20,  nullable: true),
                    Lng                = table.Column<string>(type: "nvarchar(20)",  maxLength: 20,  nullable: true),
                    SiteManager        = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    SiteManagerPhone   = table.Column<string>(type: "nvarchar(50)",  maxLength: 50,  nullable: true),
                    SafetyOfficer      = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    SafetyOfficerPhone = table.Column<string>(type: "nvarchar(50)",  maxLength: 50,  nullable: true),
                    Status             = table.Column<string>(type: "nvarchar(20)",  maxLength: 20,  nullable: true, defaultValue: "active"),
                    CurrentWorkers     = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    MaxWorkers         = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    Area               = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    StartDate          = table.Column<string>(type: "nvarchar(20)",  maxLength: 20,  nullable: true),
                    PermitNumber       = table.Column<string>(type: "nvarchar(50)",  maxLength: 50,  nullable: true),
                    PermitExpiry       = table.Column<string>(type: "nvarchar(20)",  maxLength: 20,  nullable: true),
                    LastInspection     = table.Column<string>(type: "nvarchar(20)",  maxLength: 20,  nullable: true),
                    NextInspection     = table.Column<string>(type: "nvarchar(20)",  maxLength: 20,  nullable: true),
                    SafetyScore        = table.Column<int>(type: "int", nullable: false, defaultValue: 100),
                    Notes              = table.Column<string>(type: "nvarchar(2000)",maxLength: 2000,nullable: true),
                    IsDeleted          = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    CreatedAt          = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt          = table.Column<DateTime>(type: "datetime2", nullable: true),
                },
                constraints: table => table.PrimaryKey("PK_sites", x => x.Id));

            migrationBuilder.CreateTable(name: "contractors", schema: "construction",
                columns: table => new
                {
                    Id                 = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ContractorCode     = table.Column<string>(type: "nvarchar(30)",  maxLength: 30,  nullable: false),
                    CompanyName        = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    TradeName          = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Trade              = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Status             = table.Column<string>(type: "nvarchar(20)",  maxLength: 20,  nullable: true, defaultValue: "active"),
                    Rating             = table.Column<decimal>(type: "decimal(3,1)", precision: 3, scale: 1, nullable: false),
                    ContactPerson      = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Email              = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Phone              = table.Column<string>(type: "nvarchar(50)",  maxLength: 50,  nullable: true),
                    City               = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Country            = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    LicenseNumber      = table.Column<string>(type: "nvarchar(50)",  maxLength: 50,  nullable: true),
                    LicenseExpiry      = table.Column<string>(type: "nvarchar(20)",  maxLength: 20,  nullable: true),
                    InsuranceProvider  = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    InsuranceExpiry    = table.Column<string>(type: "nvarchar(20)",  maxLength: 20,  nullable: true),
                    InsuranceCovered   = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ActiveProjects     = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    CompletedProjects  = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    TotalContractValue = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    Notes              = table.Column<string>(type: "nvarchar(2000)",maxLength: 2000,nullable: true),
                    IsDeleted          = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    CreatedAt          = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt          = table.Column<DateTime>(type: "datetime2", nullable: true),
                },
                constraints: table => table.PrimaryKey("PK_contractors", x => x.Id));

            migrationBuilder.CreateTable(name: "boqs", schema: "construction",
                columns: table => new
                {
                    Id           = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BoqNumber    = table.Column<string>(type: "nvarchar(50)",  maxLength: 50,  nullable: false),
                    ProjectId    = table.Column<string>(type: "nvarchar(50)",  maxLength: 50,  nullable: true),
                    ProjectName  = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Status       = table.Column<string>(type: "nvarchar(20)",  maxLength: 20,  nullable: true, defaultValue: "draft"),
                    ApprovedBy   = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    ApprovedDate = table.Column<string>(type: "nvarchar(20)",  maxLength: 20,  nullable: true),
                    IsDeleted    = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    CreatedAt    = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt    = table.Column<DateTime>(type: "datetime2", nullable: true),
                },
                constraints: table => table.PrimaryKey("PK_boqs", x => x.Id));

            migrationBuilder.CreateTable(name: "boq_items", schema: "construction",
                columns: table => new
                {
                    Id           = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BoqId        = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ItemCode     = table.Column<string>(type: "nvarchar(30)",  maxLength: 30,  nullable: false),
                    Description  = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Unit         = table.Column<string>(type: "nvarchar(20)",  maxLength: 20,  nullable: true),
                    Quantity     = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    UnitRate     = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    CompletedQty = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    VariationQty = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_boq_items", x => x.Id);
                    table.ForeignKey(
                        name: "FK_boq_items_boqs_BoqId",
                        column: x => x.BoqId,
                        principalSchema: "construction",
                        principalTable: "boqs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex("IX_project_phases_ProjectId", schema: "construction", table: "project_phases", column: "ProjectId");
            migrationBuilder.CreateIndex("IX_boq_items_BoqId", schema: "construction", table: "boq_items", column: "BoqId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable("boq_items",      "construction");
            migrationBuilder.DropTable("boqs",           "construction");
            migrationBuilder.DropTable("contractors",    "construction");
            migrationBuilder.DropTable("sites",          "construction");
            migrationBuilder.DropTable("project_phases", "construction");
            migrationBuilder.DropTable("projects",       "construction");
        }
    }
}
