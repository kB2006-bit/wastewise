import { randomBytes } from 'node:crypto';

/**
 * Generates an unpredictable, human-readable high-entropy tracking code.
 * Example: TRK-9A4F-C72B
 */
export function generateTrackingCode() {
  const buf = randomBytes(4);
  const part1 = buf.subarray(0, 2).toString('hex').toUpperCase();
  const part2 = buf.subarray(2, 4).toString('hex').toUpperCase();
  return `TRK-${part1}-${part2}`;
}
