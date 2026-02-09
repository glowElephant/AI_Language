# AI_Language Command Specification v0.1

## 1. Command Structure

Commands are always **UPPERCASE** identifiers. They appear immediately after the routing header (or at message start if no routing).

```
COMMAND
COMMAND:payload
SENDER→RECEIVER:COMMAND:payload
```

## 2. Command Categories

### 2.1 Request / Response

| Command | Meaning              | Usage                          |
|---------|----------------------|--------------------------------|
| `REQ`   | Request              | `REQ:action:build`             |
| `RES`   | Response             | `RES:status:ok\|data:{...}`    |
| `GET`   | Read/query data      | `GET:user.profile`             |
| `SET`   | Write/update data    | `SET:user.name:alice`          |
| `DEL`   | Delete data          | `DEL:cache.key123`             |
| `PUT`   | Create or replace    | `PUT:config:{timeout:30}`      |

### 2.2 Acknowledgment / Control

| Command | Meaning              | Usage                          |
|---------|----------------------|--------------------------------|
| `ACK`   | Acknowledged         | `ACK:#msg42`                   |
| `NAK`   | Not acknowledged     | `NAK:#msg42\|reason:busy`      |
| `PING`  | Connectivity check   | `PING`                         |
| `PONG`  | Ping response        | `PONG`                         |
| `NOP`   | No operation         | `NOP`                          |

### 2.3 Notification / Event

| Command | Meaning              | Usage                          |
|---------|----------------------|--------------------------------|
| `EVT`   | Event occurred       | `EVT:type:click\|el:btn_save`  |
| `LOG`   | Log message          | `LOG:lvl:info\|msg:started`    |
| `WARN`  | Warning              | `WARN:mem_usage:92pct`         |
| `NOTE`  | Informational notice | `NOTE:update_available`        |

### 2.4 Error

| Command | Meaning              | Usage                          |
|---------|----------------------|--------------------------------|
| `ERR`   | Error                | `ERR:code:404\|msg:not_found`  |
| `FAIL`  | Operation failed     | `FAIL:op:build\|reason:timeout`|

### 2.5 Pub/Sub

| Command | Meaning              | Usage                          |
|---------|----------------------|--------------------------------|
| `SUB`   | Subscribe to topic   | `SUB:topic:sys.status`         |
| `UNSUB` | Unsubscribe          | `UNSUB:topic:sys.status`       |
| `PUB`   | Publish to topic     | `PUB:topic:sys.status\|data:ok`|

### 2.6 Task / Workflow

| Command | Meaning              | Usage                          |
|---------|----------------------|--------------------------------|
| `DO`    | Execute task         | `DO:task:compile\|src:main.rs` |
| `DONE`  | Task completed       | `DONE:task:compile\|time:3.2s` |
| `CANCEL`| Cancel task          | `CANCEL:task:compile`          |
| `WAIT`  | Wait / block         | `WAIT:until:ready`             |
| `RETRY` | Retry operation      | `RETRY:#msg42\|attempt:2`     |

### 2.7 Data Transfer

| Command | Meaning              | Usage                          |
|---------|----------------------|--------------------------------|
| `DATA`  | Raw data payload     | `DATA:rows:[{...},{...}]`      |
| `STREAM`| Start data stream    | `STREAM:id:s1\|type:log`       |
| `CHUNK` | Stream chunk         | `CHUNK:sid:s1\|seq:3\|d:...`   |
| `END`   | End stream           | `END:sid:s1`                   |

### 2.8 Meta / Session

| Command | Meaning              | Usage                          |
|---------|----------------------|--------------------------------|
| `HELLO` | Session init         | `HELLO:v:0.1\|cap:[ext1]`     |
| `BYE`   | Session close        | `BYE:reason:done`              |
| `SYNC`  | Sync state           | `SYNC:ctx:{step:3,total:10}`   |
| `META`  | Metadata exchange    | `META:ext:game_v1\|schema:{…}` |

## 3. Command Naming Rules

### 3.1 Built-in Commands
- 2-6 uppercase characters
- Mnemonic English abbreviation
- No dots or underscores

### 3.2 Custom Commands (via Extensions)
Custom commands use a namespace prefix with a dot separator:

```
EXT_NAME.COMMAND
```

Example:
```
GAME.SPAWN:entity:npc|pos:[10,20]
```

See `extensions.md` for the full extension registration protocol.

## 4. Common Payload Keys

These keys are conventionally used across commands. Not enforced, but recommended for interoperability.

### 4.1 Universal Keys

| Key      | Meaning                | Example           |
|----------|------------------------|--------------------|
| `id`     | Unique identifier      | `id:usr_42`        |
| `ref`    | Reference to message   | `ref:#msg42`       |
| `ts`     | Timestamp (ISO/epoch)  | `ts:1700000000`    |
| `ttl`    | Time to live           | `ttl:30s`          |
| `pri`    | Priority (0=low, 9=hi) | `pri:9`            |
| `src`    | Source                 | `src:api`          |
| `dst`    | Destination            | `dst:db`           |
| `ctx`    | Context object         | `ctx:{sid:s1}`     |

### 4.2 Status/Result Keys

| Key      | Meaning                | Example           |
|----------|------------------------|--------------------|
| `status` | Status indicator       | `status:ok`        |
| `code`   | Numeric code           | `code:200`         |
| `msg`    | Human-readable message | `msg:success`      |
| `reason` | Failure reason         | `reason:timeout`   |
| `data`   | Response data          | `data:{...}`       |
| `err`    | Error detail           | `err:null_ptr`     |

### 4.3 Collection/Query Keys

| Key      | Meaning                | Example           |
|----------|------------------------|--------------------|
| `limit`  | Max results            | `limit:50`         |
| `offset` | Pagination offset      | `offset:100`       |
| `sort`   | Sort field             | `sort:created_at`  |
| `order`  | Sort direction         | `order:desc`       |
| `filter` | Filter expression      | `filter:{age>:18}` |
| `fields` | Field selection        | `fields:[name,id]` |

### 4.4 Time/Duration Keys

| Key      | Meaning                | Example           |
|----------|------------------------|--------------------|
| `dur`    | Duration               | `dur:3s`           |
| `delay`  | Delay before action    | `delay:500ms`      |
| `timeout`| Timeout limit          | `timeout:10s`      |
| `at`     | Scheduled time         | `at:2024-01-01T00` |

### 4.5 Duration/Size Suffixes

| Suffix | Meaning       |
|--------|---------------|
| `ms`   | Milliseconds  |
| `s`    | Seconds       |
| `m`    | Minutes       |
| `h`    | Hours         |
| `d`    | Days          |
| `b`    | Bytes         |
| `kb`   | Kilobytes     |
| `mb`   | Megabytes     |
| `pct`  | Percent       |

## 5. Abbreviation Rules

When creating domain-specific vocabulary, follow these abbreviation patterns:

| Rule                         | Full         | Abbreviated  |
|------------------------------|--------------|--------------|
| Drop vowels (keep first)     | `resource`   | `res`        |
| Keep first syllable          | `configuration` | `config`  |
| Standard acronyms            | `identifier` | `id`         |
| Remove obvious suffixes      | `duration`   | `dur`        |
| Common tech abbreviations    | `message`    | `msg`        |
| Max 3-6 chars for keys       | `position`   | `pos`        |

### 5.1 Well-Known Abbreviations

| Abbreviation | Full Word     |
|--------------|---------------|
| `msg`        | message       |
| `req`        | request       |
| `res`        | response/resource |
| `err`        | error         |
| `cfg`        | config        |
| `ctx`        | context       |
| `ref`        | reference     |
| `src`        | source        |
| `dst`        | destination   |
| `pos`        | position      |
| `dir`        | direction     |
| `vel`        | velocity      |
| `dur`        | duration      |
| `lvl`        | level         |
| `cnt`        | count         |
| `idx`        | index         |
| `len`        | length        |
| `val`        | value         |
| `fmt`        | format        |
| `op`         | operation     |
| `fn`         | function      |
| `cb`         | callback      |
| `el`         | element       |
| `attr`       | attribute     |
| `prev`       | previous      |
| `cur`        | current       |
| `tmp`        | temporary     |
| `max`        | maximum       |
| `min`        | minimum       |
| `avg`        | average       |
| `num`        | number        |
| `desc`       | description   |
| `perm`       | permission    |
| `auth`       | authentication|
| `env`        | environment   |
| `ver`        | version       |
| `info`       | information   |
| `stat`       | status        |

## 6. Response Conventions

### 6.1 Success Response
```
RES:status:ok|data:{...}
```

### 6.2 Error Response
```
ERR:code:404|msg:not_found|ref:#msg42
```

### 6.3 Acknowledgment Only
```
ACK:#msg42
```

### 6.4 Command Chaining Reference

Every message can optionally carry an `id` for future reference:
```
A→B:REQ:id:m1|action:build
B→A:RES:ref:m1|status:ok
```
