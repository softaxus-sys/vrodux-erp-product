using Softaxis.BuildingBlocks.Domain.Primitives;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.BuildingBlocks.Domain.Exceptions;

namespace Softaxis.POS.Domain.Entities;

public sealed class ProductCategory : AuditableEntity<Guid>
{
    public string  Name             { get; private set; } = default!;
    public string? Description      { get; private set; }
    public Guid?   ParentCategoryId { get; private set; }
    public bool    IsActive         { get; private set; }
    public int     SortOrder        { get; private set; }

    // Navigation
    public ProductCategory?           ParentCategory { get; private set; }
    public ICollection<ProductCategory> SubCategories { get; private set; } = [];
    public ICollection<Product>         Products      { get; private set; } = [];

    private ProductCategory() { }

    public static Result<ProductCategory> Create(
        string name,
        string? description = null,
        Guid? parentCategoryId = null,
        int sortOrder = 0)
    {
        if (string.IsNullOrWhiteSpace(name))
            return Result.Failure<ProductCategory>(Error.Custom("Category.NameRequired", "Category name is required."));

        if (name.Trim().Length > 100)
            return Result.Failure<ProductCategory>(Error.Custom("Category.NameTooLong", "Category name cannot exceed 100 characters."));

        var category = new ProductCategory
        {
            Id               = Guid.NewGuid(),
            Name             = name.Trim(),
            Description      = description?.Trim(),
            ParentCategoryId = parentCategoryId,
            IsActive         = true,
            SortOrder        = sortOrder
        };

        return Result.Success(category);
    }

    public Result Update(string name, string? description, Guid? parentCategoryId, int sortOrder)
    {
        if (string.IsNullOrWhiteSpace(name))
            return Result.Failure(Error.Custom("Category.NameRequired", "Category name is required."));

        if (name.Trim().Length > 100)
            return Result.Failure(Error.Custom("Category.NameTooLong", "Category name cannot exceed 100 characters."));

        Name             = name.Trim();
        Description      = description?.Trim();
        ParentCategoryId = parentCategoryId;
        SortOrder        = sortOrder;

        return Result.Success();
    }

    public void Activate()   => IsActive = true;
    public void Deactivate() => IsActive = false;
}
