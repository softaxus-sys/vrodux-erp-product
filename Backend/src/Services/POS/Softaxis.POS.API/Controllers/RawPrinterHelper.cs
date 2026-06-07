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

    /// <summary>Returns true if a printer with the given name can be opened.</summary>
    public static bool PrinterExists(string printerName)
    {
        if (string.IsNullOrWhiteSpace(printerName)) return false;
        if (!OpenPrinter(printerName, out var h, IntPtr.Zero)) return false;
        ClosePrinter(h);
        return true;
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
