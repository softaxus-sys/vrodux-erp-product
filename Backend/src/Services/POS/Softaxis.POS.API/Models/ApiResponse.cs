namespace Softaxis.POS.API.Models;

public sealed record ApiResponse<T>(
    bool    Success,
    T?      Data,
    string? Message,
    string? ErrorCode,
    string  TraceId)
{
    public static ApiResponse<T> Ok(T data, string? message = null) =>
        new(true, data, message, null, System.Diagnostics.Activity.Current?.Id ?? Guid.NewGuid().ToString());

    public static ApiResponse<T> Fail(string message, string? errorCode = null) =>
        new(false, default, message, errorCode, System.Diagnostics.Activity.Current?.Id ?? Guid.NewGuid().ToString());
}
