using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Manufacturing.Domain.Entities;

namespace Softaxis.Manufacturing.Infrastructure.Persistence.Configurations;

internal sealed class BillOfMaterialsConfiguration : IEntityTypeConfiguration<BillOfMaterials>
{
    public void Configure(EntityTypeBuilder<BillOfMaterials> builder)
    {
        builder.ToTable("boms");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.BomNumber).IsRequired().HasMaxLength(30);
        builder.Property(x => x.Name).IsRequired().HasMaxLength(200);
        builder.Property(x => x.ProductName).IsRequired().HasMaxLength(300);
        builder.Property(x => x.ProductSku).HasMaxLength(100);
        builder.HasIndex(x => x.ProductId);
        builder.Property(x => x.OutputQuantity).HasPrecision(18, 4);
        builder.Property(x => x.Unit).IsRequired().HasMaxLength(30);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20).HasDefaultValue(BomStatus.Draft);
        builder.HasIndex(x => x.Status);
        builder.Property(x => x.Notes).HasMaxLength(2000);
        builder.Property(x => x.IsDeleted).HasDefaultValue(false);
        builder.Ignore(x => x.MaterialCost);
        builder.Ignore(x => x.OperationCost);
        builder.Ignore(x => x.TotalCost);
        builder.Ignore(x => x.CostPerUnit);

        builder.HasMany(x => x.Lines).WithOne().HasForeignKey(l => l.BomId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(x => x.Operations).WithOne().HasForeignKey(o => o.BomId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(x => x.ByProducts).WithOne().HasForeignKey(o => o.BomId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class BomLineConfiguration : IEntityTypeConfiguration<BomLine>
{
    public void Configure(EntityTypeBuilder<BomLine> builder)
    {
        builder.ToTable("bom_lines");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.HasIndex(x => x.ComponentProductId);
        builder.Property(x => x.ComponentName).IsRequired().HasMaxLength(300);
        builder.Property(x => x.ComponentSku).HasMaxLength(100);
        builder.Property(x => x.Quantity).HasPrecision(18, 4);
        builder.Property(x => x.Unit).IsRequired().HasMaxLength(30);
        builder.Property(x => x.ScrapPercent).HasPrecision(5, 2);
        builder.Property(x => x.UnitCost).HasPrecision(18, 4);
        builder.Ignore(x => x.EffectiveQuantity);
        builder.Ignore(x => x.LineCost);
    }
}

internal sealed class ProductionOrderConfiguration : IEntityTypeConfiguration<ProductionOrder>
{
    public void Configure(EntityTypeBuilder<ProductionOrder> builder)
    {
        builder.ToTable("production_orders");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.OrderNumber).IsRequired().HasMaxLength(30);
        builder.Property(x => x.BomNumber).IsRequired().HasMaxLength(30);
        builder.HasIndex(x => x.BomId);
        builder.Property(x => x.ProductName).IsRequired().HasMaxLength(300);
        builder.Property(x => x.ProductSku).HasMaxLength(100);
        builder.HasIndex(x => x.ProductId);
        builder.Property(x => x.Unit).IsRequired().HasMaxLength(30);
        builder.Property(x => x.PlannedQuantity).HasPrecision(18, 4);
        builder.Property(x => x.ProducedQuantity).HasPrecision(18, 4);
        builder.Property(x => x.WarehouseName).HasMaxLength(200);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20).HasDefaultValue(ProductionOrderStatus.Planned);
        builder.HasIndex(x => x.Status);
        builder.Property(x => x.PlannedStartDate).HasMaxLength(10);
        builder.Property(x => x.DueDate).HasMaxLength(10);
        builder.Property(x => x.Reference).HasMaxLength(100);
        builder.Property(x => x.Notes).HasMaxLength(2000);
        builder.Property(x => x.MaterialCost).HasPrecision(18, 4);
        builder.Property(x => x.UnitCost).HasPrecision(18, 4);
        builder.Property(x => x.IsDeleted).HasDefaultValue(false);
        builder.Property(x => x.LabourCost).HasPrecision(18, 4);
        builder.Property(x => x.OverheadCost).HasPrecision(18, 4);
        builder.Property(x => x.ScrappedQuantity).HasPrecision(18, 4);
        builder.Property(x => x.QualityNotes).HasMaxLength(1000);
        builder.Property(x => x.JournalEntryNumber).HasMaxLength(50);
        builder.Property(x => x.ScrapCost).HasPrecision(18, 4);
        builder.Property(x => x.BatchNumber).HasMaxLength(100);
        builder.Property(x => x.ExpiryDate).HasMaxLength(10);
        builder.Property(x => x.RequisitionNumber).HasMaxLength(50);
        builder.Property(x => x.ParentOrderNumber).HasMaxLength(30);
        builder.HasIndex(x => x.ParentOrderId);
        builder.HasIndex(x => x.Reference);

        builder.HasMany(x => x.Outputs).WithOne()
            .HasForeignKey(o => o.ProductionOrderId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(x => x.Issues).WithOne()
            .HasForeignKey(o => o.ProductionOrderId).OnDelete(DeleteBehavior.Cascade);
        builder.Ignore(x => x.HasIssuedMaterials);
        builder.Ignore(x => x.CanIssue);
        builder.Ignore(x => x.TotalCost);

        builder.HasMany(x => x.Operations).WithOne()
            .HasForeignKey(o => o.ProductionOrderId).OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(x => x.Components).WithOne()
            .HasForeignKey(c => c.ProductionOrderId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class ProductionOrderComponentConfiguration : IEntityTypeConfiguration<ProductionOrderComponent>
{
    public void Configure(EntityTypeBuilder<ProductionOrderComponent> builder)
    {
        builder.ToTable("production_order_components");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.HasIndex(x => x.ProductId);
        builder.Property(x => x.Name).IsRequired().HasMaxLength(300);
        builder.Property(x => x.Sku).HasMaxLength(100);
        builder.Property(x => x.RequiredQuantity).HasPrecision(18, 4);
        builder.Property(x => x.IssuedQuantity).HasPrecision(18, 4);
        builder.Property(x => x.Unit).IsRequired().HasMaxLength(30);
        builder.Property(x => x.UnitCost).HasPrecision(18, 4);
        builder.Ignore(x => x.RemainingQuantity);
    }
}

internal sealed class WorkCentreConfiguration : IEntityTypeConfiguration<WorkCentre>
{
    public void Configure(EntityTypeBuilder<WorkCentre> builder)
    {
        builder.ToTable("work_centres");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Name).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Code).HasMaxLength(30);
        builder.Property(x => x.LabourRatePerHour).HasPrecision(18, 4);
        builder.Property(x => x.OverheadRatePerHour).HasPrecision(18, 4);
        builder.Property(x => x.CapacityHoursPerDay).HasPrecision(6, 2).HasDefaultValue(8m);
        builder.Property(x => x.IsActive).HasDefaultValue(true);
        builder.Property(x => x.IsDeleted).HasDefaultValue(false);
    }
}

internal sealed class BomOperationConfiguration : IEntityTypeConfiguration<BomOperation>
{
    public void Configure(EntityTypeBuilder<BomOperation> builder)
    {
        builder.ToTable("bom_operations");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.HasIndex(x => x.WorkCentreId);
        builder.Property(x => x.Name).IsRequired().HasMaxLength(200);
        builder.Property(x => x.WorkCentreName).IsRequired().HasMaxLength(200);
        builder.Property(x => x.SetupMinutes).HasPrecision(18, 2);
        builder.Property(x => x.RunMinutesPerBatch).HasPrecision(18, 2);
        builder.Property(x => x.LabourRate).HasPrecision(18, 4);
        builder.Property(x => x.OverheadRate).HasPrecision(18, 4);
        builder.Ignore(x => x.BatchCost);
    }
}

internal sealed class ProductionOrderOperationConfiguration : IEntityTypeConfiguration<ProductionOrderOperation>
{
    public void Configure(EntityTypeBuilder<ProductionOrderOperation> builder)
    {
        builder.ToTable("production_order_operations");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.HasIndex(x => x.WorkCentreId);
        builder.Property(x => x.Name).IsRequired().HasMaxLength(200);
        builder.Property(x => x.WorkCentreName).IsRequired().HasMaxLength(200);
        builder.Property(x => x.PlannedMinutes).HasPrecision(18, 2);
        builder.Property(x => x.ActualMinutes).HasPrecision(18, 2);
        builder.Property(x => x.LabourRate).HasPrecision(18, 4);
        builder.Property(x => x.OverheadRate).HasPrecision(18, 4);
        builder.Ignore(x => x.LabourCost);
        builder.Ignore(x => x.OverheadCost);
    }
}

internal sealed class ProductionOrderOutputConfiguration : IEntityTypeConfiguration<ProductionOrderOutput>
{
    public void Configure(EntityTypeBuilder<ProductionOrderOutput> builder)
    {
        builder.ToTable("production_order_outputs");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Name).IsRequired().HasMaxLength(300);
        builder.Property(x => x.Sku).HasMaxLength(100);
        builder.Property(x => x.Unit).IsRequired().HasMaxLength(30);
        builder.Property(x => x.PlannedQuantity).HasPrecision(18, 4);
        builder.Property(x => x.ReceivedQuantity).HasPrecision(18, 4);
    }
}

internal sealed class ProductionMaterialIssueConfiguration : IEntityTypeConfiguration<ProductionMaterialIssue>
{
    public void Configure(EntityTypeBuilder<ProductionMaterialIssue> builder)
    {
        builder.ToTable("production_material_issues");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.HasIndex(x => x.ProductId);
        builder.HasIndex(x => x.BatchNumber);
        builder.Property(x => x.ProductName).IsRequired().HasMaxLength(300);
        builder.Property(x => x.Quantity).HasPrecision(18, 4);
        builder.Property(x => x.UnitCost).HasPrecision(18, 4);
        builder.Property(x => x.BatchNumber).HasMaxLength(100);
    }
}

internal sealed class BomByProductConfiguration : IEntityTypeConfiguration<BomByProduct>
{
    public void Configure(EntityTypeBuilder<BomByProduct> builder)
    {
        builder.ToTable("bom_by_products");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.ProductName).IsRequired().HasMaxLength(300);
        builder.Property(x => x.ProductSku).HasMaxLength(100);
        builder.Property(x => x.Quantity).HasPrecision(18, 4);
        builder.Property(x => x.Unit).IsRequired().HasMaxLength(30);
    }
}

internal sealed class ManufacturingAlertStateConfiguration : IEntityTypeConfiguration<ManufacturingAlertState>
{
    public void Configure(EntityTypeBuilder<ManufacturingAlertState> builder)
    {
        builder.ToTable("alert_state");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.LastDigestDate).IsRequired().HasMaxLength(10);
    }
}
