/**
 * ESC/POS command builder for thermal printers.
 * Produces a number[] array that QZ Tray sends as raw bytes.
 *
 * Supports 58mm (32 chars) and 80mm (48 chars) paper widths.
 */

const ESC = 0x1B;
const GS = 0x1D;

export class ESCPOSBuilder {
  private cmds: number[] = [];
  private width: number;

  constructor(paperWidth: 58 | 80 = 80) {
    this.width = paperWidth === 58 ? 32 : 48;
    this.init();
  }

  /** Reset printer to defaults */
  init(): this {
    this.cmds.push(ESC, 0x40);
    return this;
  }

  /** Encode text as CP857 (Turkish) compatible bytes + newline */
  text(str: string): this {
    for (let i = 0; i < str.length; i++) {
      this.cmds.push(str.charCodeAt(i) & 0xFF);
    }
    this.cmds.push(0x0A); // LF
    return this;
  }

  /** Raw text without newline */
  rawText(str: string): this {
    for (let i = 0; i < str.length; i++) {
      this.cmds.push(str.charCodeAt(i) & 0xFF);
    }
    return this;
  }

  /** Bold on/off */
  bold(on = true): this {
    this.cmds.push(ESC, 0x45, on ? 1 : 0);
    return this;
  }

  /** Double-height text on/off */
  doubleHeight(on = true): this {
    this.cmds.push(ESC, 0x21, on ? 0x10 : 0x00);
    return this;
  }

  /** Center alignment */
  centerOn(): this {
    this.cmds.push(ESC, 0x61, 1);
    return this;
  }

  /** Left alignment */
  leftAlign(): this {
    this.cmds.push(ESC, 0x61, 0);
    return this;
  }

  /** Print a separator line */
  separator(char = '-'): this {
    return this.text(char.repeat(this.width));
  }

  /** Two-column row: label left, value right */
  row(label: string, value: string): this {
    const gap = this.width - label.length - value.length;
    if (gap < 1) {
      return this.text(label + ' ' + value);
    }
    return this.text(label + ' '.repeat(gap) + value);
  }

  /** Centered text */
  center(str: string): this {
    const pad = Math.max(0, Math.floor((this.width - str.length) / 2));
    return this.text(' '.repeat(pad) + str);
  }

  /** Feed n lines */
  feed(lines = 3): this {
    for (let i = 0; i < lines; i++) {
      this.cmds.push(0x0A);
    }
    return this;
  }

  /** Cut paper (full cut) */
  cut(): this {
    this.feed(3);
    this.cmds.push(GS, 0x56, 0x00);
    return this;
  }

  /** Partial cut */
  partialCut(): this {
    this.feed(3);
    this.cmds.push(GS, 0x56, 0x01);
    return this;
  }

  /** Open cash drawer (pin 2) */
  openDrawer(): this {
    this.cmds.push(ESC, 0x70, 0x00, 0x19, 0x78);
    return this;
  }

  /** Get the built command array */
  build(): number[] {
    return [...this.cmds];
  }

  /** Get paper width in chars */
  getWidth(): number {
    return this.width;
  }
}
