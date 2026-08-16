// Simple in-process unit-budget guard. YouCam units cost real money
// (~$0.11 each), so we cap spend per server process to avoid runaway loops
// during development and demos.

import { env } from "@/lib/env";

let spent = 0;

export function spendUnits(n: number): void {
  spent += n;
  if (spent > env.unitBudget) {
    throw new Error(
      `Unit budget exceeded: spent ${spent} > cap ${env.unitBudget}. ` +
        `Increase UNIT_BUDGET or restart the server.`,
    );
  }
}

export function unitsSpent(): number {
  return spent;
}
