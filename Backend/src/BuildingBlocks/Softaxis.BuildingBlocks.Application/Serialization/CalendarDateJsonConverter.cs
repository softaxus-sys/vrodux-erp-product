using System.Text.Json;
using System.Text.Json.Serialization;

namespace Softaxis.BuildingBlocks.Application.Serialization;

/// <summary>
/// Opt-out marker for a <see cref="DateTime"/> that means a CALENDAR DATE, not an instant —
/// a batch expiry, a voucher validity window, a daily report's day.
///
/// <para>Apply it wherever the value is a day rather than a moment:
/// <c>[JsonConverter(typeof(NullableCalendarDateJsonConverter))] DateTime? ExpiryDate</c>.
/// A property-level converter wins over the globally-registered
/// <see cref="UtcDateTimeConverter"/>, which would otherwise stamp midnight-Unspecified as UTC and
/// make the date render one day EARLIER for every viewer in a negative UTC offset.</para>
///
/// <para>It writes the zone-less form the codebase already emits for these fields
/// (<c>"2026-08-23T00:00:00"</c>) rather than a bare <c>"2026-08-23"</c>. That is deliberate: JS
/// parses a date-ONLY string as UTC midnight but a date-TIME string without an offset as LOCAL
/// midnight — so the bare form would reintroduce the very off-by-one-day this guards against.
/// Keeping the existing shape also means these fields are byte-for-byte unchanged on the wire.</para>
/// </summary>
public sealed class CalendarDateJsonConverter : JsonConverter<DateTime>
{
    public override DateTime Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        => reader.GetDateTime();

    public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions options)
        // Unspecified serialises with no zone designator — exactly the pre-existing output.
        => writer.WriteStringValue(DateTime.SpecifyKind(value, DateTimeKind.Unspecified));
}

/// <summary>Nullable companion to <see cref="CalendarDateJsonConverter"/>.</summary>
public sealed class NullableCalendarDateJsonConverter : JsonConverter<DateTime?>
{
    public override DateTime? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        => reader.TokenType == JsonTokenType.Null ? null : reader.GetDateTime();

    public override void Write(Utf8JsonWriter writer, DateTime? value, JsonSerializerOptions options)
    {
        if (value is null) writer.WriteNullValue();
        else writer.WriteStringValue(DateTime.SpecifyKind(value.Value, DateTimeKind.Unspecified));
    }
}
