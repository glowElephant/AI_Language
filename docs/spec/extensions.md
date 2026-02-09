# AI_Language Extension System Specification v0.1

## 1. Purpose

The extension system allows agents to define domain-specific vocabulary, commands, and schemas without modifying the core language. Extensions keep the core minimal while enabling unlimited specialization.

## 2. Extension Namespace

### 2.1 Naming Convention

Extension namespaces are **UPPER_SNAKE_CASE**, 2-16 characters:

```
GAME
WEB_UI
ML_OPS
DATA_PIPE
```

### 2.2 Namespaced Commands

Extension commands use dot notation:

```
NAMESPACE.COMMAND
```

Examples:
```
GAME.SPAWN:entity:npc|pos:[10,20,0]
WEB_UI.RENDER:component:modal|props:{title:"Confirm"}
ML_OPS.TRAIN:model:bert|epochs:10|lr:0.001
```

### 2.3 Namespaced Keys

Extension-specific payload keys may also use dot prefix for clarity (optional when unambiguous):

```
GAME.MOVE:GAME.entity:player|GAME.pos:[5,3]
```

Shorthand when namespace is obvious from command:
```
GAME.MOVE:entity:player|pos:[5,3]
```

## 3. Extension Registration

### 3.1 Registration Message

An agent registers an extension at session start using the `META` command:

```
A→*:META:ext:GAME_V1|schema:{
  cmds:[SPAWN,MOVE,KILL,LOOT],
  keys:{
    entity:[npc,player,item],
    pos:list_3d,
    hp:int,
    dmg:int,
    inv:list
  },
  abbr:{
    entity:ent,
    position:pos,
    inventory:inv,
    health:hp,
    damage:dmg
  }
}
```

### 3.2 Registration Fields

| Field    | Type   | Required | Description                              |
|----------|--------|----------|------------------------------------------|
| `ext`    | string | Yes      | Extension name with optional version     |
| `schema` | map    | Yes      | Extension definition                     |
| `schema.cmds` | list | Yes  | Available commands in this extension     |
| `schema.keys` | map  | No   | Domain-specific keys and their types     |
| `schema.abbr` | map  | No   | Abbreviation mappings                    |
| `schema.types`| map  | No   | Custom type definitions                  |
| `schema.enums`| map  | No   | Enumerated value sets                    |

### 3.3 Compact Registration

For simple extensions, a minimal registration:

```
META:ext:DEPLOY|schema:{cmds:[BUILD,PUSH,ROLLBACK]}
```

## 4. Schema Exchange Protocol

### 4.1 Discovery

An agent can query available extensions:

```
A→B:GET:extensions
B→A:RES:data:[GAME_V1,WEB_UI_V2,ML_OPS_V1]
```

### 4.2 Schema Request

Request the full schema for an extension:

```
A→B:GET:schema.GAME_V1
B→A:RES:data:{cmds:[SPAWN,MOVE,KILL],keys:{...},abbr:{...}}
```

### 4.3 Schema Negotiation

When two agents need to agree on a shared vocabulary:

```
A→B:META:ext:GAME_V1|propose:T
B→A:ACK:ext:GAME_V1
```

Or reject:
```
B→A:NAK:ext:GAME_V1|reason:unsupported|alt:GAME_V2
```

## 5. Custom Type Definitions

Extensions can define custom types for validation:

```
META:ext:GEO|schema:{
  types:{
    coord:{lat:float,lng:float},
    bbox:{min:coord,max:coord},
    region:{name:str,bounds:bbox}
  }
}
```

Usage:
```
GEO.LOCATE:point:{lat:37.56,lng:126.97}
```

## 6. Enum Definitions

Constrained value sets:

```
META:ext:TASK|schema:{
  enums:{
    status:[pending,active,done,failed],
    priority:[low,med,high,critical]
  }
}
```

Usage:
```
TASK.UPDATE:id:t42|status:done|priority:high
```

## 7. Version Compatibility

### 7.1 Version Format

Extensions use simple integer versioning appended with `_V`:

```
GAME_V1
GAME_V2
WEB_UI_V3
```

### 7.2 Compatibility Rules

| Scenario                         | Behavior                          |
|----------------------------------|-----------------------------------|
| Same version                     | Full compatibility                |
| Receiver has newer version       | Should support older (backward)   |
| Receiver has older version       | Sender falls back or uses `alt`   |
| Unknown extension                | `NAK` with `reason:unsupported`   |

### 7.3 Version Negotiation

```
A→B:HELLO:v:0.1|ext:[GAME_V2,ML_V1]
B→A:HELLO:v:0.1|ext:[GAME_V1,ML_V1]|compat:{GAME:V1}
```

In this example, B only supports GAME_V1, so they agree on V1 for the GAME extension.

## 8. Built-in Extension Namespaces (Reserved)

These namespaces are reserved and must not be used for custom extensions:

| Namespace | Purpose                    |
|-----------|----------------------------|
| `SYS`     | System-level messages      |
| `CORE`    | Core protocol operations   |
| `DBG`     | Debug/diagnostic           |
| `SEC`     | Security/authentication    |

## 9. Extension Best Practices

1. **Keep it small**: Define only the commands and keys actually needed
2. **Reuse common keys**: Use the standard abbreviations from `commands.md` when possible
3. **Version early**: Start with `_V1` from the beginning
4. **Document enums**: Explicitly list allowed values rather than using free strings
5. **Flat over nested**: Prefer `pos_x:5|pos_y:3` over `pos:{x:5,y:3}` for frequently accessed fields
