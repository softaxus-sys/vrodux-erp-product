namespace Softaxis.Identity.Domain.Entities;

/// <summary>
/// Which modules cannot exist without another. The one place this is decided: a tenant's resolved
/// module list is closed over these rules, so a workspace can never end up with a till and no
/// product catalogue, however its modules were chosen (signup, super-admin grant, industry pack).
///
/// <para>Inventory is the single source of truth for products and stock. POS, Restaurant POS,
/// Manufacturing and E-commerce sell, make or publish what Inventory holds, so each of them brings
/// Inventory with it and Inventory cannot be switched off while one of them is on.</para>
///
/// <para>Keep the frontend copies in step: <c>lib/onboarding/module-data.ts</c> (signup) and
/// <c>modules/super-admin/components/module-selector.tsx</c> (super-admin tools). The gateway has its
/// own table for which database schemas to install (<c>LicensedModules.Requires</c>).</para>
/// </summary>
public static class ModuleDependencies
{
    /// <summary>module → modules it needs. Direct dependencies only; <see cref="Close"/> follows chains.</summary>
    public static readonly IReadOnlyDictionary<string, string[]> Requires =
        new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
        {
            ["pos"]           = ["inventory"],
            ["restaurant"]    = ["pos"],          // and so inventory, through pos
            ["manufacturing"] = ["inventory"],
            ["ecommerce"]     = ["inventory"],
        };

    /// <summary>
    /// Adds every module the given ones need, following chains (restaurant → pos → inventory).
    /// Returns the modules that were added, in the order they were found.
    /// </summary>
    public static IReadOnlyList<string> Close(List<string> modules)
    {
        var added = new List<string>();
        bool grew;
        do
        {
            grew = false;
            foreach (var m in modules.ToArray())
            {
                if (!Requires.TryGetValue(m, out var needs)) continue;
                foreach (var dep in needs)
                {
                    if (modules.Contains(dep, StringComparer.OrdinalIgnoreCase)) continue;
                    modules.Add(dep);
                    added.Add(dep);
                    grew = true;
                }
            }
        } while (grew);
        return added;
    }

    /// <summary>The modules that need <paramref name="module"/>, directly or through a chain, among those selected.</summary>
    public static IReadOnlyList<string> DependentsOf(string module, IEnumerable<string> selected)
    {
        var all = selected.ToList();
        return all
            .Where(s => !s.Equals(module, StringComparison.OrdinalIgnoreCase) && NeedsTransitively(s, module))
            .ToList();
    }

    private static bool NeedsTransitively(string module, string target, int depth = 0)
    {
        if (depth > 8 || !Requires.TryGetValue(module, out var needs)) return false;
        return needs.Any(n => n.Equals(target, StringComparison.OrdinalIgnoreCase) || NeedsTransitively(n, target, depth + 1));
    }
}
