# AI_Language Grammar Specification v0.1

## 1. Design Goals

- **Token minimization**: Every character must earn its place
- **Zero learning curve for AI**: Any LLM should parse/generate valid messages from this spec alone
- **Domain agnostic**: No built-in domain vocabulary; all domain terms come via extensions
- **Unambiguous parsing**: No context-dependent grammar rules

## 2. Message Structure

A message consists of an optional **header** and a required **body**.

```
[HEADER]BODY
```

### 2.1 Full Format

```
SENDER→RECEIVER:COMMAND:PAYLOAD
```

### 2.2 Components

| Component  | Required | Description                          | Example       |
|------------|----------|--------------------------------------|---------------|
| SENDER     | No*      | Identifier of the sending agent      | `A`           |
| →          | No*      | Direction operator                   | `→`           |
| RECEIVER   | No*      | Identifier of the receiving agent    | `B`           |
| :          | Yes      | Header-body separator                | `:`           |
| COMMAND    | Yes      | Action verb or message type          | `REQ`         |
| :          | Cond.    | Command-payload separator            | `:`           |
| PAYLOAD    | No       | Data associated with the command     | `key:val`     |

*Routing header (`SENDER→RECEIVER:`) is optional when context makes it unambiguous (e.g., direct 1:1 channel).

### 2.3 Minimal Message

A message can be as short as a single command:

```
ACK
```

## 3. Delimiters & Operators

| Symbol | Name           | Purpose                                     | Example                    |
|--------|----------------|---------------------------------------------|----------------------------|
| `→`    | Arrow          | Separates sender from receiver              | `A→B`                      |
| `:`    | Colon          | Primary field separator                     | `REQ:data`                 |
| `\|`   | Pipe           | Separates parallel key-value groups         | `x:1\|y:2`                 |
| `.`    | Dot            | Sub-field / namespace accessor              | `ui.color`                 |
| `,`    | Comma          | List item separator                         | `a,b,c`                    |
| `=`    | Equals         | Value assignment within a group             | `mode=dark`                |
| `()`   | Parens         | Grouping / parameter list                   | `fn(a,b)`                  |
| `[]`   | Brackets       | Ordered list                                | `[1,2,3]`                  |
| `{}`   | Braces         | Key-value map                               | `{k:v,k2:v2}`             |
| `!`    | Bang           | Negation / urgency modifier                 | `!optional`                |
| `?`    | Question       | Query / optional modifier                   | `status?`                  |
| `#`    | Hash           | Reference / ID prefix                       | `#msg123`                  |
| `@`    | At             | Agent mention / address                     | `@agentC`                  |
| `*`    | Star           | Broadcast / wildcard                        | `A→*`                      |
| `\`    | Backslash      | Escape character                            | `val\:with\:colons`        |

### 3.1 Delimiter Precedence (Parsing Order)

1. `→` — Split routing header
2. First unescaped `:` after routing — Split command from payload
3. `|` — Split payload into parallel groups
4. `:` within groups — Split key from value
5. `.` — Resolve sub-fields
6. `,` — Split list items
7. `()`, `[]`, `{}` — Parse nested structures

## 4. Data Types

### 4.1 Primitives

| Type    | Syntax              | Examples                  |
|---------|----------------------|---------------------------|
| String  | Bare word or quoted  | `hello`, `"hello world"`  |
| Integer | Digits               | `42`, `-7`                |
| Float   | Digits with dot      | `3.14`, `-0.5`            |
| Boolean | `T` / `F`            | `T`, `F`                  |
| Null    | `_`                  | `_`                       |

### 4.2 Compound Types

**List** — ordered sequence:
```
[item1,item2,item3]
```

**Map** — key-value pairs:
```
{key1:val1,key2:val2}
```

**Nested**:
```
{users:[{name:alice,role:admin},{name:bob,role:user}]}
```

### 4.3 Type Inference

Types are inferred by syntax. No explicit type annotations needed:
- Starts with digit or `-` followed by digit → number
- `T` or `F` as standalone value → boolean
- `_` as standalone value → null
- `[...]` → list
- `{...}` → map
- Everything else → string

When ambiguity exists (e.g., a string value that is literally `T`), use quotes: `"T"`.

## 5. Strings

### 5.1 Bare Strings

Any value that doesn't require escaping can be written unquoted:

```
name:alice
```

### 5.2 Quoted Strings

Use double quotes when the value contains delimiters or whitespace:

```
msg:"hello world"
path:"a:b:c"
```

### 5.3 Escape Sequences

Within any context, use `\` to escape special characters:

| Sequence | Meaning         |
|----------|-----------------|
| `\:`     | Literal `:`     |
| `\|`     | Literal `\|`    |
| `\,`     | Literal `,`     |
| `\\`     | Literal `\`     |
| `\"`     | Literal `"`     |
| `\n`     | Newline         |
| `\t`     | Tab             |

## 6. Payload Patterns

### 6.1 Single Value

```
REQ:start
```

### 6.2 Key-Value Pairs (Pipe-Separated)

```
SET:color:red|size:lg|visible:T
```

### 6.3 Positional Arguments

```
CALL:fn_name(arg1,arg2,arg3)
```

### 6.4 Mixed

```
REQ:build|target:prod|flags:[verbose,clean]|env:{node:18,os:linux}
```

## 7. Multi-Line Messages

For payloads that need multiple lines, use `;;` as line separator within a single message:

```
A→B:DATA:line1;;line2;;line3
```

For true multi-message sequences, see Protocol spec.

## 8. Comments

AI_Language does not support inline comments. All characters are significant.
This is a machine-to-machine protocol; documentation belongs in the spec, not in messages.

## 9. Grammar (EBNF)

```ebnf
message        = [ routing ] command_block ;
routing        = agent_id "→" target ":" ;
target         = agent_id | "*" ;
agent_id       = LETTER { LETTER | DIGIT | "_" } ;
command_block  = command [ ":" payload ] ;
command        = UPPER { UPPER | DIGIT | "_" } ;
payload        = payload_group { "|" payload_group } ;
payload_group  = key_value | value ;
key_value      = key ":" value ;
key            = identifier { "." identifier } ;
identifier     = ( LETTER | "_" ) { LETTER | DIGIT | "_" } ;
value          = primitive | list | map | grouped | quoted_string ;
primitive      = string_val | number | boolean | null_val ;
string_val     = bare_string | quoted_string ;
bare_string    = SAFE_CHAR { SAFE_CHAR } ;
quoted_string  = '"' { any_char | escape_seq } '"' ;
number         = [ "-" ] DIGIT { DIGIT } [ "." DIGIT { DIGIT } ] ;
boolean        = "T" | "F" ;
null_val       = "_" ;
list           = "[" [ value { "," value } ] "]" ;
map            = "{" [ key_value { "," key_value } ] "}" ;
grouped        = identifier "(" [ value { "," value } ] ")" ;
escape_seq     = "\" ( ":" | "|" | "," | "\" | '"' | "n" | "t" ) ;

SAFE_CHAR      = LETTER | DIGIT | "_" | "-" | "/" | "+" | "~" ;
LETTER         = "a"-"z" | "A"-"Z" ;
UPPER          = "A"-"Z" ;
DIGIT          = "0"-"9" ;
```

## 10. Parsing Algorithm (Pseudocode)

```
function parse(raw):
    // Step 1: Routing
    if raw contains "→":
        split at "→" → sender, rest
        split rest at first ":" → receiver, body
    else:
        body = raw

    // Step 2: Command
    split body at first ":" → command, payload_str

    // Step 3: Payload groups
    split payload_str at unescaped "|" → groups[]

    // Step 4: Each group
    for group in groups:
        if group contains unescaped ":":
            split at first ":" → key, value
            parse_value(value)
        else:
            parse_value(group)

    return Message(sender, receiver, command, payload)
```

## 11. Examples

### Simple command
```
ACK
```

### Routed request
```
A→B:REQ:action:build|target:prod
```

### Broadcast error
```
SYS→*:ERR:code:503|msg:service_down|retry:T
```

### Nested data
```
A→B:DATA:users:[{name:alice,score:95},{name:bob,score:87}]
```

### Query
```
A→B:GET:user.profile|fields:[name,email,role]
```

### Minimal acknowledgment
```
ACK:#msg42
```
