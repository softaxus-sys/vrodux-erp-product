namespace Softaxis.HR.Application.EmployeeDocuments;

/// <summary>
/// Guards what may be attached to an employee. Mirrors the CRM rule set deliberately — a
/// blocklist of executable / script / macro formats rather than an allowlist, since HR
/// attachments are long-tail (scans, PDFs, images, archives from other systems).
///
/// <para>Not a substitute for virus scanning; it stops the obvious foot-gun. Files are served
/// back with Content-Disposition: attachment so a browser saves rather than renders them.</para>
/// </summary>
public static class DocumentFileRules
{
    private static readonly HashSet<string> BlockedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".exe", ".dll", ".msi", ".msp", ".com", ".scr", ".cpl", ".jar", ".apk", ".app", ".dmg",
        ".bat", ".cmd", ".ps1", ".psm1", ".vbs", ".vbe", ".js", ".jse", ".wsf", ".wsh", ".sh",
        ".hta", ".reg", ".lnk", ".pif", ".gadget", ".msc",
        ".docm", ".xlsm", ".pptm", ".dotm", ".xltm", ".potm", ".xlam", ".ppam",
    };

    public static bool IsBlocked(string fileName) =>
        BlockedExtensions.Contains(Path.GetExtension(fileName ?? string.Empty));

    public static string BlockedMessage(string fileName)
    {
        var ext = Path.GetExtension(fileName ?? string.Empty);
        return string.IsNullOrEmpty(ext)
            ? "This file type cannot be attached."
            : $"“{ext}” files cannot be attached — executable and macro-enabled formats are blocked.";
    }
}
