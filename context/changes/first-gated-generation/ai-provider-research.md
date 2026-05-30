# AI Provider Research — S-02: First Gated Generation

> Researched: 2026-05-30. Resolves the open blocker in roadmap S-02:
> "Which AI provider and model will generate D&D 5e stat blocks from Cloudflare Workers?"

---

## Option A — Cloudflare Workers AI (no external API key)

Uses the `env.AI` binding wired in `wrangler.jsonc`. Fully edge-native.

| | |
|---|---|
| **SDK** | `workers-ai-provider` (official, by Cloudflare) + `ai` (Vercel AI SDK v6) |
| **Install** | `npm i workers-ai-provider ai zod` |
| **Wrangler config** | Add `"ai": { "binding": "AI" }` in `wrangler.jsonc` |
| **Structured output** | `generateText` + `Output.object({ schema: z.object({...}) })` |
| **Workerd compat** | Native — no flags or shims needed |
| **Models for stat blocks** | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` (best quality), `@cf/moonshotai/kimi-k2.5` (256k ctx + reasoning), `@cf/meta/llama-3.1-8b-instruct-fast` (speed) |
| **JSON mode caveat** | Schema compliance not guaranteed — must handle `"JSON Mode couldn't be met"` error; no streaming in JSON mode |
| **D&D risk** | Smaller/mid models may produce illegal stat values; 70b or kimi-k2.5 are safer bets |

```ts
import { createWorkersAI } from 'workers-ai-provider';
import { generateText, Output } from 'ai';

const workersai = createWorkersAI({ binding: env.AI });
const { output } = await generateText({
  model: workersai('@cf/meta/llama-3.3-70b-instruct-fp8-fast'),
  output: Output.object({ schema: EnemyGroupSchema }),
  prompt: '...',
});
```

---

## Option B — Anthropic Claude (recommended)

Multiple real-world D&D tools (DM-VTT-Toolkit, Bytes-AI-Foundry) specifically choose Claude for stat block generation quality.

| | |
|---|---|
| **SDK** | `@ai-sdk/anthropic` + `ai` (Vercel AI SDK v6) |
| **Install** | `npm i ai @ai-sdk/anthropic zod` |
| **Workerd compat** | Works with `nodejs_compat` flag in `wrangler.jsonc`. Cloudflare's own Durable Agents docs use `@anthropic-ai/sdk` directly in Workers. |
| **Streaming caveat** | `streamText()` with `@ai-sdk/anthropic` has a known deadlock bug in workerd (vercel/ai #10725). **Use `generateText` only** — not a problem for the generate→show→confirm flow. |
| **Structured output** | `generateText` + `Output.object()` (AI SDK v6), Zod-validated |
| **Models** | `claude-sonnet-4-6` (best quality), `claude-haiku-4-5-20251001` (fastest, lower cost) |
| **Key storage** | `wrangler secret put ANTHROPIC_API_KEY` |

---

## Option C — OpenAI

| | |
|---|---|
| **SDK** | `@ai-sdk/openai` + `ai`, or native `openai` npm package |
| **Workerd compat** | Works — Cloudflare's own JSON mode changelog uses the `openai` npm package directly in a Worker |
| **Structured output** | `response_format: { type: "json_schema" }` natively, or `Output.object()` via AI SDK |
| **Models** | `gpt-4o`, `gpt-4o-mini` |
| **Key storage** | `wrangler secret put OPENAI_API_KEY` |

---

## Cross-cutting: Vercel AI SDK v6 pattern

All three providers use the same interface. Provider can be swapped without changing generation logic:

```ts
import { generateText, Output } from 'ai';
import { z } from 'zod';

const { output } = await generateText({
  model: /* workersai(...) | anthropic(...) | openai(...) */,
  output: Output.object({ schema: EnemyGroupSchema }),
  system: '...', // D&D 5e rules + constraints
  prompt: userInput,
});
// output is typed and Zod-validated
```

---

## Decision matrix

| Criterion | Workers AI | Anthropic | OpenAI |
|---|---|---|---|
| No external API key | ✅ | ❌ | ❌ |
| Workerd native | ✅ | ✅ (nodejs_compat) | ✅ |
| D&D stat block quality | ⚠️ model-dependent | ✅✅ | ✅ |
| Guaranteed schema output | ⚠️ can fail with error | ✅ | ✅ |
| Streaming support | ❌ in JSON mode | ⚠️ non-stream OK | ✅ |
| Cost | Included in CF plan | Pay-per-token | Pay-per-token |
| Edge latency | Lowest (native) | Network RTT | Network RTT |

---

## Decision

**Anthropic + `@ai-sdk/anthropic` + Vercel AI SDK v6**, using `generateText` + `Output.object()` (non-streaming).

**Why:**
- `@anthropic-ai/sdk` works in workerd with the `nodejs_compat` flag (confirmed in Cloudflare official docs)
- Claude has the best track record for D&D stat block accuracy among available options
- The `streamText` deadlock bug is irrelevant — the S-02 flow is generate → wait → show cards, not streamed
- Provider can be swapped to Workers AI later (cost optimization) without changing generation logic

**Next step for `/10x-plan`:** define the Zod schema for `EnemyGroup` (array of enemy cards with D&D 5e-valid fields), the system prompt strategy, and retry/validation logic for failed generations.
