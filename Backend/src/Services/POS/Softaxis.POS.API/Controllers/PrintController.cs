using Softaxis.POS.API.Authorization;
using System.Net.Sockets;
using System.Text;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Softaxis.POS.Application.Settings;

namespace Softaxis.POS.API.Controllers;

/// <summary>
/// Sends raw ESC/POS bytes to a receipt printer. Two modes:
///   • "windows" — a printer installed on the API host (USB/COM/LPT) via the
///     Windows spooler (RAW). Use when the printer is installed on this machine.
///   • "network" — a printer reachable over TCP (port 9100).
///
/// Which printer: Settings -> Receipt Printer (stored per store in pos_settings). When nothing has
/// been saved there, appsettings.json "PrinterSettings" applies, then auto-detection - so an
/// install that already prints keeps printing until someone makes a choice.
/// </summary>
[ApiController]
[Route("api/pos/print")]
[Authorize]
public sealed class PrintController(IOptions<PrinterSettings> opts, ISender sender) : ControllerBase
{
    private readonly PrinterSettings _file = opts.Value;

    /// <summary>The printer to use right now: the saved choice, else appsettings.json.</summary>
    private async Task<PrinterSettings> EffectiveAsync(CancellationToken ct)
    {
        var saved = await sender.Send(new GetPosSettingsQuery(), ct);
        var s     = saved.IsSuccess ? saved.Value : null;
        if (s?.PrinterMode is null) return _file;

        return new PrinterSettings
        {
            Mode               = s.PrinterMode,
            WindowsPrinterName = s.PrinterName ?? "",
            IpAddress          = s.PrinterIp ?? "",
            Port               = s.PrinterPort ?? 9100,
            TimeoutMs          = _file.TimeoutMs,
        };
    }

    private static bool UseWindows(PrinterSettings cfg) =>
        string.Equals(cfg.Mode, "windows", StringComparison.OrdinalIgnoreCase)
        || (string.IsNullOrWhiteSpace(cfg.Mode) && OperatingSystem.IsWindows());

    private async Task<IActionResult> SendAsync(PrinterSettings cfg, byte[] bytes, CancellationToken ct)
    {
        // ── Windows local printer (USB/COM/LPT) ───────────────────────────────
        if (UseWindows(cfg))
        {
            if (!OperatingSystem.IsWindows())
                return StatusCode(503, new { success = false, message = "Windows printer mode is only supported when the API runs on Windows." });

            var printerName = RawPrinterHelper.AutoDetectPrinterName(cfg.WindowsPrinterName);
            if (printerName is null)
                return StatusCode(503, new { success = false, message = "No local printer detected. Connect the receipt printer via USB and ensure it's installed in Windows." });

            try
            {
                RawPrinterHelper.SendBytes(printerName, bytes);
                return Ok(new { success = true, message = $"Sent {bytes.Length} bytes to '{printerName}'." });
            }
            catch (Exception ex)
            {
                return StatusCode(503, new { success = false, message = ex.Message });
            }
        }

        // ── Network printer (TCP 9100) ─────────────────────────────────────────
        if (string.IsNullOrWhiteSpace(cfg.IpAddress))
            return StatusCode(503, new { success = false, message = "Printer not configured. Choose one in Settings -> Receipt Printer." });
        try
        {
            using var client = new TcpClient { SendTimeout = cfg.TimeoutMs, ReceiveTimeout = cfg.TimeoutMs };
            await client.ConnectAsync(cfg.IpAddress, cfg.Port, ct);
            await using var stream = client.GetStream();
            await stream.WriteAsync(bytes, ct);
            await stream.FlushAsync(ct);
            return Ok(new { success = true, message = $"Sent {bytes.Length} bytes to {cfg.IpAddress}:{cfg.Port}." });
        }
        catch (Exception ex)
        {
            return StatusCode(503, new { success = false, message = $"Cannot reach printer at {cfg.IpAddress}:{cfg.Port} — {ex.Message}" });
        }
    }

    // ── POST /api/pos/print/raw ───────────────────────────────────────────────
    [RequirePermission("pos.transactions.print")]
    [HttpPost("raw")]
    public async Task<IActionResult> PrintRaw([FromBody] PrintRawRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Data))
            return BadRequest(new { success = false, message = "No print data provided." });

        byte[] bytes;
        try   { bytes = Convert.FromBase64String(req.Data); }
        catch { return BadRequest(new { success = false, message = "Invalid base64 data." }); }

        return await SendAsync(await EffectiveAsync(ct), bytes, ct);
    }

    // ── GET /api/pos/print/status ─────────────────────────────────────────────
    [RequirePermission("pos.transactions.print")]
    [HttpGet("status")]
    public async Task<IActionResult> GetStatus(CancellationToken ct)
    {
        var cfg = await EffectiveAsync(ct);
        if (UseWindows(cfg))
        {
            if (!OperatingSystem.IsWindows())
                return Ok(new { reachable = false, mode = "windows", printer = "", ip = "", port = 0, message = "Windows printer mode is only supported when the API runs on Windows." });

            var name = RawPrinterHelper.AutoDetectPrinterName(cfg.WindowsPrinterName);
            return Ok(new
            {
                reachable = name is not null,
                mode      = "windows",
                printer   = name ?? "",
                ip        = "",
                port      = 0,
                message   = name is not null ? (string?)null : "No local printer detected. Connect the receipt printer via USB and ensure it's installed in Windows.",
            });
        }

        if (string.IsNullOrWhiteSpace(cfg.IpAddress))
            return Ok(new { reachable = false, mode = "network", printer = "", ip = "", port = 0, message = "Printer not configured." });

        try
        {
            using var client = new TcpClient();
            using var linked = CancellationTokenSource.CreateLinkedTokenSource(ct);
            linked.CancelAfter(cfg.TimeoutMs);
            await client.ConnectAsync(cfg.IpAddress, cfg.Port, linked.Token);
            return Ok(new { reachable = true, mode = "network", printer = "", ip = cfg.IpAddress, port = cfg.Port, message = (string?)null });
        }
        catch (Exception ex)
        {
            return Ok(new { reachable = false, mode = "network", printer = "", ip = cfg.IpAddress, port = cfg.Port, message = $"{cfg.IpAddress}:{cfg.Port} — {ex.Message}" });
        }
    }

    // ── GET /api/pos/print/printers ───────────────────────────────────────────
    /// <summary>
    /// Printers installed in Windows on the server PC, for the Settings dropdown, plus the current
    /// choice and which printer auto-detection would use if none is chosen.
    /// </summary>
    [RequirePermission("pos.sessions.approve")]
    [HttpGet("printers")]
    public async Task<IActionResult> GetPrinters(CancellationToken ct)
    {
        var saved = await sender.Send(new GetPosSettingsQuery(), ct);
        var s     = saved.IsSuccess ? saved.Value : null;
        var names = OperatingSystem.IsWindows() ? RawPrinterHelper.GetLocalPrinterNames() : new List<string>();
        return Ok(new
        {
            printers     = names,
            autoDetected = OperatingSystem.IsWindows() ? RawPrinterHelper.AutoDetectPrinterName(_file.WindowsPrinterName) : null,
            savedMode    = s?.PrinterMode,
            savedName    = s?.PrinterName,
            savedIp      = s?.PrinterIp,
            savedPort    = s?.PrinterPort,
            fileMode     = _file.Mode,
            fileName     = _file.WindowsPrinterName,
            fileIp       = _file.IpAddress,
            filePort     = _file.Port,
            isWindows    = OperatingSystem.IsWindows(),
        });
    }

    // ── PUT /api/pos/print/settings ───────────────────────────────────────────
    [RequirePermission("pos.sessions.approve")]
    [HttpPut("settings")]
    public async Task<IActionResult> SaveSettings([FromBody] SetPrinterSettingsCommand cmd, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return result.IsSuccess
            ? Ok(new { success = true, data = result.Value, message = "Printer saved." })
            : StatusCode(result.Error.Code.EndsWith("Forbidden") ? 403 : 400,
                new { success = false, message = result.Error.Description });
    }

    // ── POST /api/pos/print/test ──────────────────────────────────────────────
    /// <summary>
    /// Prints a short test slip on the given printer (or the saved one when none is given), so a
    /// choice can be proved before saving it.
    /// </summary>
    [RequirePermission("pos.transactions.print")]
    [HttpPost("test")]
    public async Task<IActionResult> Test([FromBody] PrintTestRequest? req, CancellationToken ct)
    {
        var cfg = await EffectiveAsync(ct);
        if (req?.Mode is "windows" or "network")
            cfg = new PrinterSettings
            {
                Mode = req.Mode, WindowsPrinterName = req.PrinterName ?? "",
                IpAddress = req.PrinterIp ?? "", Port = req.PrinterPort ?? 9100, TimeoutMs = _file.TimeoutMs,
            };

        var target = UseWindows(cfg) ? $"'{cfg.WindowsPrinterName}'" : $"{cfg.IpAddress}:{cfg.Port}";
        // \u escapes, not \x: C#'s \x reads up to FOUR hex digits, so "\x1Ba" would be U+01BA.
        var text   = "\u001B@"                      // initialise
                   + "\u001Ba\u0001"                // centre
                   + "\u001B!0VRODUX ERP\n\u001B!\u0000"
                   + "Test print\n"
                   + $"{DateTime.Now:dd MMM yyyy HH:mm}\n"
                   + "--------------------------------\n"
                   + $"Printer: {target}\n"
                   + "If you can read this, the\nreceipt printer is working.\n\n\n\n"
                   + "\u001DVA\u0003";         // partial cut
        return await SendAsync(cfg, Encoding.ASCII.GetBytes(text), ct);
    }
}

public sealed record PrintRawRequest(string Data);
public sealed record PrintTestRequest(string? Mode, string? PrinterName, string? PrinterIp, int? PrinterPort);

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
