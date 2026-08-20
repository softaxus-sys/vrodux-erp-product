namespace Softaxis.CRM.Application.Documents;

/// <summary>
/// Guards what may be attached to a CRM record.
///
/// <para>Deliberately a <b>blocklist of executable / script types</b> rather than an allowlist of
/// document types. This ERP also serves construction and real-estate tenants who legitimately
/// attach CAD drawings, archives and other long-tail formats, and an allowlist would reject them.
/// The real risk being defended against is a file that <i>executes</i> when a colleague downloads
/// it, so that is what is blocked.</para>
///
/// <para>Note this is not a substitute for virus scanning — it stops the obvious foot-gun, nothing
/// more. Files are served back with their stored content type via <c>File(...)</c>, which sets
/// Content-Disposition: attachment, so the browser saves rather than renders them.</para>
/// </summary>
public static class DocumentFileRules
{
    /// <summary>Extensions refused on upload. Lower-case, leading dot.</summary>
    private static readonly HashSet<string> BlockedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        // Windows executables / installers
        ".exe", ".dll", ".msi", ".msp", ".com", ".scr", ".cpl", ".jar", ".apk", ".app", ".dmg",
        // Scripts
        ".bat", ".cmd", ".ps1", ".psm1", ".vbs", ".vbe", ".js", ".jse", ".wsf", ".wsh", ".sh",
        ".hta", ".reg", ".lnk", ".pif", ".gadget", ".msc",
        // Office macro formats — the classic malware delivery vector
        ".docm", ".xlsm", ".pptm", ".dotm", ".xltm", ".potm", ".xlam", ".ppam",
    };

    public static bool IsBlocked(string fileName) =>
        BlockedExtensions.Contains(Path.GetExtension(fileName ?? string.Empty));

    /// <summary>Message shown when a file is refused. Names the extension so the user knows why.</summary>
    public static string BlockedMessage(string fileName)
    {
        var ext = Path.GetExtension(fileName ?? string.Empty);
        return string.IsNullOrEmpty(ext)
            ? "This file type cannot be attached."
            : $"“{ext}” files cannot be attached — executable and macro-enabled formats are blocked.";
    }
}
