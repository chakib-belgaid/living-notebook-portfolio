/* co2.js ships without typings; only what the page uses is declared. */
declare module "@tgwf/co2" {
  export class co2 {
    constructor(options?: { model?: "1byte" | "swd"; version?: 3 | 4 });
    perByte(bytes: number, green?: boolean): number;
  }
  export const averageIntensity: { data: Record<string, number>; type: string };
}
