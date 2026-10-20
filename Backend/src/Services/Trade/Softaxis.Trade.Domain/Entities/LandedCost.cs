namespace Softaxis.Trade.Domain.Entities;

/// <summary>One shipment line's share of the shipment's costs.</summary>
public sealed record LandedLine(
    Guid ItemId, decimal GoodsValue, decimal AllocatedCost, decimal LandedTotal, decimal LandedUnitCost);

/// <summary>
/// What the goods really cost once they are here: their invoice value (in the workspace currency)
/// plus a share of every freight, duty and clearing charge. Pure arithmetic, no database, so the
/// rule is in one place and can be tested on its own.
/// </summary>
public static class LandedCost
{
    public static IReadOnlyList<LandedLine> Calculate(
        IReadOnlyList<ShipmentItem> items, IReadOnlyList<ShipmentCost> costs, decimal exchangeRate)
    {
        if (items.Count == 0) return [];

        var goods = items.Select(i => Math.Round(i.LineValue * exchangeRate, 2)).ToArray();
        var extra = new decimal[items.Count];

        foreach (var cost in costs.Where(c => c.Amount != 0))
        {
            var weights = Weights(items, goods, cost.Basis);
            var shares  = Spread(cost.Amount, weights);
            for (var i = 0; i < extra.Length; i++) extra[i] += shares[i];
        }

        return items.Select((item, i) =>
        {
            var total = goods[i] + extra[i];
            return new LandedLine(item.Id, goods[i], extra[i], total,
                item.Quantity > 0 ? Math.Round(total / item.Quantity, 4) : 0m);
        }).ToList();
    }

    /// <summary>
    /// The measure each line is shared by. A basis that gives nothing to share by (no weights
    /// entered, say) falls back to value, then to an equal split — a cost is never lost.
    /// </summary>
    private static decimal[] Weights(IReadOnlyList<ShipmentItem> items, decimal[] goods, string basis)
    {
        var w = basis switch
        {
            AllocationBasis.Weight   => items.Select(i => i.WeightKg ?? 0m).ToArray(),
            AllocationBasis.Volume   => items.Select(i => i.VolumeCbm ?? 0m).ToArray(),
            AllocationBasis.Quantity => items.Select(i => i.Quantity).ToArray(),
            _                        => goods,
        };
        if (w.Sum() > 0) return w;
        if (goods.Sum() > 0) return goods;
        return items.Select(_ => 1m).ToArray();
    }

    /// <summary>
    /// Splits <paramref name="amount"/> in proportion to <paramref name="weights"/>, to the cent,
    /// with the rounding remainder on the largest share so the parts always add up to the whole.
    /// </summary>
    public static decimal[] Spread(decimal amount, decimal[] weights)
    {
        var total  = weights.Sum();
        var shares = weights.Select(w => Math.Round(amount * w / total, 2)).ToArray();
        var diff   = amount - shares.Sum();
        if (diff != 0)
        {
            var at = Array.IndexOf(weights, weights.Max());
            shares[at] += diff;
        }
        return shares;
    }
}
