import { type ActionsModule } from "@hatch/space-sdk";

// The verifier runs browser-side reference implementations directly.
// It has no server actions and stores no user records.
export const Actions = {} satisfies ActionsModule;
