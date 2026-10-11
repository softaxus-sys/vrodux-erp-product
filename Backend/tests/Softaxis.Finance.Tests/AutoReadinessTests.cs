using Softaxis.Finance.Infrastructure.Handlers.Integrations;
using Softaxis.Finance.Infrastructure.Integrations;

namespace Softaxis.Finance.Tests;

public class AutoReadinessTests
{
    private static readonly IntegrationDefinition Definition =
        IntegrationCatalogue.All.First(d => d.Kind == IntegrationKind.Queue);

    private static Dictionary<string, ResolvedAccount> AllResolved(bool active = true) =>
        Definition.Roles.ToDictionary(
            r => r.Role,
            r => new ResolvedAccount(Guid.NewGuid(), r.DefaultAccountNumber, r.Label, active));

    [Fact]
    public void No_blockers_when_every_role_has_an_active_account()
    {
        Assert.Empty(AutoReadiness.Blockers(Definition, AllResolved()));
    }

    [Fact]
    public void A_role_with_no_account_blocks_and_is_named()
    {
        var accounts = AllResolved();
        var missing  = Definition.Roles[0];
        accounts.Remove(missing.Role);

        var blockers = AutoReadiness.Blockers(Definition, accounts);

        var only = Assert.Single(blockers);
        Assert.Contains(missing.Label, only);
    }

    [Fact]
    public void An_inactive_account_blocks()
    {
        var accounts = AllResolved();
        var role     = Definition.Roles[^1];
        accounts[role.Role] = accounts[role.Role] with { IsActive = false };

        var only = Assert.Single(AutoReadiness.Blockers(Definition, accounts));
        Assert.Contains("inactive", only);
        Assert.Contains(role.Label, only);
    }

    [Fact]
    public void Every_unusable_role_is_reported_not_just_the_first()
    {
        var blockers = AutoReadiness.Blockers(Definition, new Dictionary<string, ResolvedAccount>());
        Assert.Equal(Definition.Roles.Count, blockers.Count);
    }

    [Fact]
    public void Every_queue_integration_can_be_ready()
    {
        // Guards against a definition whose roles could never all resolve (e.g. a duplicate role key).
        foreach (var def in IntegrationCatalogue.All.Where(d => d.Kind == IntegrationKind.Queue))
        {
            var accounts = def.Roles.ToDictionary(
                r => r.Role, r => new ResolvedAccount(Guid.NewGuid(), r.DefaultAccountNumber, r.Label, true));
            Assert.Empty(AutoReadiness.Blockers(def, accounts));
        }
    }
}
