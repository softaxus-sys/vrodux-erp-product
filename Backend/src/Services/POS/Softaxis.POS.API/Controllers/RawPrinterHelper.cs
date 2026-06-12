using System.Linq;
using System.Runtime.InteropServices;

namespace Softaxis.POS.API.Controllers;

/// <summary>
/// Sends raw bytes (ESC/POS) directly to a locally-installed Windows printer via
/// the print spooler (RAW datatype) — bypassing the driver's rendering. Works for
/// USB / COM / LPT thermal receipt printers installed on the same machine as the API.
/// Windows-only (uses winspool.drv).
/// </summary>
public static class RawPrinterHelper
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private class DOCINFOW
    {
        [MarshalAs(UnmanagedType.LPWStr)] public string pDocName = "POS Receipt";
        [MarshalAs(UnmanagedType.LPWStr)] public string? pOutputFile = null;
        [MarshalAs(UnmanagedType.LPWStr)] public string pDataType = "RAW";
    }

    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    private static extern bool OpenPrinter(string src, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    private static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterW", SetLastError = true, CharSet = CharSet.Unicode, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    private static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOW di);

    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    private static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    private static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    private static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    private static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    [DllImport("winspool.Drv", EntryPoint = "EnumPrintersW", SetLastError = true, CharSet = CharSet.Unicode, CallingConvention = CallingConvention.StdCall)]
    private static extern bool EnumPrinters(int flags, string? name, int level, IntPtr pPrinterEnum, int cbBuf, out int pcbNeeded, out int pcReturned);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct PRINTER_INFO_4
    {
        public IntPtr pPrinterName;
        public IntPtr pServerName;
        public uint Attributes;
    }

    private const int PRINTER_ENUM_LOCAL = 2;

    /// <summary>Returns true if a printer with the given name can be opened.</summary>
    public static bool PrinterExists(string printerName)
    {
        if (string.IsNullOrWhiteSpace(printerName)) return false;
        if (!OpenPrinter(printerName, out var h, IntPtr.Zero)) return false;
        ClosePrinter(h);
        return true;
    }

    /// <summary>Returns the names of all printers installed locally on this machine (USB/COM/LPT/virtual).</summary>
    public static List<string> GetLocalPrinterNames()
    {
        EnumPrinters(PRINTER_ENUM_LOCAL, null, 4, IntPtr.Zero, 0, out var needed, out _);
        if (needed <= 0) return new List<string>();

        var buffer = Marshal.AllocHGlobal(needed);
        try
        {
            if (!EnumPrinters(PRINTER_ENUM_LOCAL, null, 4, buffer, needed, out _, out var returned))
                return new List<string>();

            var names = new List<string>();
            var structSize = Marshal.SizeOf<PRINTER_INFO_4>();
            for (var i = 0; i < returned; i++)
            {
                var info = Marshal.PtrToStructure<PRINTER_INFO_4>(buffer + i * structSize);
                var name = Marshal.PtrToStringUni(info.pPrinterName);
                if (!string.IsNullOrWhiteSpace(name)) names.Add(name);
            }
            return names;
        }
        finally
        {
            Marshal.FreeHGlobal(buffer);
        }
    }

    /// <summary>
    /// Picks the best printer to use: the configured name if it's actually installed,
    /// otherwise the first locally-connected printer that looks like a receipt/thermal
    /// printer, otherwise the first non-virtual local printer, otherwise null.
    /// </summary>
    public static string? AutoDetectPrinterName(string? configuredName)
    {
        var names = GetLocalPrinterNames();
        if (names.Count == 0) return null;

        if (!string.IsNullOrWhiteSpace(configuredName)
            && names.Any(n => string.Equals(n, configuredName, StringComparison.OrdinalIgnoreCase)))
        {
            return configuredName;
        }

        var virtualKeywords = new[] { "Microsoft", "OneNote", "Fax", "PDF", "XPS", "OneDrive", "Send To" };
        var real = names.Where(n => !virtualKeywords.Any(k => n.Contains(k, StringComparison.OrdinalIgnoreCase))).ToList();

        var receiptKeywords = new[] { "POS", "Receipt", "Thermal", "TM-", "TM ", "XP-", "EPSON", "Star", "Bixolon", "Citizen" };
        var preferred = real.FirstOrDefault(n => receiptKeywords.Any(k => n.Contains(k, StringComparison.OrdinalIgnoreCase)));
        if (preferred != null) return preferred;

        return real.FirstOrDefault() ?? names.First();
    }

    /// <summary>
    /// Send raw bytes to the named printer. Throws on failure with the Win32 error.
    /// </summary>
    public static void SendBytes(string printerName, byte[] bytes)
    {
        if (string.IsNullOrWhiteSpace(printerName))
            throw new InvalidOperationException("No Windows printer name configured.");

        if (!OpenPrinter(printerName, out var hPrinter, IntPtr.Zero))
            throw new InvalidOperationException($"Cannot open printer '{printerName}' (Win32 error {Marshal.GetLastWin32Error()}).");

        var unmanaged = Marshal.AllocCoTaskMem(bytes.Length);
        try
        {
            Marshal.Copy(bytes, 0, unmanaged, bytes.Length);

            if (!StartDocPrinter(hPrinter, 1, new DOCINFOW()))
                throw new InvalidOperationException($"StartDocPrinter failed (Win32 error {Marshal.GetLastWin32Error()}).");
            try
            {
                if (!StartPagePrinter(hPrinter))
                    throw new InvalidOperationException($"StartPagePrinter failed (Win32 error {Marshal.GetLastWin32Error()}).");
                try
                {
                    if (!WritePrinter(hPrinter, unmanaged, bytes.Length, out var written) || written != bytes.Length)
                        throw new InvalidOperationException($"WritePrinter wrote {written}/{bytes.Length} bytes (Win32 error {Marshal.GetLastWin32Error()}).");
                }
                finally { EndPagePrinter(hPrinter); }
            }
            finally { EndDocPrinter(hPrinter); }
        }
        finally
        {
            Marshal.FreeCoTaskMem(unmanaged);
            ClosePrinter(hPrinter);
        }
    }
}
