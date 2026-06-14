/**
 * ESC/POS command encoder for Epson-compatible thermal receipt printers.
 *
 * Supports 80mm (48-column) and 58mm (32-column) paper widths.
 * Works with: Epson TM series, Star mC-Print, Bixolon SRP, Xprinter, and
 * any printer that implements the Epson ESC/POS protocol (the vast majority).
 *
 * Reference: Epson ESC/POS Application Programming Guide rev. 2.3
 */

export type PaperWidth = 48 | 46 | 32; // characters per line

export class EscPos {
  private readonly chunks: Uint8Array[] = [];
  readonly cols: PaperWidth;

  constructor(cols: PaperWidth = 48) {
    this.cols = cols;
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private push(...bytes: number[]): this {
    this.chunks.push(new Uint8Array(bytes));
    return this;
  }

  private pushBytes(data: Uint8Array): this {
    this.chunks.push(data);
    return this;
  }

  private encode(text: string): Uint8Array {
    // TextEncoder is always available in modern browsers
    return new TextEncoder().encode(text);
  }

  // ── Printer control ──────────────────────────────────────────────────────────

  /** Initialize printer — clears buffer and resets settings */
  init(): this { return this.push(0x1B, 0x40); }

  /** Feed N lines */
  feed(n: number = 1): this { return this.push(0x1B, 0x64, Math.max(0, Math.min(n, 255))); }

  /** Partial cut (leaves 1 strip for easy tear) */
  cut(): this { return this.push(0x1D, 0x56, 0x01); }

  /** Full cut */
  fullCut(): this { return this.push(0x1D, 0x56, 0x00); }

  // ── Text formatting ──────────────────────────────────────────────────────────

  /** Left align */
  left(): this { return this.push(0x1B, 0x61, 0x00); }

  /** Center align */
  center(): this { return this.push(0x1B, 0x61, 0x01); }

  /** Right align */
  right(): this { return this.push(0x1B, 0x61, 0x02); }

  boldOn(): this  { return this.push(0x1B, 0x45, 0x01); }
  boldOff(): this { return this.push(0x1B, 0x45, 0x00); }

  underlineOn(): this  { return this.push(0x1B, 0x2D, 0x01); }
  underlineOff(): this { return this.push(0x1B, 0x2D, 0x00); }

  /** Double height + width (2× character size) */
  bigOn(): this  { return this.push(0x1D, 0x21, 0x11); }

  /** Normal 1× character size */
  bigOff(): this { return this.push(0x1D, 0x21, 0x00); }

  /** Set character size: width multiplier 1-8, height multiplier 1-8 */
  setSize(width: 1 | 2 | 3 | 4, height: 1 | 2 | 3 | 4): this {
    return this.push(0x1D, 0x21, ((width - 1) << 4) | (height - 1));
  }

  // ── Text output ──────────────────────────────────────────────────────────────

  /** Print raw text (no newline) */
  text(s: string): this { return this.pushBytes(this.encode(s)); }

  /** Print text + newline */
  println(s = ""): this { return this.pushBytes(this.encode(s + "\n")); }

  /** Horizontal separator line */
  rule(char = "-"): this { return this.println(char.repeat(this.cols)); }

  /**
   * Two-column row: left-aligned label + right-aligned value.
   * Truncates label if necessary to guarantee right column fits.
   */
  row(label: string, value: string, boldValue = false): this {
    const maxLabel = this.cols - value.length - 1;
    const lbl = label.substring(0, maxLabel).padEnd(maxLabel);
    if (boldValue) this.boldOn();
    this.text(lbl + " " + value + "\n");
    if (boldValue) this.boldOff();
    return this;
  }

  // ── Barcode & QR ───────────────────────────────────────────────────────────

  /**
   * Print a CODE128 barcode of the given data.
   * @param data   ASCII data to encode
   * @param height dot height (1-255, default 80)
   * @param width  module width (2-6, default 3)
   * @param hri    Human-readable text position: "none" | "below" (default "below")
   */
  barcode(data: string, height = 80, width: 2 | 3 | 4 | 5 | 6 = 3, hri: "none" | "below" = "below"): this {
    this.push(0x1D, 0x68, Math.max(1, Math.min(height, 255)));   // GS h — height
    this.push(0x1D, 0x77, width);                                 // GS w — module width
    this.push(0x1D, 0x48, hri === "below" ? 0x02 : 0x00);         // GS H — HRI position
    // GS k m n d1..dn  (m=73 CODE128). CODE128 payload must start with a code-set ("{B").
    const payload = this.encode("{B" + data);
    this.push(0x1D, 0x6B, 0x49, payload.length);
    this.pushBytes(payload);
    return this;
  }

  /**
   * Print a QR code (model 2) of the given data.
   * @param data    text to encode
   * @param size    module size (1-16, default 6)
   * @param ecLevel error correction: "L" | "M" | "Q" | "H" (default "M")
   */
  qr(data: string, size = 6, ecLevel: "L" | "M" | "Q" | "H" = "M"): this {
    const bytes = this.encode(data);
    const len   = bytes.length + 3;
    const pL    = len & 0xFF;
    const pH    = (len >> 8) & 0xFF;
    const ec    = { L: 48, M: 49, Q: 50, H: 51 }[ecLevel];

    this.push(0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00); // model 2
    this.push(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, Math.max(1, Math.min(size, 16))); // module size
    this.push(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, ec);         // error correction
    this.push(0x1D, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30);           // store data
    this.pushBytes(bytes);
    this.push(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30);       // print
    return this;
  }

  // ── Cash drawer ──────────────────────────────────────────────────────────────

  /**
   * Open cash drawer on DK port pin 2.
   * (Sends ESC p 0 ON_TIME OFF_TIME — 0x19 = 25 ms on, 0xFA = 250 ms off)
   * The drawer is physically wired to the DK RJ11/RJ12 port on the printer.
   */
  openDrawerPin2(): this { return this.push(0x1B, 0x70, 0x00, 0x19, 0xFA); }

  /**
   * Open cash drawer on DK port pin 5 (some drawer/printer combos use this).
   */
  openDrawerPin5(): this { return this.push(0x1B, 0x70, 0x01, 0x19, 0xFA); }

  // ── Status query ─────────────────────────────────────────────────────────────

  /**
   * Bytes to send to query cash drawer status.
   * DLE EOT 4 (DLE = 0x10, EOT = 0x04, n = 0x04)
   *
   * Response: 1 byte
   *   Bit 2 (mask 0x04): 0 = drawer closed, 1 = drawer open
   *
   * Not all printers support bidirectional status. Call transferIn() after
   * sending this and check if data arrives.
   */
  static readonly QUERY_DRAWER_STATUS = new Uint8Array([0x10, 0x04, 0x04]);

  // ── Build ────────────────────────────────────────────────────────────────────

  /** Assemble all chunks into a single Uint8Array ready for USB transfer */
  build(): Uint8Array {
    const total = this.chunks.reduce((s, c) => s + c.length, 0);
    const out   = new Uint8Array(total);
    let offset  = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  }
}
