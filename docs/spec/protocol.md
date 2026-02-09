# AI_Language Multi-Agent Communication Protocol v0.1

## 1. Overview

This document defines how multiple agents communicate using AI_Language, covering session lifecycle, routing patterns, context management, and error handling.

## 2. Agent Identity

### 2.1 Agent IDs

Each agent has a unique identifier:

- Single uppercase letter for simple cases: `A`, `B`, `C`
- Descriptive short name for clarity: `UI`, `DB`, `API`, `ML`, `SYS`
- Namespaced for large systems: `team1.worker3`

### 2.2 Special Addresses

| Address | Meaning                    | Example          |
|---------|----------------------------|------------------|
| `*`     | All agents (broadcast)     | `A→*:PING`       |
| `SYS`   | System / orchestrator      | `A→SYS:LOG:...`  |

## 3. Communication Patterns

### 3.1 Unicast (1:1)

Direct message between two agents:

```
A→B:REQ:action:build
B→A:RES:status:ok
```

### 3.2 Broadcast (1:N)

Message to all agents:

```
SYS→*:EVT:type:shutdown|delay:10s
```

### 3.3 Multicast (1:Group)

Message to a specific group using list syntax:

```
A→[B,C,D]:REQ:action:vote|topic:deploy
```

### 3.4 Anycast (1:Any-of-Group)

Request handled by any available agent in a group:

```
A→<WORKERS>:DO:task:render_frame|id:42
```

The `<GROUP>` syntax indicates any one agent from the named group.

### 3.5 Pipeline (Chain)

Sequential processing through agents:

```
A→B:DO:task:parse|data:"raw input"|next:C
B→C:DO:task:validate|data:{parsed...}|next:D
C→D:DO:task:store|data:{validated...}
D→A:DONE:task:pipeline|status:ok
```

## 4. Session Lifecycle

### 4.1 Session Establishment

```
A→B:HELLO:v:0.1|cap:[GAME_V1,ML_V1]|sid:sess_01
B→A:HELLO:v:0.1|cap:[GAME_V1]|sid:sess_01|compat:{GAME:V1}
```

### 4.2 Active Session

All subsequent messages within a session can reference `sid`:

```
A→B:REQ:sid:sess_01|action:get_state
```

Or omit `sid` when operating in a single-session context.

### 4.3 Session Termination

```
A→B:BYE:sid:sess_01|reason:done
B→A:ACK:sid:sess_01
```

### 4.4 Session Timeout

If no message is received within `ttl`, the session expires:

```
HELLO:sid:sess_01|ttl:300s
```

## 5. Message Identification & References

### 5.1 Message IDs

Messages can carry a unique ID for tracking:

```
A→B:REQ:id:m1|action:build
```

### 5.2 References

Response or follow-up messages reference the original:

```
B→A:RES:ref:m1|status:ok
```

### 5.3 Conversation Threading

Chain of related messages:

```
A→B:REQ:id:m1|action:analyze|data:{...}
B→A:RES:ref:m1|id:m2|status:partial|progress:50pct
B→A:RES:ref:m1|id:m3|status:ok|data:{result...}
```

## 6. Context Management

### 6.1 Shared Context

Agents can establish shared context to avoid repeating information:

```
A→B:SYNC:ctx:{project:alpha,env:prod,branch:main}
```

Subsequent messages can reference context implicitly:

```
A→B:DO:task:deploy
```
(Uses the synced context: project=alpha, env=prod, branch=main)

### 6.2 Context Update

```
A→B:SYNC:ctx.env:staging
```

### 6.3 Context Query

```
A→B:GET:ctx
B→A:RES:data:{project:alpha,env:staging,branch:main}
```

## 7. Error Handling

### 7.1 Error Response

```
B→A:ERR:ref:m1|code:400|msg:invalid_param|detail:pos_must_be_3d
```

### 7.2 Standard Error Codes

| Code | Meaning              |
|------|----------------------|
| 400  | Bad request / malformed message |
| 401  | Unauthorized         |
| 403  | Forbidden            |
| 404  | Not found            |
| 408  | Timeout              |
| 409  | Conflict             |
| 429  | Rate limited         |
| 500  | Internal error       |
| 503  | Service unavailable  |

### 7.3 Retry Protocol

```
A→B:REQ:id:m1|action:fetch
B→A:ERR:ref:m1|code:503|retry:T|delay:2s
A→B:RETRY:ref:m1|attempt:2
B→A:RES:ref:m1|status:ok|data:{...}
```

### 7.4 Error Escalation

When an agent cannot handle an error, it escalates:

```
B→SYS:ERR:code:500|src:B|op:build|msg:out_of_memory|escalate:T
```

## 8. Flow Control

### 8.1 Backpressure

Agent signals it's overloaded:

```
B→A:WARN:type:backpressure|queue:95pct|throttle:T
A→B:ACK:throttle:T|rate:10msg/s
```

### 8.2 Priority

Messages can carry priority:

```
A→B:REQ:pri:9|action:emergency_stop
```

Priority scale: 0 (lowest) to 9 (highest). Default is 5.

### 8.3 Ordered Delivery

When message order matters, use sequence numbers:

```
A→B:DATA:seq:1|chunk:first_part
A→B:DATA:seq:2|chunk:second_part
A→B:END:seq:3|total:2
```

## 9. Multi-Agent Coordination Patterns

### 9.1 Task Distribution (Fan-Out)

```
ORCH→A:DO:task:chunk1|data:{...}
ORCH→B:DO:task:chunk2|data:{...}
ORCH→C:DO:task:chunk3|data:{...}
A→ORCH:DONE:task:chunk1|result:{...}
B→ORCH:DONE:task:chunk2|result:{...}
C→ORCH:DONE:task:chunk3|result:{...}
ORCH→REQ_SRC:RES:status:ok|data:{merged...}
```

### 9.2 Consensus / Voting

```
ORCH→[A,B,C]:REQ:action:vote|proposal:deploy_v2
A→ORCH:RES:vote:yes
B→ORCH:RES:vote:yes
C→ORCH:RES:vote:no|reason:tests_failing
ORCH→*:EVT:type:vote_result|proposal:deploy_v2|result:approved|tally:{yes:2,no:1}
```

### 9.3 Leader Election

```
A→*:REQ:action:elect|candidate:A|term:1
B→A:RES:vote:yes|term:1
C→A:RES:vote:yes|term:1
A→*:EVT:type:leader_elected|leader:A|term:1
```

### 9.4 Pub/Sub Topic Workflow

```
A→SYS:SUB:topic:build.status
B→SYS:PUB:topic:build.status|data:{step:compile,status:ok}
SYS→A:EVT:topic:build.status|data:{step:compile,status:ok}
```

## 10. Message Ordering Guarantees

| Pattern    | Ordering            | Guarantee               |
|------------|---------------------|-------------------------|
| Unicast    | Per-sender FIFO     | Messages arrive in order |
| Broadcast  | Best-effort         | No ordering guarantee    |
| Pipeline   | Sequential          | Each step waits for prev |
| Stream     | Sequence-numbered   | Receiver reorders by seq |
