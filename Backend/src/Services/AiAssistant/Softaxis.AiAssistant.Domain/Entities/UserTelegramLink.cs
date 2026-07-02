namespace Softaxis.AiAssistant.Domain.Entities;

/// <summary>
/// Binds one Vrodux user to one Telegram chat, per tenant. Created (pending) when a user asks to
/// connect Telegram; completed when they send /start &lt;code&gt; to the tenant's bot. Tenant-isolated,
/// so a link only ever resolves within its own tenant.
/// </summary>
public sealed class UserTelegramLink
{
    private UserTelegramLink() { }

    public UserTelegramLink(Guid userId, string userName, string linkCode)
    {
        Id       = Guid.NewGuid();
        UserId   = userId;
        UserName = userName;
        LinkCode = linkCode;
        IsLinked = false;
    }

    public Guid    Id       { get; private set; }
    public Guid    UserId   { get; private set; }
    public string  UserName { get; private set; } = string.Empty;

    /// <summary>One-time code the user sends as "/start &lt;code&gt;" to the bot to complete linking.</summary>
    public string  LinkCode { get; private set; } = string.Empty;

    public long?   TelegramChatId    { get; private set; }
    public string? TelegramUsername  { get; private set; }
    public bool    IsLinked          { get; private set; }

    public DateTime  CreatedAt { get; private set; }
    public DateTime? LinkedAt  { get; private set; }

    /// <summary>Issue a fresh code (e.g. when the user re-connects before completing).</summary>
    public void ResetCode(string newCode)
    {
        LinkCode = newCode;
        IsLinked = false;
        TelegramChatId = null;
        TelegramUsername = null;
        LinkedAt = null;
    }

    public void CompleteLink(long chatId, string? telegramUsername)
    {
        TelegramChatId   = chatId;
        TelegramUsername = telegramUsername;
        IsLinked         = true;
        LinkedAt         = DateTime.UtcNow;
    }

    public void Unlink()
    {
        IsLinked = false;
        TelegramChatId = null;
        TelegramUsername = null;
        LinkedAt = null;
    }
}
