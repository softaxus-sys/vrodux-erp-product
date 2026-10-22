namespace Softaxis.Messaging.Application.Abstractions;

/// <summary>The signed-in user, read from the request's token.</summary>
public interface ICurrentUser
{
    Guid?   Id           { get; }
    string? Name         { get; }
    bool    IsSuperAdmin { get; }
    bool    HasPermission(string permissionKey);
}

/// <summary>Encrypts the stored Meta access token.</summary>
public interface IMessagingSecretProtector
{
    string Protect(string plain);
    string? Unprotect(string cipher);
}

/// <summary>Meta WhatsApp Cloud API, as this module uses it.</summary>
public interface IWhatsAppClient
{
    Task<WaCallResult<WaPhoneProfile>> GetPhoneProfileAsync(string phoneNumberId, string token, CancellationToken ct);
    Task<WaCallResult<IReadOnlyList<WaRemoteTemplate>>> GetTemplatesAsync(string wabaId, string token, CancellationToken ct);
    Task<WaCallResult<string>> CreateTemplateAsync(string wabaId, string token, WaNewTemplate template, CancellationToken ct);
    Task<WaCallResult<string>> SendTextAsync(string phoneNumberId, string token, string to, string text, CancellationToken ct);
    Task<WaCallResult<string>> SendTemplateAsync(string phoneNumberId, string token, string to, string name,
        string language, IReadOnlyList<string> variables, CancellationToken ct);
    Task MarkReadAsync(string phoneNumberId, string token, string waMessageId, CancellationToken ct);
}

/// <summary>Either a value or Meta's error message. Never throws for an API refusal.</summary>
public sealed record WaCallResult<T>(T? Value, string? Error)
{
    public bool Ok => Error is null;
    public static WaCallResult<T> Success(T value) => new(value, null);
    public static WaCallResult<T> Fail(string error) => new(default, error);
}

public sealed record WaPhoneProfile(string? DisplayPhone, string? VerifiedName);

public sealed record WaRemoteTemplate(
    string Id, string Name, string Language, string Category, string Status,
    string? Header, string Body, string? Footer, string? RejectedReason);

public sealed record WaNewTemplate(string Name, string Language, string Category, string? Header, string Body,
    string? Footer, IReadOnlyList<string> BodyExamples);
