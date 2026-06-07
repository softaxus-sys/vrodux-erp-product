using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.RealEstate.Infrastructure.Persistence.Migrations
{
    public partial class InitialCreate : Migration
    {
        protected override void Up(MigrationBuilder mb)
        {
            mb.EnsureSchema("real_estate");

            mb.CreateTable("Properties", t => new
            {
                Id             = t.Column<Guid>(nullable: false),
                PropertyNumber = t.Column<string>(maxLength: 50,  nullable: false),
                Name           = t.Column<string>(maxLength: 200, nullable: false),
                PropertyType   = t.Column<string>(maxLength: 50,  nullable: false),
                Address        = t.Column<string>(maxLength: 500, nullable: false),
                City           = t.Column<string>(maxLength: 100, nullable: false),
                Emirate        = t.Column<string>(maxLength: 100, nullable: false),
                TotalArea      = t.Column<decimal>(precision: 18, scale: 2, nullable: false),
                TotalUnits     = t.Column<int>(nullable: false),
                OccupiedUnits  = t.Column<int>(nullable: false),
                Status         = t.Column<string>(maxLength: 30,  nullable: false),
                MarketValue    = t.Column<decimal>(precision: 18, scale: 2, nullable: false),
                Developer      = t.Column<string>(maxLength: 200, nullable: true),
                Description    = t.Column<string>(maxLength: 1000, nullable: true),
                IsDeleted      = t.Column<bool>(nullable: false, defaultValue: false),
                CreatedAt      = t.Column<DateTime>(nullable: false),
                UpdatedAt      = t.Column<DateTime>(nullable: false),
            }, schema: "real_estate",
            constraints: t => t.PrimaryKey("PK_Properties", x => x.Id));

            mb.CreateTable("PropertyUnits", t => new
            {
                Id                = t.Column<Guid>(nullable: false),
                PropertyId        = t.Column<Guid>(nullable: false),
                UnitNumber        = t.Column<string>(maxLength: 50,  nullable: false),
                UnitType          = t.Column<string>(maxLength: 50,  nullable: false),
                Area              = t.Column<decimal>(precision: 18, scale: 2, nullable: false),
                Floor             = t.Column<int>(nullable: false),
                RentPerYear       = t.Column<decimal>(precision: 18, scale: 2, nullable: false),
                SalePrice         = t.Column<decimal>(precision: 18, scale: 2, nullable: false),
                Status            = t.Column<string>(maxLength: 30,  nullable: false),
                CurrentTenantId   = t.Column<Guid>(nullable: true),
                CurrentTenantName = t.Column<string>(maxLength: 200, nullable: true),
                IsDeleted         = t.Column<bool>(nullable: false, defaultValue: false),
                CreatedAt         = t.Column<DateTime>(nullable: false),
                UpdatedAt         = t.Column<DateTime>(nullable: false),
            }, schema: "real_estate",
            constraints: t =>
            {
                t.PrimaryKey("PK_PropertyUnits", x => x.Id);
                t.ForeignKey(
                    name: "FK_PropertyUnits_Properties",
                    column: x => x.PropertyId,
                    principalSchema: "real_estate",
                    principalTable: "Properties",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

            mb.CreateTable("Tenants", t => new
            {
                Id            = t.Column<Guid>(nullable: false),
                TenantNumber  = t.Column<string>(maxLength: 50,  nullable: false),
                Name          = t.Column<string>(maxLength: 200, nullable: false),
                TenantType    = t.Column<string>(maxLength: 30,  nullable: false),
                Email         = t.Column<string>(maxLength: 200, nullable: false),
                Phone         = t.Column<string>(maxLength: 50,  nullable: false),
                NationalId    = t.Column<string>(maxLength: 50,  nullable: true),
                CompanyName   = t.Column<string>(maxLength: 200, nullable: true),
                TradeLicense  = t.Column<string>(maxLength: 100, nullable: true),
                Nationality   = t.Column<string>(maxLength: 100, nullable: false),
                Status        = t.Column<string>(maxLength: 30,  nullable: false),
                ActiveContracts = t.Column<int>(nullable: false),
                TotalPaid     = t.Column<decimal>(precision: 18, scale: 2, nullable: false),
                IsDeleted     = t.Column<bool>(nullable: false, defaultValue: false),
                CreatedAt     = t.Column<DateTime>(nullable: false),
                UpdatedAt     = t.Column<DateTime>(nullable: false),
            }, schema: "real_estate",
            constraints: t => t.PrimaryKey("PK_Tenants", x => x.Id));

            mb.CreateTable("LeaseContracts", t => new
            {
                Id              = t.Column<Guid>(nullable: false),
                ContractNumber  = t.Column<string>(maxLength: 50,  nullable: false),
                PropertyId      = t.Column<Guid>(nullable: false),
                PropertyName    = t.Column<string>(maxLength: 200, nullable: false),
                UnitId          = t.Column<Guid>(nullable: false),
                UnitNumber      = t.Column<string>(maxLength: 50,  nullable: false),
                TenantId        = t.Column<Guid>(nullable: false),
                TenantName      = t.Column<string>(maxLength: 200, nullable: false),
                StartDate       = t.Column<string>(maxLength: 20,  nullable: false),
                EndDate         = t.Column<string>(maxLength: 20,  nullable: false),
                AnnualRent      = t.Column<decimal>(precision: 18, scale: 2, nullable: false),
                Cheques         = t.Column<int>(nullable: false),
                SecurityDeposit = t.Column<decimal>(precision: 18, scale: 2, nullable: false),
                Status          = t.Column<string>(maxLength: 30,  nullable: false),
                TotalPaid       = t.Column<decimal>(precision: 18, scale: 2, nullable: false),
                EjariNumber     = t.Column<string>(maxLength: 100, nullable: true),
                Notes           = t.Column<string>(maxLength: 1000, nullable: true),
                IsDeleted       = t.Column<bool>(nullable: false, defaultValue: false),
                CreatedAt       = t.Column<DateTime>(nullable: false),
                UpdatedAt       = t.Column<DateTime>(nullable: false),
            }, schema: "real_estate",
            constraints: t => t.PrimaryKey("PK_LeaseContracts", x => x.Id));

            mb.CreateTable("Brokers", t => new
            {
                Id              = t.Column<Guid>(nullable: false),
                BrokerNumber    = t.Column<string>(maxLength: 50,  nullable: false),
                Name            = t.Column<string>(maxLength: 200, nullable: false),
                Agency          = t.Column<string>(maxLength: 200, nullable: false),
                Email           = t.Column<string>(maxLength: 200, nullable: false),
                Phone           = t.Column<string>(maxLength: 50,  nullable: false),
                LicenseNumber   = t.Column<string>(maxLength: 100, nullable: false),
                LicenseExpiry   = t.Column<string>(maxLength: 20,  nullable: false),
                Specialization  = t.Column<string>(maxLength: 30,  nullable: false),
                DealsCompleted  = t.Column<int>(nullable: false),
                TotalCommission = t.Column<decimal>(precision: 18, scale: 2, nullable: false),
                CommissionRate  = t.Column<decimal>(precision: 5,  scale: 2, nullable: false),
                Rating          = t.Column<decimal>(precision: 3,  scale: 1, nullable: false),
                Status          = t.Column<string>(maxLength: 30,  nullable: false),
                IsDeleted       = t.Column<bool>(nullable: false, defaultValue: false),
                CreatedAt       = t.Column<DateTime>(nullable: false),
                UpdatedAt       = t.Column<DateTime>(nullable: false),
            }, schema: "real_estate",
            constraints: t => t.PrimaryKey("PK_Brokers", x => x.Id));
        }

        protected override void Down(MigrationBuilder mb)
        {
            mb.DropTable("LeaseContracts", "real_estate");
            mb.DropTable("PropertyUnits",  "real_estate");
            mb.DropTable("Tenants",        "real_estate");
            mb.DropTable("Brokers",        "real_estate");
            mb.DropTable("Properties",     "real_estate");
        }
    }
}
