using Microsoft.Extensions.Logging;
using SkiaSharp;
using Softaxis.BuildingBlocks.Application.Storage;

namespace Softaxis.BuildingBlocks.Infrastructure.Storage;

public sealed class SkiaImageProcessor(ILogger<SkiaImageProcessor> logger) : IImageProcessor
{
    private static readonly HashSet<string> Compressible = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg", "image/jpg", "image/png", "image/bmp", "image/gif",
        // image/webp deliberately included: re-encoding at a controlled quality/size still helps
        // an unusually large source WebP (e.g. a lossless export), and Compress() already keeps
        // the original if the "compressed" result isn't actually smaller.
        "image/webp",
    };

    public bool IsCompressibleImage(string contentType) => Compressible.Contains(contentType.Trim());

    public (byte[] Data, string ContentType) Compress(
        byte[] data, string contentType, int maxDimension = 2000, int quality = 80)
    {
        if (!IsCompressibleImage(contentType)) return (data, contentType);

        try
        {
            using var original = SKBitmap.Decode(data);
            if (original is null) return (data, contentType); // not actually decodable — upload as-is

            var scale = Math.Min(1.0, (double)maxDimension / Math.Max(original.Width, original.Height));
            var targetWidth  = Math.Max(1, (int)Math.Round(original.Width  * scale));
            var targetHeight = Math.Max(1, (int)Math.Round(original.Height * scale));

            // Always re-encodes, even at scale 1.0 (no downscale needed) — converting an
            // already-right-sized JPEG/PNG to WebP is itself a real space saving.
            using var resized = original.Resize(
                new SKImageInfo(targetWidth, targetHeight),
                new SKSamplingOptions(SKFilterMode.Linear, SKMipmapMode.None));
            if (resized is null) return (data, contentType);

            using var image = SKImage.FromBitmap(resized);
            using var encoded = image.Encode(SKEncodedImageFormat.Webp, quality);
            var compressed = encoded?.ToArray();

            // Never swap in a "compressed" result that's actually bigger — rare, but possible for
            // an already-tiny or already-WebP source.
            return compressed is { Length: > 0 } && compressed.Length < data.Length
                ? (compressed, "image/webp")
                : (data, contentType);
        }
        catch (Exception ex)
        {
            // Never block an upload over a compression failure — the original bytes are always a
            // safe fallback, and a corrupt/unusual image file must still be storable.
            logger.LogWarning(ex, "Image compression failed, storing original bytes instead");
            return (data, contentType);
        }
    }
}
