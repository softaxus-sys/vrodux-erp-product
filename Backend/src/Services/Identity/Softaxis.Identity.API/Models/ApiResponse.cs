namespace Softaxis.Identity.API.Models;

/// <summary>
/// Uniform API envelope — every response has the same shape.
/// </summary>
public sealed class ApiResponse<T>
{
    public bool    Success  { get; init; }
    public T?      Data     { get; init; }
    public string? Message  { get; init; }
    public string? ErrorCode { get; init; }
    public string? TraceId  { get; init; }

    public static ApiResponse<T> Ok(T data, string? message = null) =>
        new() { Success = true, Data = data, Message = message };

    public static ApiResponse<T> Fail(string errorCode, string message) =>
        new() { Success = false, ErrorCode = errorCode, Message = message };
}

public static class ApiResponse
{
    public static ApiResponse<object?> Ok(string? message = null) =>
        new() { Success = true, Message = message };

    public static ApiResponse<object?> Fail(string errorCode, string message) =>
        new() { Success = false, ErrorCode = errorCode, Message = message };
}
