using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Softaxis.BuildingBlocks.Application.Serialization;

/// <summary>
/// Serialises every <see cref="DateTime"/> as an explicit UTC instant (trailing "Z").
///
/// <para><b>The bug this exists to fix.</b> Timestamps are written as <c>DateTime.UtcNow</c>, but
/// SQL Server <c>datetime2</c> stores no offset, so EF materialises them as
/// <see cref="DateTimeKind.Unspecified"/>. System.Text.Json then writes an Unspecified value with
/// NO zone designator — <c>"2026-08-23T10:15:00"</c>. Per the ECMAScript spec a date-TIME string
/// without an offset is parsed as <b>local</b> time, so <c>new Date(...)</c> in the browser shifted
/// every timestamp in the product by the viewer's UTC offset: 4 hours out in Dubai, 5 in
/// Karachi. Activity-log entries, "x minutes ago" feeds and audit trails were all affected.</para>
///
/// <para><b>Unspecified is treated as UTC</b> — for this codebase that is a fact, not a guess:
/// every persisted instant originates from <c>DateTime.UtcNow</c>, and the Kind is lost purely in
/// the database round-trip.</para>
///
/// <para><b>Date-only fields must opt out</b> with <see cref="CalendarDateJsonConverter"/>. A
/// calendar date (batch expiry, voucher validity) is midnight-Unspecified and means a day, not an
/// instant; stamping it UTC makes it render as the PREVIOUS day for any viewer west of Greenwich.
/// A property-level <c>[JsonConverter]</c> takes precedence over this globally-registered one.</para>
///
/// <para>Reading is deliberately left at the framework default so request binding is completely
/// unchanged — the defect was only ever on the write side.</para>
/// </summary>
public sealed class UtcDateTimeConverter : JsonConverter<DateTime>
{
    // Round-trippable, fixed-width, always UTC. Matches what STJ emits for a Kind=Utc value.
    private const string Format = "yyyy-MM-dd'T'HH:mm:ss.fffffff'Z'";

    public override DateTime Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        => reader.GetDateTime();

    public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions options)
    {
        var utc = value.Kind switch
        {
            DateTimeKind.Utc   => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            // Unspecified: came back from the database, where it was stored as UTC.
            _                  => DateTime.SpecifyKind(value, DateTimeKind.Utc),
        };

        writer.WriteStringValue(utc.ToString(Format, CultureInfo.InvariantCulture));
    }
}

/// <summary>Nullable companion to <see cref="UtcDateTimeConverter"/>.</summary>
public sealed class NullableUtcDateTimeConverter : JsonConverter<DateTime?>
{
    private static readonly UtcDateTimeConverter Inner = new();

    public override DateTime? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        => reader.TokenType == JsonTokenType.Null ? null : reader.GetDateTime();

    public override void Write(Utf8JsonWriter writer, DateTime? value, JsonSerializerOptions options)
    {
        if (value is null) writer.WriteNullValue();
        else               Inner.Write(writer, value.Value, options);
    }
}
