/**
 * ESC/POS command builder — ported from src/lib/escpos.ts
 * Identical logic, works in Node.js (no browser APIs needed).
 */

const ESC = 0x1B;
const GS  = 0x1D;

export class ESCPOSBuilder {
  private cmds: number[] = [];
  private width: number;

  constructor(paperWidth: 58 | 80 = 80) {
    this.width = paperWidth === 58 ? 32 : 48;
    this.init();
  }

  init(): this {
    this.cmds.push(ESC, 0x40);
    return this;
  }

  text(str: string): this {
    for (let i = 0; i < str.length; i++) {
      this.cmds.push(str.charCodeAt(i) & 0xFF);
    }
    this.cmds.push(0x0A);
    return this;
  }

  rawText(str: string): this {
    for (let i = 0; i < str.length; i++) {
      this.cmds.push(str.charCodeAt(i) & 0xFF);
    }
    return this;
  }

  bold(on = true): this {
    this.cmds.push(ESC, 0x45, on ? 1 : 0);
    return this;
  }

  doubleHeight(on = true): this {
    this.cmds.push(ESC, 0x21, on ? 0x10 : 0x00);
    return this;
  }

  centerOn(): this {
    this.cmds.push(ESC, 0x61, 1);
    return this;
  }

  leftAlign(): this {
    this.cmds.push(ESC, 0x61, 0);
    return this;
  }

  separator(char = '-'): this {
    return this.text(char.repeat(this.width));
  }

  row(label: string, value: string): this {
    const gap = this.width - label.length - value.length;
    if (gap < 1) return this.text(label + ' ' + value);
    return this.text(label + ' '.repeat(gap) + value);
  }

  center(str: string): this {
    const pad = Math.max(0, Math.floor((this.width - str.length) / 2));
    return this.text(' '.repeat(pad) + str);
  }

  feed(lines = 3): this {
    for (let i = 0; i < lines; i++) this.cmds.push(0x0A);
    return this;
  }

  cut(): this {
    this.feed(3);
    this.cmds.push(GS, 0x56, 0x00);
    return this;
  }

  openDrawer(): this {
    this.cmds.push(ESC, 0x70, 0x00, 0x19, 0x78);
    return this;
  }

  build(): Buffer {
    return Buffer.from(this.cmds);
  }

  getWidth(): number {
    return this.width;
  }
}
