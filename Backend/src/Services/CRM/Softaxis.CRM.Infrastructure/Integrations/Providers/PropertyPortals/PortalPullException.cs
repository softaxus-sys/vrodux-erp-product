namespace Softaxis.CRM.Infrastructure.Integrations.Providers.PropertyPortals;

/// <summary>
/// The portal could not be pulled from at all — every slice of the sweep failed, or the
/// integration has no usable key.
///
/// <para><b>Why this type exists.</b> Both failures used to return an empty list, which the poller
/// reads as "nothing new since the last poll" and records as a SUCCESS. An integration whose key
/// had been revoked, or whose portal was returning 500s, therefore reported <c>healthy</c> for ever
/// while delivering no leads — indistinguishable from a quiet week. Throwing is what turns that into
/// a recorded failure, a visible error on the integration, and an alert.</para>
/// </summary>
public class PortalPullException(string message) : Exception(message);

/// <summary>
/// The integration is misconfigured rather than having a bad day — no API key stored, or one the
/// portal rejects. Retrying cannot fix it; a human has to re-enter the key, so the alert says so
/// instead of promising an automatic recovery that will never come.
/// </summary>
public class PortalPullConfigurationException(string message) : PortalPullException(message);
