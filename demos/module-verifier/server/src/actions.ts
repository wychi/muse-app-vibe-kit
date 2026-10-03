import { defineAction, type ActionsModule, z } from "@hatch/space-sdk";

const identifiedObjectSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(240),
});

const identifyScreenshotObjectsResponse = z.object({
  objects: z.array(identifiedObjectSchema).min(1).max(12),
});

export const Actions = {
  identifyScreenshotObjects: defineAction({
    request: z.object({
      data_base64: z.string().min(32).max(16_000_000),
    }),
    response: identifyScreenshotObjectsResponse,
    async handler(ctx, args): Promise<z.infer<typeof identifyScreenshotObjectsResponse>> {
      return await ctx.inference.complete(
        "Inspect the attached full-page screenshot of a simulated mobile app. Identify only objects and visible UI elements that are actually present. Return 4 to 12 concise items in top-to-bottom reading order. Use a short, specific English name for each item and one sentence describing what is visibly shown or what the control visibly communicates. Do not infer hidden content or claim that a control works.",
        {
          schema: identifyScreenshotObjectsResponse,
          images: [{
            dataBase64: args.data_base64,
            mimeType: "image/png",
            filename: "full-page-screenshot.png",
          }],
        },
      );
    },
  }),
} satisfies ActionsModule;
