namespace Softaxis.Finance.Application.UaeVat;

public sealed record UaeVatSubmissionRequest(
    Guid    ReturnId,
    string  Trn,
    string  PeriodLabel,
    string  Environment,
    string  IdempotencyKey,
    string  ContentHash,
    string  ReturnXml,
    string  AuditFileCsv);

/// <param name="Outcome">One of <c>VatAttemptOutcome</c>. Must reflect what the remote side actually said.</param>
/// <param name="Message">Already redacted; never contains credentials or tokens.</param>
public sealed record UaeVatSubmissionResult(string Outcome, int? HttpStatus, string? ExternalReference, string? Message);

/// <summary>
/// The single seam through which a VAT return could leave Vrodux for FTA.
///
/// <para>FTA's "Tax Accounting Software" requirements describe a direct upload into ITAS
/// ("Option 2") but state it "is not an immediate need" and publish no endpoint, schema,
/// authentication scheme or sandbox. So the registered implementation reports
/// <c>not_available</c> and transmits nothing. A real adapter — for an FTA API once published to
/// accredited vendors, or an authorised provider — replaces it without touching the handlers.</para>
/// </summary>
public interface IUaeVatSubmissionGateway
{
    /// <summary>Environment this gateway is pointed at: "sandbox" or "production".</summary>
    string Environment { get; }

    /// <summary>Whether a real, configured channel exists. False ⇒ <see cref="SubmitAsync"/> sends nothing.</summary>
    bool IsAvailable { get; }

    /// <summary>Human-readable reason when <see cref="IsAvailable"/> is false.</summary>
    string? UnavailableReason { get; }

    Task<UaeVatSubmissionResult> SubmitAsync(UaeVatSubmissionRequest request, CancellationToken ct);
}
