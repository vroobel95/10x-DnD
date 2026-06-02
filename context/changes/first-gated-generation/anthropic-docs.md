# Vercel AI SDK v6 — Reference Docs (Anthropic Provider)

> Updated 2026-05-31 for `first-gated-generation`. Uses `@ai-sdk/anthropic` + `generateText` + `Output.object()`.
> The previous version of this file documented `@anthropic-ai/sdk` (native SDK) — that pattern is NOT used here.

---

## Install

```bash
npm install ai @ai-sdk/anthropic zod
```

For Cloudflare Workers, ensure `nodejs_compat` is in your `wrangler.jsonc` compatibility flags (already present).

---

## Client Instantiation

```ts
import { createAnthropic } from "@ai-sdk/anthropic";
import { ANTHROPIC_API_KEY } from "astro:env/server"; // NOT process.env — Workers don't surface it

const anthropic = createAnthropic({ apiKey: ANTHROPIC_API_KEY ?? "" });
```

---

## Structured Output with Zod (`Output.object`)

```ts
import { generateText, Output } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

const anthropic = createAnthropic({ apiKey: ANTHROPIC_API_KEY ?? "" });

const MySchema = z.object({
  items: z.array(z.string()),
});

const { output } = await generateText({
  model: anthropic("claude-sonnet-4-6"),
  output: Output.object({ schema: MySchema }),
  system: "You are a helpful assistant.",
  prompt: "List 3 items.",
});

console.log(output); // { items: ['...', '...', '...'] }
```

`output` is typed as `z.infer<typeof MySchema>` — no manual cast needed.

---

## Non-Streaming Constraint

> Streaming (`streamText`) has a known deadlock bug in workerd (Cloudflare Workers runtime).
> Always use `generateText` (non-streaming) for this project.
> The S-02 flow is: generate → wait → show cards. No streaming needed.

---

## `generateText` — Key Parameters

```ts
interface GenerateTextOptions {
  model: LanguageModel; // anthropic('claude-sonnet-4-6')
  output?: OutputStrategy; // Output.object({ schema }) for structured output
  system?: string; // system prompt
  prompt?: string; // user prompt
  messages?: CoreMessage[]; // alternative to prompt for multi-turn
  temperature?: number;
  maxTokens?: number;
}
```

---

## Key Notes for Cloudflare Workers

- Use `astro:env/server` for secrets — `process.env` does NOT work in Workers
- Store the API key via `wrangler secret put ANTHROPIC_API_KEY`
- Use `generateText` (non-streaming) — `streamText` has a deadlock bug in workerd
- Model: `claude-sonnet-4-6` (quality over cost for stat block generation)
- `Output.object({ schema })` validates the response against your Zod schema; throws on mismatch
