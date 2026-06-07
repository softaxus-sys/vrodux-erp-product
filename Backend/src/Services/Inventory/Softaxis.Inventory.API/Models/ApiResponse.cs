namespace Softaxis.Inventory.API.Models;

public sealed record ApiResponse<T>(bool Success, T? Data, string? Error, string? ErrorCode)
{
    public static ApiResponse<T> Ok(T data)                          => new(true,  data,  null,      null);
    public static ApiResponse<T> Fail(string code, string message)  => new(false, default, message, code);
}

public sealed record ApiResponse(bool Success, string? Error, string? ErrorCode)
{
    public static ApiResponse Ok()                                   => new(true,  null,    null);
    public static ApiResponse Fail(string code, string message)     => new(false, message, code);
}
