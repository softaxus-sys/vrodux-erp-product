using System.Text.Json.Serialization;
using Softaxis.BuildingBlocks.Application.Serialization;
namespace Softaxis.POS.Application.DTOs;

public sealed record CurrencyDto(
    Guid    Id,
    string  Code,
    string  Name,
    string  Symbol,
    decimal ExchangeRate,
    bool    IsDefault,
    bool    IsActive,
    bool    IsSystem,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public sealed record TaxRateDto(
    Guid    Id,
    string  Name,
    string  Code,
    decimal Rate,
    string  AppliesTo,
    string? Description,
    bool    IsDefault,
    bool    IsActive,
    bool    IsSystem,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public sealed record PaymentTermDto(
    Guid    Id,
    string  Name,
    string  Code,
    int     DaysNet,
    decimal AdvancePercent,
    string? Description,
    bool    IsDefault,
    bool    IsSystem,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public sealed record CustomerGroupDto(
    Guid    Id,
    string  Name,
    string  Code,
    decimal DiscountPercent,
    decimal MinPurchase,
    string? Description,
    bool    IsDefault,
    bool    IsActive,
    bool    IsSystem,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public sealed record VoucherDto(
    Guid     Id,
    string   Code,
    string?  Description,
    int      ValueType,            // 1 = Percentage, 2 = FixedAmount
    decimal  Value,
    decimal  MinSpend,
    decimal? MaxDiscountAmount,
    // Calendar dates, not instants — a voucher is valid for a DAY. Opting out of the global
    // UTC converter keeps them from rendering a day early west of Greenwich.
    [property: JsonConverter(typeof(NullableCalendarDateJsonConverter))] DateTime? ValidFrom,
    [property: JsonConverter(typeof(NullableCalendarDateJsonConverter))] DateTime? ValidUntil,
    int?     UsageLimit,
    int      UsageCount,
    bool     IsActive,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

/// <summary>Result of a voucher validation/preview against a cart subtotal.</summary>
public sealed record VoucherValidationDto(
    bool        Valid,
    decimal     DiscountAmount,
    string?     Message,
    VoucherDto? Voucher);
