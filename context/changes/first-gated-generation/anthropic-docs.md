# Anthropic TypeScript SDK — Reference Docs

> Fetched via context7 on 2026-05-30. Source: `/anthropics/anthropic-sdk-typescript`
> Scoped to what's relevant for the `first-gated-generation` change (stat block generation in Cloudflare Workers).

---

## Install

```bash
npm install @anthropic-ai/sdk zod
```

For Cloudflare Workers, add `nodejs_compat` to your `wrangler.jsonc` compatibility flags.

---

## Client Instantiation

```ts
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY, // set via: wrangler secret put ANTHROPIC_API_KEY
});
```

---

## Basic Message

```ts
const message = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello, Claude!' }],
});

console.log(message.content);
```

---

## Structured Output — with Zod (recommended)

```ts
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

const client = new Anthropic();

const NumbersResponse = z.object({
  primes: z.array(z.number()),
});

const message = await client.messages.parse({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'What are the first 3 prime numbers?' }],
  output_config: {
    format: zodOutputFormat(NumbersResponse),
  },
});

console.log(message.parsed_output?.primes); // [2, 3, 5]
```

## Structured Output — with raw JSON Schema

```ts
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

const NumbersResponse = {
  type: 'object',
  properties: {
    primes: { type: 'array', items: { type: 'number' } },
  },
  required: ['primes'],
} as const;

const message = await client.messages.parse({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'What are the first 3 prime numbers?' }],
  output_config: {
    format: jsonSchemaOutputFormat(NumbersResponse),
  },
});

console.log(message.parsed_output?.primes);
```

---

## messages.create — Full Parameter Reference

```ts
interface MessageCreateParamsBase {
  max_tokens: number;           // required
  messages: Array<MessageParam>; // required
  model: Model;                 // required
  cache_control?: CacheControlEphemeral | null;
  container?: string | null;
  inference_geo?: string | null;
  metadata?: Metadata;
  output_config?: OutputConfig; // used for structured output
  service_tier?: 'auto' | 'standard_only';
  stop_sequences?: Array<string>;
  stream?: boolean;
  system?: string | Array<TextBlockParam>;
  temperature?: number;
  thinking?: ThinkingConfigParam;
  tool_choice?: ToolChoice;
  tools?: Array<ToolUnion>;
  top_k?: number;
  top_p?: number;
}
```

---

## Tool Use

```ts
const message = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  messages: [userMessage],
  tools,
});
```

---

## Streaming (NOT used in this project)

> Per `ai-provider-research.md`: the `streamText` / streaming path has a known deadlock bug in workerd.
> The S-02 flow is generate → wait → show cards, so streaming is intentionally skipped.
> Use `messages.create` (non-streaming) or `messages.parse` for structured output.

Streaming API exists via `toolRunner` and `BetaMessageStream` but is not applicable here.

---

## Key Notes for Cloudflare Workers

- Requires `nodejs_compat` compatibility flag in `wrangler.jsonc`
- Store API key via `wrangler secret put ANTHROPIC_API_KEY`
- Use `messages.parse` + `zodOutputFormat` for Zod-validated stat block output
- Do **not** use `stream: true` — deadlock bug in workerd (vercel/ai #10725)
- Model recommendations: `claude-sonnet-4-6` (quality), `claude-haiku-4-5-20251001` (speed/cost)
