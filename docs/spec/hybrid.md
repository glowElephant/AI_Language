# AI_Language Hybrid Mode Specification v0.1

## 1. Motivation

Pure AIL excels at structured, deterministic information (status codes, routing, metrics). However, LLM-based agents frequently need to communicate **uncertain**, **contextual**, or **reasoning-heavy** information that loses accuracy when force-compressed into key:value pairs.

### The Problem

```
# Pure AIL — information loss
DONE:phase:3|files:[FlowNodeView.cs]|issues:none

# What was actually true:
# "Phase 3 done. I changed the input port capacity, but there's a potential edge case
# with existing saved graphs that have single-input connections. Existing functionality
# should work, but you may want to validate with older project files."
```

Forcing agents to use pure AIL for nuanced information causes:
- **False confidence**: `issues:none` when there are caveats
- **Context loss**: Reasoning and assumptions disappear
- **Decision opacity**: Reviewers can't understand why choices were made

### The Solution

Hybrid mode combines AIL's compression benefits for structured data with natural language's expressiveness for contextual information.

## 2. Message Modes

AI_Language defines three message modes:

| Mode     | When to Use                                    | Token Efficiency |
|----------|------------------------------------------------|------------------|
| `PURE`   | Structured, deterministic, no ambiguity        | Maximum (~70%)   |
| `HYBRID` | Structured data + context/reasoning needed     | Moderate (~40%)  |
| `NL`     | Entirely exploratory/open-ended discussion      | Baseline (0%)    |

### 2.1 Mode Selection Rules

Use **PURE** when:
- Status acknowledgments: `ACK`, `PONG`, `NOP`
- Routing/coordination: `PING`, `SUB`, `UNSUB`
- Metrics with exact values: `SYNC:cpu:45pct|mem:2gb`
- Deterministic results: `DONE:task:build|status:ok|time:3.2s`

Use **HYBRID** when:
- Task completion with caveats or assumptions
- Error reports needing explanation
- Progress updates with context
- Decisions that others need to understand
- Results with confidence levels below 100%

Use **NL** when:
- Open-ended discussion or brainstorming
- Complex architectural reasoning
- Situations where structure would mislead

## 3. Hybrid Message Syntax

### 3.1 Format

```
AIL_HEADER
---
Natural language body with context, reasoning, or details.
Multiple lines allowed.
```

The `---` (three hyphens) on a standalone line separates the AIL header from the natural language body.

### 3.2 EBNF Extension

```ebnf
hybrid_message = ail_message NEWLINE "---" NEWLINE nl_body ;
ail_message    = message ;  (* standard AIL message from grammar.md *)
nl_body        = { ANY_CHAR } ;
```

### 3.3 Multi-Header Hybrid

When multiple AIL statements precede the body:

```
DONE:phase:3|files:[FlowNodeView.cs,EditorWindow.cs]
WARN:cf:70|area:backward_compat
---
Input port capacity changed from Single to Multi. Existing saved graphs
with single-input connections will still work, but graphs created in older
versions should be validated. The port change is backward-compatible at the
data level since Multi accepts Single connections.
```

## 4. Content Classification

### 4.1 AIL Zone (Structured Header)

Content that belongs in the AIL header:

| Category       | Examples                                         |
|----------------|--------------------------------------------------|
| Status         | `DONE`, `FAIL`, `SYNC`                           |
| File lists     | `files:[a.cs,b.cs]`                              |
| Metrics        | `lines:150|added:3|removed:1`                    |
| Flags          | `breaking:F|tested:T`                            |
| Confidence     | `cf:85`                                          |
| Error codes    | `code:404|type:missing_ref`                      |
| Counts         | `cnt:7|total:13`                                 |
| References     | `ref:#m42|dep:[task1,task2]`                     |

### 4.2 NL Zone (Natural Language Body)

Content that belongs in the natural language body:

| Category           | Why NL                                        |
|--------------------|-----------------------------------------------|
| Reasoning          | "I chose X over Y because..."                 |
| Caveats            | "This works but may break if..."              |
| Assumptions        | "Assuming the API contract doesn't change..." |
| Alternatives       | "Another approach would be..."                |
| Edge cases         | "When input is null, the behavior is..."      |
| Recommendations    | "You may want to also check..."               |
| Partial results    | "3 of 5 tests pass; the failures are..."      |
| Contextual details | "The existing code already had this pattern"   |

### 4.3 Decision Flowchart

```
Is the information...

├─ A status/metric/flag with exact value?
│   └─ → AIL zone (PURE or HYBRID header)
│
├─ A list of files/items/identifiers?
│   └─ → AIL zone
│
├─ An explanation of WHY something was done?
│   └─ → NL zone (use HYBRID)
│
├─ A caveat, assumption, or edge case?
│   └─ → NL zone (use HYBRID)
│
├─ Uncertain or approximate?
│   └─ → HYBRID with confidence marker
│
└─ Open-ended discussion?
    └─ → NL mode
```

## 5. Confidence & Certainty Markers

### 5.1 Confidence Key

The `cf` (confidence) key indicates certainty as a percentage (0-100):

```
DONE:task:migrate|cf:95|files:[migrator.cs]
---
Migration logic covers all 6 controller types. 95% confident because
I couldn't verify the TagData mode edge case without runtime testing.
```

### 5.2 Confidence Levels

| Level     | `cf` Range | Meaning                                    |
|-----------|------------|--------------------------------------------|
| Certain   | 95-100     | Verified, no caveats                       |
| High      | 80-94      | Very likely correct, minor unknowns        |
| Moderate  | 60-79      | Probably correct, notable assumptions      |
| Low       | 40-59      | Best effort, significant uncertainty       |
| Speculative | 0-39     | Guess or hypothesis, needs verification    |

### 5.3 Uncertain Values

Use `~` prefix for approximate values:

```
SYNC:progress:~80pct|eta:~5m|mem:~2gb
```

### 5.4 When cf < 80, HYBRID is Recommended

If confidence is below 80, the message SHOULD include a NL body explaining the uncertainty:

```
DONE:task:refactor|cf:65
---
Refactored the state management, but the original code had an undocumented
side effect in OnDisable(). I preserved the behavior but I'm not certain
it was intentional. Please review lines 142-158.
```

## 6. Hybrid Commands

Two new built-in commands support hybrid-specific patterns:

### 6.1 REPORT — Structured Summary + Details

For task completion reports:

```
REPORT:task:phase_3|status:done|files:[a.cs,b.cs,c.cs]|cf:90
---
Changed input port to Multi capacity. Added merge tab UI with per-input
DuplicateEventMode settings. Extracted BuildNodeParamsUI for reuse.

Note: FlowGraphView.cs needed no changes — the existing GetCompatiblePorts
already handles multi-input connections.
```

### 6.2 ISSUE — Problem Description

For bug reports or blockers:

```
ISSUE:sev:high|area:serialization|file:ProjectImporter.cs|line:285
---
When importing v1 format files with TagData mode controllers, the
OnTagValueNode's compareValue field isn't being mapped from the legacy
controller's threshold field. This causes all tag comparisons to use
the default value "0" instead of the original threshold.

Suggested fix: Add `compareValue = controller.threshold.ToString()`
in ConvertV1ToFlow() at line 312.
```

## 7. Detail Level Negotiation

Agents can request different verbosity from peers:

### 7.1 Detail Levels

| Level    | Keyword  | Behavior                              |
|----------|----------|---------------------------------------|
| Minimal  | `brief`  | PURE AIL only, no NL body             |
| Standard | `std`    | HYBRID when cf < 95                   |
| Verbose  | `verb`   | HYBRID always, full reasoning         |

### 7.2 Negotiation

```
# Orchestrator requests brief updates
ORCH→WORKER:SET:detail:brief

# Worker responds with pure AIL
WORKER→ORCH:DONE:task:build|status:ok|time:4s

# Orchestrator wants details on a specific issue
ORCH→WORKER:GET:detail:verb|ref:task_build

# Worker responds with full hybrid
WORKER→ORCH:REPORT:task:build|status:ok|time:4s|cf:90
---
Build succeeded but 3 deprecation warnings in auth module.
Consider updating passport.js from v0.6 to v0.7 before next release.
```

## 8. Examples

### 8.1 Pure AIL — Simple Acknowledgment

```
ACK:#msg42
```

No hybrid needed. Deterministic, no ambiguity.

### 8.2 Hybrid — Task Completion with Caveats

```
DONE:phase:2|file:FlowExecutor.cs|added:[merge_support,target_obj,forced_reset,new_nodes]|cf:92
---
All 4 features implemented. The merge execution uses per-inputConfig
DuplicateEventMode, which means each incoming connection can independently
choose Ignore or Restart behavior.

One assumption: When the same node receives simultaneous inputs from
two branches, the first arrival executes immediately. The second arrival
then checks DuplicateEventMode. If both arrive in the same frame,
execution order depends on coroutine scheduling (non-deterministic).
```

### 8.3 Hybrid — Error with Context

```
ERR:code:500|file:ProjectImporter.cs|op:restore_refs|cf:60
---
RestoreNodeReferences() fails when the target Transform path contains
a '/' that is also part of the GameObject name (e.g., "AC/DC Unit").
The path splitting logic at line 205 uses '/' as delimiter, which
conflicts with names containing slashes.

Workaround: Names with '/' are rare in practice. A proper fix would
require escaping or using Transform.Find() with incremental path resolution.
```

### 8.4 Hybrid — Progress Update

```
SYNC:task:migration|progress:60pct|done:[Rotation,Position,Color]|remaining:[Scale,Model,Disassembly]
---
Scale migration is straightforward (same field mapping). Model controller
has multiple animation groups that need to become separate PlayModelClipsNode
instances — estimating 2 more minutes. Disassembly is complex because it
creates both DisassemblyNode and AssemblyNode as separate simple flows.
```

### 8.5 Pure AIL — Metrics Sync

```
SYNC:cpu:45pct|mem:2.1gb|tasks:3|queue:0|uptime:1h
```

No hybrid needed. All values are exact and unambiguous.

### 8.6 Hybrid — Decision Explanation

```
DONE:task:port_change|choice:Multi|cf:95
---
Changed input port from Single to Multi capacity. Considered two approaches:

1. Multi capacity (chosen): Any number of inputs, merge handled at execution
2. Separate MergeNode type: Explicit merge node between branches

Chose #1 because it's simpler for users (no extra node needed) and matches
the "execute on first input" principle from the design spec. #2 would add
UI complexity without functional benefit.
```

## 9. Token Efficiency

| Mode   | vs Pure NL | vs Pure AIL | When                        |
|--------|------------|-------------|-----------------------------|
| PURE   | -70%       | baseline    | Deterministic data          |
| HYBRID | -40%       | +30%        | Structured + context needed |
| NL     | baseline   | +70%        | Open-ended discussion       |

Hybrid achieves ~40% savings vs pure NL while preserving information accuracy. The 30% cost vs pure AIL is the price of correctness.

## 10. Integration with Core Spec

### 10.1 Grammar Extension

The hybrid separator `---` is reserved at the protocol level. It MUST NOT appear as a bare value in AIL payloads. If needed in a value, escape as `\-\-\-` or use quotes: `"---"`.

### 10.2 Protocol Extension

Hybrid mode is negotiated during session handshake:

```
A→B:HELLO:v:0.1|hybrid:T|detail:std
B→A:HELLO:v:0.1|hybrid:T|detail:std
```

If an agent does not support hybrid (`hybrid:F` or omitted), the sender MUST use PURE mode and include all critical information in AIL payload.

### 10.3 Validation

A hybrid message is valid if:
1. The AIL header (before `---`) is valid per `grammar.md`
2. The `---` separator is on its own line
3. The NL body is non-empty (use PURE if no NL body needed)

## 11. Best Practices

1. **Default to HYBRID for task reports** — the cost is small, the accuracy gain is large
2. **Use PURE for acks and simple status** — no need to explain `ACK`
3. **Always include `cf` when below 95** — make uncertainty explicit
4. **Keep NL body concise** — hybrid NL should be 2-5 sentences, not essays
5. **AIL header should be self-sufficient for routing** — an agent that ignores the NL body should still be able to route and categorize the message
6. **Don't duplicate** — information in the AIL header should NOT be repeated in the NL body
7. **NL body adds, not restates** — the body provides context the header can't express

## 12. Swarm Integration Pattern

When multiple LLM agents work as a team (leader-worker swarm), hybrid mode is the default communication protocol.

### 12.1 Swarm Roles

| Role       | Communication Style                              |
|------------|--------------------------------------------------|
| Leader     | Sends tasks in NL (detailed prompts to workers)  |
| Worker     | Reports back in HYBRID (structured + context)    |
| Peer (W↔W) | Uses PURE for coordination, HYBRID for handoffs  |
| Leader↔User| Pure natural language (human-readable)           |

### 12.2 Worker Report Template

Workers use this pattern when reporting task completion:

```
DONE:task:{id}|files:[{changed}]|cf:{0-100}
---
{What was done, any caveats, assumptions, or recommendations.
2-5 sentences max.}
```

For errors or blockers:

```
ISSUE:task:{id}|sev:{low|med|high}|blocker:{T|F}
---
{Description of the problem, what was tried, suggested resolution.}
```

For progress updates:

```
SYNC:task:{id}|progress:{pct}|cur:{current_step}
---
{Optional context if something unexpected came up.}
```

### 12.3 When Workers Can Use PURE

Workers MAY skip the NL body (use PURE mode) for:
- Simple acknowledgments: `ACK:#task42`
- Deterministic completions with no caveats: `DONE:task:build|status:ok|time:3s`
- Status pings: `SYNC:status:idle`

### 12.4 Compact Reference for Agent Prompts

Include this block in swarm agent prompts to enable hybrid mode:

```
## Inter-agent communication: AI_Language Hybrid Mode
Messages to teammates use AIL hybrid format:

PURE (status/ack):     ACK | DONE:task:X|status:ok
HYBRID (task report):  COMMAND:key:value|cf:N
                       ---
                       Natural language context, caveats, reasoning.

Rules:
- Status/metrics/file lists/flags → AIL header
- Reasoning/caveats/assumptions/recommendations → NL body after ---
- Include cf (confidence 0-100) when below 95
- Keep NL body to 2-5 sentences
```

### 12.5 Real-World Example (Swarm Session)

A leader distributes Phase 1-6 of a codebase refactor to 5 workers:

```
# Worker A completes with high confidence
DONE:phase:1|files:[FlowNodes.cs,AnimationFlow.cs]|cf:98
---
Added InputPortConfig class and target fields to 7 action nodes.
All existing Clone() methods updated. No breaking changes.

# Worker B completes with caveat
DONE:phase:2|files:[FlowExecutor.cs]|cf:85
---
Merge execution implemented with per-input DuplicateEventMode.
When two branches arrive in the same frame, execution order depends
on coroutine scheduling (non-deterministic). May need a priority
tiebreaker if determinism is required.

# Worker C hits a blocker
ISSUE:phase:6|sev:high|blocker:T|file:ProjectImporter.cs
---
Legacy v1 format uses ComponentSettings keyed by type name, but
the type was renamed in Phase 1. Need the old type name mapping
to maintain backward compatibility. Requesting info from leader.

# Worker D simple completion
DONE:phase:3|files:[FlowNodeView.cs,AnimationFlowEditorWindow.cs]|cf:97

# Leader acknowledges
ACK:#phase3
```
