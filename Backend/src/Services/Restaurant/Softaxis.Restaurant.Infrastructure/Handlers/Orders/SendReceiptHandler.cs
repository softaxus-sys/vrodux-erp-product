using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Abstractions;
using Softaxis.Restaurant.Application.Orders.Commands;
using Softaxis.Restaurant.Domain.Entities;
using Softaxis.Restaurant.Infrastructure.Persistence;
using System.Text;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Orders;

internal sealed class SendReceiptHandler(RestaurantDbContext db, IReceiptEmailService email, ISmsProvider sms, IWhatsAppProvider whatsApp)
    : ICommandHandler<SendReceiptCommand, SendReceiptResultDto>
{
    public async Task<Result<SendReceiptResultDto>> Handle(SendReceiptCommand cmd, CancellationToken ct)
    {
        var order = await db.Orders.Include(x => x.Items).Include(x => x.Payments)
            .FirstOrDefaultAsync(x => x.Id == cmd.OrderId && !x.IsDeleted, ct);
        if (order is null) return Result.Failure<SendReceiptResultDto>(Error.NotFoundById("Order", cmd.OrderId));

        bool success;
        string? error = null;
        if (cmd.Channel == "email")
        {
            success = await email.SendReceiptAsync(cmd.RecipientAddress, "Guest", order.OrderNumber, BuildReceiptHtml(order), ct);
            if (!success) error = "SMTP not configured or send failed.";
        }
        else if (cmd.Channel == "sms")
        {
            success = await sms.SendMessageAsync(cmd.RecipientAddress, BuildReceiptText(order), ct);
            if (!success) error = "SMS isn't configured for this tenant yet.";
        }
        else
        {
            success = await whatsApp.SendMessageAsync(cmd.RecipientAddress, BuildReceiptText(order), ct);
            if (!success) error = "WhatsApp isn't configured for this tenant yet.";
        }

        db.DigitalReceiptLogs.Add(new DigitalReceiptLog(order.Id, cmd.Channel, cmd.RecipientAddress, success, error));
        await db.SaveChangesAsync(ct);

        return Result.Success(new SendReceiptResultDto(success, cmd.Channel, cmd.RecipientAddress));
    }

    private static string BuildReceiptHtml(Order order)
    {
        var sb = new StringBuilder();
        sb.Append($"<html><body style=\"font-family:sans-serif;color:#1e293b\">");
        sb.Append($"<h2>Receipt — {order.OrderNumber}</h2>");
        sb.Append("<table style=\"width:100%;border-collapse:collapse\">");
        foreach (var item in order.Items.Where(i => !i.IsDeleted))
            sb.Append($"<tr><td>{item.Quantity}× {item.ItemName}</td><td style=\"text-align:right\">{item.LineTotal:0.00}</td></tr>");
        sb.Append($"<tr><td>Subtotal</td><td style=\"text-align:right\">{order.SubTotal:0.00}</td></tr>");
        if (order.DiscountAmount > 0) sb.Append($"<tr><td>Discount</td><td style=\"text-align:right\">-{order.DiscountAmount:0.00}</td></tr>");
        sb.Append($"<tr><td>Tax</td><td style=\"text-align:right\">{order.TaxAmount:0.00}</td></tr>");
        if (order.TipAmount > 0) sb.Append($"<tr><td>Tip</td><td style=\"text-align:right\">{order.TipAmount:0.00}</td></tr>");
        sb.Append($"<tr><td><strong>Total</strong></td><td style=\"text-align:right\"><strong>{(order.Total + order.TipAmount):0.00}</strong></td></tr>");
        sb.Append("</table>");
        sb.Append("<p style=\"color:#64748b;font-size:12px\">Thank you for dining with us!</p>");
        sb.Append("</body></html>");
        return sb.ToString();
    }

    private static string BuildReceiptText(Order order)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"Receipt — {order.OrderNumber}");
        foreach (var item in order.Items.Where(i => !i.IsDeleted))
            sb.AppendLine($"{item.Quantity}x {item.ItemName} — {item.LineTotal:0.00}");
        sb.AppendLine($"Total: {(order.Total + order.TipAmount):0.00}");
        sb.AppendLine("Thank you for dining with us!");
        return sb.ToString();
    }
}
