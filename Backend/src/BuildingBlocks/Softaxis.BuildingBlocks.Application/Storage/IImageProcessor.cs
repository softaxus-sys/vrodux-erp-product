namespace Softaxis.BuildingBlocks.Application.Storage;

/// <summary>
/// Server-side resize + re-encode, applied before a photo/scan ever reaches object storage.
/// A phone-camera receipt or passport photo routinely arrives at 3000px+ and several MB; nobody
/// needs that resolution for a business record, and re-encoding to WebP at this size typically
/// cuts storage 50-70% with no visible quality loss. Registered once in the gateway (see
/// ImageProcessorServiceCollectionExtensions), same shape as IObjectStorage.
///
/// <para><b>Deliberately NOT applied to documents</b> (PDFs, plain text) — those are usually
/// already internally compressed, so re-compressing them server-side saves little and risks
/// corrupting a legally-relevant document for no real benefit. Callers decide per content-type
/// whether to call this at all; see CompressIfImage for the common "do it only if it's a photo"
/// case every upload handler actually wants.</para>
/// </summary>
public interface IImageProcessor
{
    /// <summary>True for content types this can actually re-encode (jpeg/png/webp/etc — not
    /// pdf/text/svg). Callers check this before deciding whether to compress at all.</summary>
    bool IsCompressibleImage(string contentType);

    /// <summary>
    /// Resizes (longest side capped at <paramref name="maxDimension"/>, aspect preserved, never
    /// upscales) and re-encodes to WebP at <paramref name="quality"/>. Returns the ORIGINAL bytes
    /// and content type unchanged if decoding fails (a corrupt/unusual file must still upload, not
    /// be silently dropped) or if the compressed result would end up LARGER than the original
    /// (rare, but possible for an already-tiny or already-WebP source).
    /// </summary>
    (byte[] Data, string ContentType) Compress(byte[] data, string contentType, int maxDimension = 2000, int quality = 80);
}
