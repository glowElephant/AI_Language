# AI_Language

A compressed language protocol for inter-agent communication in LLM API-based multi-agent systems.
Replaces natural language with structured minimal syntax, **reducing token usage by 40%**.

## What is this?

When multiple AI agents collaborate, they waste tokens communicating in natural language.
AI_Language is a **compressed message format + parser library + routing runtime** for agent-to-agent communication.

```
Natural Language (19 tokens):
"I acknowledge receipt of your message with ID msg42. The request has been received and understood."

AI_Language (4 tokens):
ACK:#msg42
```

## Where to use it

Use AI_Language in **multi-agent backends that directly call LLM APIs**.

```
User → Your Server → [Agent A] ←AI_Language→ [Agent B]
                          ↑                        ↑
                  Claude/GPT API call      Claude/GPT API call
                  System prompt:           System prompt:
                  "Respond in AI_Language"  "Respond in AI_Language"
```

You control the system prompts. You instruct each agent to communicate using AI_Language format. The parser library on your server encodes/decodes messages between structured objects and AI_Language strings.

### Good use cases

| Use Case | Example |
|----------|---------|
| **Automation Pipelines** | Code analysis agent → Refactoring agent → Testing agent |
| **Game AI Servers** | NPC agents exchanging tactical information |
| **Data Processing** | ETL → Analysis → Reporting agent chain |
| **DevOps Orchestration** | Build → Deploy → Monitoring agent collaboration |

### Not suitable for

- Modifying internal behavior of **pre-built AI tools** like Claude Code or Cursor (you don't control their internals)
- Human-readable communication (this is designed for machines)

## Quick Start

```bash
npm install
npm test           # Run 124 tests
npm run demo       # 3-agent deployment pipeline demo
npm run benchmark  # Token efficiency measurement (GPT-4o tokenizer)
```

## Message Format

```
SENDER→RECEIVER:COMMAND:key:value|key2:value2
```

### Examples

```
# Simple command
ACK

# Routing + payload
A→B:REQ:action:build|mode:prod

# Broadcast
SYS→*:ERR:code:503|msg:service_down|retry:T

# Nested data
DATA:users:[{name:alice,score:95},{name:bob,score:87}]

# Multicast
ORCH→[A,B,C]:REQ:action:vote|proposal:deploy_v2

# Anycast (any one from a group)
A→<WORKERS>:DO:task:render|id:42
```

## Features

### 1. Parser (string ↔ object conversion)

```typescript
import { encode, decode, validate } from './src';

// Object → AI_Language string
encode({
  sender: 'A',
  receiver: { type: 'single', id: 'B' },
  command: 'REQ',
  payload: { action: 'build', mode: 'prod' },
});
// → "A→B:REQ:action:build|mode:prod"

// AI_Language string → Object
decode('A→B:REQ:action:build|mode:prod');
// → { sender: 'A', receiver: {...}, command: 'REQ', payload: { action: 'build', mode: 'prod' } }

// Validation
validate('A→B:REQ:action:build', { strictCommands: true });
// → { valid: true, errors: [] }
```

### 2. Multi-Agent Runtime

Agent registration, message routing (unicast/broadcast/multicast/anycast), and session management.

```typescript
import { Agent, Router, SessionManager } from './src';

const router = new Router();
const orchestrator = new Agent({ id: 'ORCH' });
const builder = new Agent({ id: 'BUILD' });

builder.onMessage((msg) => {
  // Call LLM API, perform task, then respond
  builder.send({
    receiver: { type: 'single', id: 'ORCH' },
    command: 'DONE',
    payload: { task: 'build', status: 'ok' },
  });
});

router.register(orchestrator);
router.register(builder);

// Send a message
orchestrator.send({
  receiver: { type: 'single', id: 'BUILD' },
  command: 'DO',
  payload: { task: 'build', src: 'frontend', mode: 'prod' },
});
```

### 3. Extension System

Register domain-specific custom commands via namespaces:

```
GAME.SPAWN:entity:npc|pos:[10,20]
ML.TRAIN:model:bert|epochs:10
DEPLOY.ROLLBACK:target:staging
```

## Token Efficiency (GPT-4o measured)

| Scenario | NL Tokens | AIL Tokens | Reduction |
|----------|-----------|------------|-----------|
| Simple acknowledgment (ACK) | 19 | 4 | **78.9%** |
| Error notification | 46 | 18 | **60.9%** |
| Configuration update | 42 | 21 | **50.0%** |
| Subscription request | 32 | 14 | **56.3%** |
| Complex pipeline | 66 | 58 | **12.1%** |
| **Overall (10 scenarios)** | **376** | **223** | **40.7%** |

Details: [docs/benchmark-results.md](docs/benchmark-results.md)

## Project Structure

```
src/
├── types/       # Token types, AST nodes, message type definitions
├── lexer/       # Tokenizer (string → token array)
├── parser/      # Recursive descent parser (tokens → AST)
├── encoder/     # Encoder (AILMessage object → string)
├── decoder/     # Decoder (string → AILMessage object)
├── validator/   # Syntax + semantic validator
└── runtime/     # Multi-agent runtime
    ├── agent.ts     # Agent abstraction
    ├── router.ts    # Message routing
    └── session.ts   # Session & context management

tests/           # 124 tests (Vitest)
demo/            # 3-agent deployment pipeline demo
docs/spec/       # Language specification (grammar, commands, extensions, protocol, examples)
```

## Language Specification

- [Grammar](docs/spec/grammar.md) — Message structure, delimiters, types, EBNF
- [Commands](docs/spec/commands.md) — 30+ built-in commands, abbreviation rules
- [Extensions](docs/spec/extensions.md) — Domain-specific namespaces, schema exchange
- [Protocol](docs/spec/protocol.md) — Routing patterns, sessions, error handling
- [Hybrid Mode](docs/spec/hybrid.md) — AIL + natural language hybrid for LLM agents
- [Examples](docs/spec/examples.md) — Real-world scenarios + natural language comparison

## Tech Stack

- TypeScript, Node.js
- Vitest (testing)
- tiktoken (token counting)

## Findings — v1 Retrospective (2026-05)

After building v1.0 and trying to adopt it in real workflows, the savings did **not**
translate into meaningful production wins. This section documents why, honestly, so
v2 (if any) starts from the right premise.

### Why the 40.7% headline number is misleading

The benchmark covers **10 scenarios** that are heavily weighted toward short control
messages (ACK, simple queries, error notifications). Those see 60–80% savings — but
**they're already short**, so absolute token savings are tiny (a few tokens per message).

The one **complex scenario** (multi-step pipeline) saved only **12.1%** — and that
case is closer to what real multi-agent coding/orchestration looks like.

### Five reasons real-world impact was small

| # | Reason | Detail |
|---|--------|--------|
| 1 | **Distribution mismatch** | Real multi-agent workflows are mostly "complex nested data" cases, where AIL only saves ~12%. The 40.7% average is from light traffic. |
| 2 | **Absolute savings ≪ output cost** | A task may spend tens of thousands of tokens on **LLM output** (code, analysis). Saving 15 tokens on routing messages is rounding error. |
| 3 | **LLMs don't natively output AIL** | Models are trained on natural language. Asking them to respond in AIL via system prompt costs prompt tokens, sometimes degrades accuracy, and adds latency. |
| 4 | **Conversion overhead** | System prompt explaining AIL + encoder/decoder layer adds fixed cost. For small payloads this exceeds the savings. |
| 5 | **Limited deployment surface** | AIL only applies to backends where you control system prompts. It can't reach **Claude Code / Cursor / Codex** internals — which is exactly where most multi-agent activity happens today. |

### Where AIL still wins (small but real)

- **High-frequency polling** between agents (heartbeats, status checks) — long-tail
  savings compound over time.
- **Internal state sync** in your own multi-agent backends (e.g., financial bots,
  game NPCs) where you control both sides of the wire.
- **Logging / audit trails** — denser format means cheaper storage.

### v2 hypotheses (unverified — open for research)

If a v2 happens, these are the directions most likely to move the needle. None are
proven; they're the ideas worth testing.

1. **Domain-specific vocabularies, not general grammar.**
   The generic ACK/REQ/RES vocabulary captures little. A per-project codebook
   (e.g., for trading: `BUY:slot:1|p25:1310.5|risk:lo`) collapses much more.
   The library should generate codebooks from sample traffic, not bake them in.

2. **Compress shared context, not messages.**
   The expensive token is the system prompt or shared context that's attached to
   every call. AIL-encoding a 64KB master profile or RAG retrieval block has a
   much bigger absolute impact than encoding routing headers.

3. **Function-calling backed AIL.**
   Modern LLM APIs support structured output / function calling natively. Make
   AIL the **schema** for those tools instead of free-form text. Lets the model
   produce AIL without learning a foreign syntax — the runtime handles encoding.

4. **MCP server adapter.**
   Expose AIL as an MCP tool. Tool *results* (which Claude Code does see) can be
   delivered in AIL even if the agent's prompts can't. This reopens the
   Claude Code surface that was excluded in v1.

5. **Streaming + delta encoding.**
   Instead of full messages, send AIL deltas (`STATE:slot:1|p:1311.2` → just `p:1311.2`).
   Brings polling overhead near zero. Requires session-level state tracking.

### Verdict

v1.0 is functionally complete and the engineering is sound, but the **product-market fit
is narrow**. Treat v1 as a stable reference implementation; only invest in v2 if a
specific use case (Tidex backend, GraphRAG context compression, etc.) shows real
measured cost upside after a 1-week trial.

## License

ISC
