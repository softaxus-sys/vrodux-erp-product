using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Softaxis.BuildingBlocks.Application.Storage;

namespace Softaxis.BuildingBlocks.Infrastructure.Storage;

/// <summary>
/// S3-compatible implementation — works against Contabo Object Storage (and any other S3-API
/// provider) via the plain AWS SDK pointed at a custom ServiceURL with path-style addressing,
/// which is the standard way to use that SDK against a non-AWS S3-compatible endpoint.
///
/// A fresh AmazonS3Client is built per call rather than held as a long-lived singleton field —
/// simpler, and consistent with how this codebase's other hand-rolled external clients (e.g.
/// QasroClient) build a fresh HttpClient per call rather than caching one. Object storage calls are
/// not latency-sensitive enough here to need connection-pooling tuning.
/// </summary>
public sealed class S3ObjectStorage(IOptions<ObjectStorageOptions> options, ILogger<S3ObjectStorage> logger)
    : IObjectStorage
{
    private readonly ObjectStorageOptions _o = options.Value;

    public bool IsConfigured => _o.IsConfigured;

    public async Task PutAsync(string key, byte[] data, string contentType, CancellationToken ct = default)
    {
        if (!IsConfigured)
            throw new InvalidOperationException(
                "Object storage is not configured (Storage:Endpoint/Bucket/AccessKey/SecretKey). " +
                "The caller must fall back to its own storage, not call PutAsync, until this is set.");

        using var client = BuildClient();
        using var stream = new MemoryStream(data);
        await client.PutObjectAsync(new PutObjectRequest
        {
            BucketName  = _o.Bucket,
            Key         = key,
            InputStream = stream,
            ContentType = contentType,
            AutoCloseStream = false,
        }, ct);
    }

    public async Task<ObjectStorageFile?> GetAsync(string key, CancellationToken ct = default)
    {
        if (!IsConfigured) return null;

        try
        {
            using var client = BuildClient();
            using var resp = await client.GetObjectAsync(_o.Bucket, key, ct);
            using var ms = new MemoryStream();
            await resp.ResponseStream.CopyToAsync(ms, ct);
            return new ObjectStorageFile(ms.ToArray(), resp.Headers.ContentType ?? "application/octet-stream");
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }
        catch (Exception ex)
        {
            // Swallowed deliberately — see IObjectStorage's remarks. A caller with a legacy
            // DB-stored fallback must still be able to serve the file from there.
            logger.LogWarning(ex, "Object storage GET failed for key {Key}", key);
            return null;
        }
    }

    public async Task DeleteAsync(string key, CancellationToken ct = default)
    {
        if (!IsConfigured) return;

        try
        {
            using var client = BuildClient();
            await client.DeleteObjectAsync(_o.Bucket, key, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Object storage DELETE failed for key {Key}", key);
        }
    }

    private AmazonS3Client BuildClient() => new(_o.AccessKey, _o.SecretKey, new AmazonS3Config
    {
        ServiceURL     = _o.Endpoint,
        ForcePathStyle = true, // Contabo (and most non-AWS S3-compatible providers) need this.
        // The SDK's SigV4 signing needs SOME region string, or every call fails signature
        // validation server-side — confirmed against real Contabo setup guides, which all set
        // this explicitly. Contabo's endpoints are consistently "{region}.contabostorage.com"
        // (eu2/usc1/sin1/...), so it's derived from the endpoint rather than a separate config
        // field nobody would remember to set.
        AuthenticationRegion = RegionFromEndpoint(_o.Endpoint),
    });

    private static string RegionFromEndpoint(string endpoint)
    {
        try { return new Uri(endpoint).Host.Split('.')[0]; }
        catch (UriFormatException) { return "us-east-1"; } // never block on a malformed endpoint string
    }
}
