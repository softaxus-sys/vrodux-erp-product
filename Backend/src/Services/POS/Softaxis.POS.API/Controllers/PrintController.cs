using System.Net.Sockets;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace Softaxis.POS.API.Controllers;

/// <summary>
/// Sends raw ESC/POS bytes to a receipt printer. Two modes:
///   • "windows" — a printer installed on the API host (USB/COM/LPT) via the
///     Windows spooler (RAW). Use when the printer is installed on this machine.
///   • "network" — a printer reachable over TCP (port 9100).
///
/// The browser sends the ESC/POS payload here; the server forwards it. Configure
/// in appsettings.json under "PrinterSettings".
/// </summary>
[ApiController]
[Route("api/pos/print")]
[Authorize]
public sealed class PrintController(IOptions<PrinterSettings> opts) : ControllerBase
{
    private readonly PrinterSettings _cfg = opts.Value;

    private bool UseWindows =>
        string.Equals(_cfg.Mode, "windows", StringComparison.OrdinalIgnoreCase)
        || (string.IsNullOrWhiteSpace(_cfg.Mode) && !string.IsNullOrWhiteSpace(_cfg.WindowsPrinterName));

    // ── POST /api/pos/print/raw ───────────────────────────────────────────────
    [HttpPost("raw")]
    public async Task<IActionResult> PrintRaw([FromBody] PrintRawRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Data))
            return BadRequest(new { success = false, message = "No print data provided." });

        byte[] bytes;
        try   { bytes = Convert.FromBase64String(req.Data); }
        catch { return BadRequest(new { success = false, message = "Invalid base64 data." }); }

        // ── Windows local printer ──────────────────────────────────────────────
        if (UseWindows)
        {
            if (string.IsNullOrWhiteSpace(_cfg.WindowsPrinterName))
                return StatusCode(503, new { success = false, message = "No Windows printer configured. Set PrinterSettings:WindowsPrinterName." });
            try
            {
                RawPrinterHelper.SendBytes(_cfg.WindowsPrinterName, bytes);
                return Ok(new { success = true, message = $"Sent {bytes.Length} bytes to '{_cfg.WindowsPrinterName}'." });
            }
            catch (Exception ex)
            {
                return StatusCode(503, new { success = false, message = ex.Message });
            }
        }

        // ── Network printer (TCP 9100) ─────────────────────────────────────────
        if (string.IsNullOrWhiteSpace(_cfg.IpAddress))
            return StatusCode(503, new { success = false, message = "Printer not configured. Set PrinterSettings:WindowsPrinterName or :IpAddress." });
        try
        {
            using var client = new TcpClient { SendTimeout = _cfg.TimeoutMs, ReceiveTimeout = _cfg.TimeoutMs };
            await client.ConnectAsync(_cfg.IpAddress, _cfg.Port, ct);
            await using var stream = client.GetStream();
            await stream.WriteAsync(bytes, ct);
            await stream.FlushAsync(ct);
            return Ok(new { success = true, message = $"Sent {bytes.Length} bytes to {_cfg.IpAddress}:{_cfg.Port}." });
        }
        catch (Exception ex)
        {
            return StatusCode(503, new { success = false, message = $"Cannot reach printer at {_cfg.IpAddress}:{_cfg.Port} — {ex.Message}" });
        }
    }

    // ── GET /api/pos/print/status ─────────────────────────────────────────────
    [HttpGet("status")]
    public async Task<IActionResult> GetStatus(CancellationToken ct)
    {
        if (UseWindows)
        {
            var name = _cfg.WindowsPrinterName ?? "";
            var ok = OperatingSystem.IsWindows() && RawPrinterHelper.PrinterExists(name);
            return Ok(new
            {
                reachable = ok,
                mode      = "windows",
                printer   = name,
                ip        = "",
                port      = 0,
                message   = ok ? (string?)null : $"Windows printer '{name}' not found. Check the exact name in Control Panel → Devices and Printers.",
            });
        }

        if (string.IsNullOrWhiteSpace(_cfg.IpAddress))
            return Ok(new { reachable = false, mode = "network", printer = "", ip = "", port = 0, message = "Printer not configured." });

        try
        {
            using var client = new TcpClient();
            using var linked = CancellationTokenSource.CreateLinkedTokenSource(ct);
            linked.CancelAfter(_cfg.TimeoutMs);
            await client.ConnectAsync(_cfg.IpAddress, _cfg.Port, linked.Token);
            return Ok(new { reachable = true, mode = "network", printer = "", ip = _cfg.IpAddress, port = _cfg.Port, message = (string?)null });
        }
        catch (Exception ex)
        {
            return Ok(new { reachable = false, mode = "network", printer = "", ip = _cfg.IpAddress, port = _cfg.Port, message = $"{_cfg.IpAddress}:{_cfg.Port} — {ex.Message}" });
        }
    }
}

public sealed record PrintRawRequest(string Data);

public sealed class PrinterSettings
{
    /// <summary>"windows" or "network". If empty, inferred from which fields are set.</summary>
    public string  Mode               { get; set; } = "";
    /// <summary>Name of the locally-installed Windows printer (for "windows" mode).</summary>
    public string  WindowsPrinterName { get; set; } = "";
    /// <summary>Network printer IP (for "network" mode).</summary>
    public string  IpAddress          { get; set; } = "";
    public int     Port               { get; set; } = 9100;
    public int     TimeoutMs          { get; set; } = 3000;
}
