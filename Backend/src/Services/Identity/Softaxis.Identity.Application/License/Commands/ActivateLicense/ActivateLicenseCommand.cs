using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Identity.Application.License.Dtos;

namespace Softaxis.Identity.Application.License.Commands.ActivateLicense;

/// <summary>
/// Installs a license key into a running on-premises installation.
///
/// <para>
/// Before this existed, the only way a key reached a box was <c>OnPremises:LicenseKey</c> in
/// appsettings.json, read once at startup. So renewing a 30-day trial meant someone editing JSON
/// on the customer's production server and restarting the service — an engineer visit or a remote
/// session, on the day the customer is paying us, with downtime.
/// </para>
///
/// <para>
/// Worse, once the license lapses <c>SubscriptionEnforcementMiddleware</c> blocks every request,
/// so nobody on site can even sign in to fix it. That is why <c>/api/license/</c> is on the
/// middleware's bypass list, for the same reason <c>/api/billing/</c> is: a tenant must never be
/// locked out of the endpoint that unlocks it.
/// </para>
///
/// <para>
/// <b>Authorisation is the key itself.</b> The endpoint is anonymous, because an expired
/// installation has no one who can log in to authorise anything. That is safe because the key is
/// RSA-signed by us and carries the tenant id: possessing one for this installation is proof it
/// came from us, and a key for any other tenant is refused. Same model as the heartbeat endpoint.
/// </para>
/// </summary>
public sealed record ActivateLicenseCommand(string LicenseKey) : ICommand<LicenseActivationDto>;
