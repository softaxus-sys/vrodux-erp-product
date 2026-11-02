using System.Globalization;
using System.Net;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MimeKit;
using Softaxis.BuildingBlocks.Infrastructure.Email;
using Softaxis.Ecommerce.Domain.Entities;

namespace Softaxis.Ecommerce.Infrastructure.Services.Shop;

internal interface IShopMailer
{
    /// <summary>False when nothing was sent (no mail account configured, or the send failed). Never throws.</summary>
    Task<bool> SendAsync(string toEmail, string toName, string subject, string html, CancellationToken ct = default);
}

/// <summary>Reads the shared "Email" config section — one mail account per deployment, same as every other service.</summary>
internal sealed class SmtpShopMailer(IConfiguration configuration, ILogger<SmtpShopMailer> log) : IShopMailer
{
    public async Task<bool> SendAsync(string toEmail, string toName, string subject, string html, CancellationToken ct = default)
    {
        var s = configuration.GetSection("Email");
        var host = s["SmtpHost"]; var user = s["SmtpUsername"];
        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(user))
        {
            log.LogWarning("SMTP not configured. Store email \"{Subject}\" would have gone to {To}.", subject, toEmail);
            return false;
        }

        var msg = new MimeMessage();
        msg.From.Add(new MailboxAddress(EmailSender.Name(s["FromName"]), EmailSender.Address(s["FromAddress"])));
        try { msg.To.Add(new MailboxAddress(toName, toEmail)); }
        catch (Exception ex) { log.LogWarning(ex, "Not sending to invalid address {To}.", toEmail); return false; }
        msg.Subject = subject;
        msg.Body = new BodyBuilder { HtmlBody = html }.ToMessageBody();

        try
        {
            var port = int.Parse(s["SmtpPort"] ?? "587", CultureInfo.InvariantCulture);
            using var client = new SmtpClient();
            await client.ConnectAsync(host, port, port == 465 ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls, ct);
            await client.AuthenticateAsync(user, s["SmtpPassword"] ?? "", ct);
            await client.SendAsync(msg, ct);
            await client.DisconnectAsync(true, ct);
            return true;
        }
        catch (Exception ex)
        {
            log.LogError(ex, "Failed to send store email \"{Subject}\" to {To}.", subject, toEmail);
            return false;
        }
    }
}

/// <summary>The store's own emails. Every interpolated value is HTML-encoded: names, addresses and notes are shopper input.</summary>
internal static class ShopEmails
{
    private static string E(string? s) => WebUtility.HtmlEncode(s ?? "");

    private static string Money(decimal amount, string currency) =>
        $"{currency.ToUpperInvariant()} {Services.Shop.Money.Round(amount, currency).ToString("N" + Services.Shop.Money.Decimals(currency), CultureInfo.InvariantCulture)}";

    private static string Wrap(Store store, string heading, string body) => $$"""
        <div style="font-family:Arial,Helvetica,sans-serif;background:#f4f4f5;padding:24px">
          <div style="max-width:600px;margin:auto;background:#ffffff;border-radius:8px;overflow:hidden">
            <div style="background:#111827;color:#ffffff;padding:18px 24px;font-size:18px;font-weight:bold">{{E(store.Name)}}</div>
            <div style="padding:24px;color:#111827;font-size:14px;line-height:1.5">
              <h2 style="margin:0 0 12px;font-size:18px">{{E(heading)}}</h2>
              {{body}}
            </div>
            <div style="padding:14px 24px;color:#6b7280;font-size:12px;border-top:1px solid #e5e7eb">{{E(store.ContactEmail)}} {{E(store.ContactPhone)}}</div>
          </div>
        </div>
        """;

    private static string LinesTable(StoreOrder o)
    {
        var rows = string.Concat(o.Lines.Select(l => $"""
            <tr>
              <td style="padding:6px 0;border-bottom:1px solid #e5e7eb">{E(l.Title)}{(string.IsNullOrWhiteSpace(l.VariantName) ? "" : $"<br><span style='color:#6b7280'>{E(l.VariantName)}</span>")} × {l.Quantity}</td>
              <td style="padding:6px 0;border-bottom:1px solid #e5e7eb;text-align:right">{E(Money(l.LineTotal, o.CurrencyCode))}</td>
            </tr>
            """));
        string Row(string label, decimal amount) =>
            $"<tr><td style='padding:3px 0;color:#6b7280'>{label}</td><td style='padding:3px 0;text-align:right'>{E(Money(amount, o.CurrencyCode))}</td></tr>";
        var totals = Row("Subtotal", o.Subtotal)
            + (o.DiscountTotal > 0 ? Row("Discount", -o.DiscountTotal) : "")
            + Row("Shipping", o.ShippingTotal)
            + (o.TaxTotal > 0 ? Row("Tax", o.TaxTotal) : "")
            + $"<tr><td style='padding:6px 0;font-weight:bold'>Total</td><td style='padding:6px 0;text-align:right;font-weight:bold'>{E(Money(o.Total, o.CurrencyCode))}</td></tr>";
        return $"<table style='width:100%;border-collapse:collapse'>{rows}</table><table style='width:100%;border-collapse:collapse;margin-top:8px'>{totals}</table>";
    }

    private static string Address(StoreOrder o) =>
        $"{E(o.ShipName)}<br>{E(o.ShipLine1)}<br>{(string.IsNullOrWhiteSpace(o.ShipLine2) ? "" : E(o.ShipLine2) + "<br>")}{E(o.ShipCity)} {E(o.ShipRegion)} {E(o.ShipPostal)}<br>{E(o.ShipCountry)}";

    public static (string Subject, string Html) Confirmation(Store store, StoreOrder o, string orderUrl, string? paymentInstructions)
    {
        var pay = o.PaymentMethod switch
        {
            PaymentMethods.Bank when !string.IsNullOrWhiteSpace(paymentInstructions) =>
                $"<p><b>How to pay</b><br>{E(paymentInstructions).Replace("\n", "<br>")}<br>Please quote order {E(o.Number)}.</p>",
            PaymentMethods.Cod => "<p>You will pay when your order is delivered.</p>",
            _ => "",
        };
        var body = $"<p>Thank you, {E(o.CustomerName)}. We have received your order {E(o.Number)}.</p>{LinesTable(o)}{pay}"
            + $"<p style='margin-top:16px'><b>Delivering to</b><br>{Address(o)}</p>"
            + $"<p><a href='{E(orderUrl)}' style='color:#2563eb'>View your order</a></p>";
        return ($"Order {o.Number} confirmed – {store.Name}", Wrap(store, $"Order {o.Number} confirmed", body));
    }

    public static (string Subject, string Html) Shipped(Store store, StoreOrder o, string orderUrl)
    {
        var track = string.IsNullOrWhiteSpace(o.TrackingNumber) ? "" :
            $"<p><b>Tracking</b><br>{E(o.TrackingCarrier)} {E(o.TrackingNumber)}" +
            (string.IsNullOrWhiteSpace(o.TrackingUrl) ? "" : $"<br><a href='{E(o.TrackingUrl)}' style='color:#2563eb'>Track your parcel</a>") + "</p>";
        var body = $"<p>Good news, {E(o.CustomerName)} — order {E(o.Number)} is on its way.</p>{track}<p><b>Delivering to</b><br>{Address(o)}</p>"
            + $"<p><a href='{E(orderUrl)}' style='color:#2563eb'>View your order</a></p>";
        return ($"Order {o.Number} has shipped – {store.Name}", Wrap(store, $"Order {o.Number} has shipped", body));
    }

    public static (string Subject, string Html) NewOrder(Store store, StoreOrder o, string adminUrl)
    {
        var body = $"<p>{E(o.CustomerName)} ({E(o.Email)}{(string.IsNullOrWhiteSpace(o.Phone) ? "" : ", " + E(o.Phone))}) placed order {E(o.Number)} — "
            + $"payment: {E(o.PaymentMethod)} ({E(o.PaymentStatus)}).</p>{LinesTable(o)}<p><b>Deliver to</b><br>{Address(o)}</p>"
            + (string.IsNullOrWhiteSpace(o.CustomerNote) ? "" : $"<p><b>Customer note</b><br>{E(o.CustomerNote)}</p>")
            + $"<p><a href='{E(adminUrl)}' style='color:#2563eb'>Open the order</a></p>";
        return ($"New order {o.Number} – {Money(o.Total, o.CurrencyCode)}", Wrap(store, $"New order {o.Number}", body));
    }

    public static (string Subject, string Html) PasswordReset(Store store, string link) =>
        ($"Reset your {store.Name} password",
         Wrap(store, "Reset your password",
            $"<p>Use the link below to choose a new password. It works once and expires in one hour.</p><p><a href='{E(link)}' style='color:#2563eb'>Choose a new password</a></p>"
            + "<p style='color:#6b7280'>If you did not ask for this, you can ignore this email.</p>"));

    public static (string Subject, string Html) Welcome(Store store, string name, string shopUrl) =>
        ($"Welcome to {store.Name}",
         Wrap(store, "Your account is ready", $"<p>Hi {E(name)}, thanks for creating an account.</p><p><a href='{E(shopUrl)}' style='color:#2563eb'>Start shopping</a></p>"));
}
