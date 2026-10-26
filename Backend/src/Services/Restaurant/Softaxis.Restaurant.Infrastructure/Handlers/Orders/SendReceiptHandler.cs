using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Abstractions;
using Softaxis.Restaurant.Application.Orders.Commands;
using Softaxis.Restaurant.Domain.Entities;
using Softaxis.Restaurant.Infrastructure.Persistence;
using Softaxis.BuildingBlocks.Infrastructure.Email;
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
        var lines = new List<EmailDetail>();
        foreach (var item in order.Items.Where(i => !i.IsDeleted))
            lines.Add(new EmailDetail($"{item.Quantity}× {item.ItemName}", item.LineTotal.ToString("0.00")));
        lines.Add(new EmailDetail("Subtotal", order.SubTotal.ToString("0.00")));
        if (order.DiscountAmount > 0) lines.Add(new EmailDetail("Discount", "-" + order.DiscountAmount.ToString("0.00")));
        lines.Add(new EmailDetail("Tax", order.TaxAmount.ToString("0.00")));
        if (order.TipAmount > 0) lines.Add(new EmailDetail("Tip", order.TipAmount.ToString("0.00")));
        lines.Add(new EmailDetail("Total", (order.Total + order.TipAmount).ToString("0.00")));

        return BrandedEmail.Render(
            title: $"Your receipt — {order.OrderNumber}",
            preheader: $"Total {(order.Total + order.TipAmount):0.00}. Thank you for dining with us.",
            bodyHtml: BrandedEmail.P("Thank you for dining with us. Here is a copy of your receipt."),
            details: lines,
            tone: EmailTone.Success,
            footerNote: "This is a copy of your receipt for your records.");
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
