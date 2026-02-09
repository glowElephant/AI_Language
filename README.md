# AI_Language

A compressed language protocol for efficient AI-to-AI agent communication. Replaces natural language with structured minimal syntax, achieving **40.7% token reduction** (measured with GPT-4o tokenizer).

## Why?

Multi-agent systems where AI agents communicate via natural language waste tokens on filler words, sentence structure, and redundant context. AI_Language eliminates this overhead:

```
Natural Language (19 tokens):
"I acknowledge receipt of your message with ID msg42. The request has been received and understood."

AI_Language (4 tokens):
ACK:#msg42
```

## Quick Start

```bash
npm install
npm test        # Run all 124 tests
npm run demo    # Run 3-agent deployment demo
npm run benchmark  # Run token efficiency benchmark
```

## Message Format

```
SENDER→RECEIVER:COMMAND:key:value|key2:value2
```

### Examples

```
# Simple command
ACK

# Routed request with payload
A→B:REQ:action:build|mode:prod

# Broadcast error
SYS→*:ERR:code:503|msg:service_down|retry:T

# Nested data
DATA:users:[{name:alice,score:95},{name:bob,score:87}]

# Multicast
ORCH→[A,B,C]:REQ:action:vote|proposal:deploy_v2
```

## Architecture

```
src/
├── types/       # Token types, AST nodes, message types
├── lexer/       # Tokenizer
├── parser/      # Recursive descent parser → AST
├── encoder/     # AILMessage object → AI_Language string
├── decoder/     # AI_Language string → AILMessage object
├── validator/   # Syntax + semantic validation
└── runtime/     # Multi-agent runtime
    ├── agent.ts     # Agent abstraction
    ├── router.ts    # Message routing (unicast/broadcast/multicast/anycast)
    └── session.ts   # Session & context management
```

## API

```typescript
import { encode, decode, validate, parse, Agent, Router } from './src';

// Encode a message
const raw = encode({
  sender: 'A',
  receiver: { type: 'single', id: 'B' },
  command: 'REQ',
  payload: { action: 'build', mode: 'prod' },
});
// → "A→B:REQ:action:build|mode:prod"

// Decode back
const msg = decode('A→B:REQ:action:build|mode:prod');
// → { sender: 'A', receiver: {...}, command: 'REQ', payload: { action: 'build', mode: 'prod' } }

// Validate
const result = validate('A→B:REQ:action:build', { strictCommands: true });
// → { valid: true, errors: [] }

// Multi-agent routing
const router = new Router();
const a = new Agent({ id: 'A' });
const b = new Agent({ id: 'B' });
b.onMessage((msg) => console.log('B received:', msg));
router.register(a);
router.register(b);
a.send({ receiver: { type: 'single', id: 'B' }, command: 'PING' });
```

## Token Efficiency (GPT-4o)

| Scenario                     | NL   | AIL  | Saved     |
|------------------------------|------|------|-----------|
| Simple acknowledgment        | 19   | 4    | **78.9%** |
| Error notification           | 46   | 18   | **60.9%** |
| Configuration update         | 42   | 21   | **50.0%** |
| **Overall (10 scenarios)**   | 376  | 223  | **40.7%** |

Full results: [docs/benchmark-results.md](docs/benchmark-results.md)

## Specification

- [Grammar](docs/spec/grammar.md) — Message structure, delimiters, types, EBNF
- [Commands](docs/spec/commands.md) — 30+ built-in commands, abbreviation rules
- [Extensions](docs/spec/extensions.md) — Domain-specific namespaces, schema exchange
- [Protocol](docs/spec/protocol.md) — Routing patterns, sessions, error handling
- [Examples](docs/spec/examples.md) — Real-world scenarios with NL comparison

## License

ISC
