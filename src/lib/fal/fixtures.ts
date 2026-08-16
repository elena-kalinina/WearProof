// Re-export color-clash perception for tests that import DEMO_PERCEPTION.
import { getDemoScenario } from "@/lib/demo/scenarios";

export const DEMO_PERCEPTION = getDemoScenario("color-clash").perception;
