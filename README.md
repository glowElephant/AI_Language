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
- [Examples](docs/spec/examples.md) — Real-world scenarios + natural language comparison

## Tech Stack

- TypeScript, Node.js
- Vitest (testing)
- tiktoken (token counting)

## License

ISC
