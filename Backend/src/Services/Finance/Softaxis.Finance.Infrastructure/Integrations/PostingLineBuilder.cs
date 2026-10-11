namespace Softaxis.Finance.Infrastructure.Integrations;

/// <summary>An account a posting role resolved to.</summary>
internal sealed record ResolvedAccount(Guid Id, string Number, string Name, bool IsActive);

internal sealed record BuiltLine(
    string Role, string RoleLabel, Guid? AccountId, string? AccountNumber, string? AccountName,
    decimal Debit, decimal Credit);

internal sealed record BuiltEntry(IReadOnlyList<BuiltLine> Lines, IReadOnlyList<string> Problems)
{
    public decimal TotalDebit  => Lines.Sum(l => l.Debit);
    public decimal TotalCredit => Lines.Sum(l => l.Credit);
    public bool    CanPost     => Problems.Count == 0 && Lines.Count > 0;
}

/// <summary>
/// Turns a collected document's amounts into journal lines. Pure — no database — so the rules
/// that decide what reaches the ledger can be tested without one.
/// </summary>
internal static class PostingLineBuilder
{
    /// <param name="amounts">Role → amount in the document's currency.</param>
    /// <param name="accounts">Role → the account it resolved to. A role with an amount and no
    /// entry here is reported, never dropped.</param>
    /// <param name="rate">Document currency → ledger currency.</param>
    public static BuiltEntry Build(
        IntegrationDefinition definition,
        IReadOnlyDictionary<string, decimal> amounts,
        IReadOnlyDictionary<string, ResolvedAccount> accounts,
        decimal rate)
    {
        var problems = new List<string>();
        var lines    = new List<BuiltLine>();

        foreach (var key in amounts.Keys)
            if (amounts[key] != 0 && definition.Roles.All(r => r.Role != key))
                problems.Add($"The document carries an amount for '{key}', which this integration has no posting rule for.");

        foreach (var role in definition.Roles)
        {
            if (!amounts.TryGetValue(role.Role, out var raw) || raw == 0)
                continue;

            // A negative amount means the opposite side, not a negative line: the ledger has no
            // such thing, and JournalEntryLine refuses one.
            var amount  = Math.Round(Math.Abs(raw) * rate, 2, MidpointRounding.AwayFromZero);
            var isDebit = raw > 0 ? role.IsDebit : !role.IsDebit;
            if (amount == 0)
                continue;

            accounts.TryGetValue(role.Role, out var account);
            if (account is null)
                problems.Add($"No ledger account is set for '{role.Label}' and the default account {role.DefaultAccountNumber} does not exist.");
            else if (!account.IsActive)
                problems.Add($"Account {account.Number} {account.Name} ('{role.Label}') is inactive.");

            lines.Add(new BuiltLine(role.Role, role.Label, account?.Id, account?.Number, account?.Name,
                isDebit ? amount : 0, isDebit ? 0 : amount));
        }

        if (lines.Count == 0)
        {
            problems.Add("The document has no amounts to post.");
            return new BuiltEntry(lines, problems);
        }

        // Each side is rounded on its own, so a converted document can be out by a cent or two.
        // The difference goes onto the largest line of the lighter side; anything bigger than
        // rounding can explain is a real imbalance and is reported instead of hidden.
        var difference = lines.Sum(l => l.Debit) - lines.Sum(l => l.Credit);
        if (difference != 0)
        {
            var tolerance = 0.01m * lines.Count;
            if (Math.Abs(difference) > tolerance)
            {
                problems.Add($"The entry does not balance: debits {lines.Sum(l => l.Debit):0.00}, credits {lines.Sum(l => l.Credit):0.00}.");
            }
            else
            {
                var fixDebit = difference < 0;
                var index = lines
                    .Select((l, i) => (l, i))
                    .Where(x => fixDebit ? x.l.Debit > 0 : x.l.Credit > 0)
                    .OrderByDescending(x => fixDebit ? x.l.Debit : x.l.Credit)
                    .Select(x => (int?)x.i)
                    .FirstOrDefault();

                if (index is null)
                    problems.Add("The entry has only one side.");
                else
                {
                    var l = lines[index.Value];
                    lines[index.Value] = fixDebit
                        ? l with { Debit  = l.Debit  + Math.Abs(difference) }
                        : l with { Credit = l.Credit + Math.Abs(difference) };
                }
            }
        }

        if (problems.Count == 0 && (lines.All(l => l.Debit == 0) || lines.All(l => l.Credit == 0)))
            problems.Add("The entry has only one side.");

        return new BuiltEntry(lines, problems);
    }
}
