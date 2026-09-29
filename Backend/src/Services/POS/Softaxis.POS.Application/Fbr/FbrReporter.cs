using Microsoft.Extensions.Logging;
using Softaxis.POS.Application.Abstractions;
using Softaxis.POS.Domain.Entities;

namespace Softaxis.POS.Application.Fbr;

/// <summary>
/// Submits one sale to FBR and records the outcome on the transaction (caller saves).
/// Shared by the checkout (immediate attempt) and the background retry job, so both behave
/// identically. Never throws: a sale must never fail because FBR is unreachable.
/// </summary>
public sealed class FbrReporter(IFbrClient client, ISecretProtector protector, ILogger<FbrReporter> logger)
{
    public async Task SubmitAsync(POSTransaction txn, PosSettings settings, string? customerName, CancellationToken ct)
    {
        if (txn.FbrStatus is not ("pending")) return;

        if (!settings.FbrReady)
        {
            txn.MarkFbrAttemptFailed("FBR integration is not configured (POS ID / token missing).", permanent: false);
            return;
        }

        string? token;
        try { token = protector.Unprotect(settings.FbrTokenProtected); } catch { token = null; }
        if (string.IsNullOrEmpty(token))
        {
            txn.MarkFbrAttemptFailed("The stored FBR token cannot be read - re-enter it in Settings > FBR Integration.", permanent: false);
            return;
        }

        try
        {
            var invoice = FbrInvoiceBuilder.Build(txn, settings.FbrPosId!.Value, settings.FbrDefaultPctCode, customerName);
            var result  = await client.SubmitAsync(invoice, settings.FbrEnvironment, token, ct);

            if (result.Success && !string.IsNullOrWhiteSpace(result.InvoiceNumber))
                txn.MarkFbrSubmitted(result.InvoiceNumber!);
            else
                txn.MarkFbrAttemptFailed(result.Error ?? "FBR did not return an invoice number.", result.Permanent);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "FBR: submission of {Txn} failed", txn.TransactionNumber);
            txn.MarkFbrAttemptFailed(ex.Message, permanent: false);
        }
    }
}
