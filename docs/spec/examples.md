# AI_Language Examples & Token Comparison v0.1

## 1. Basic Request-Response

### Natural Language (~45 tokens)
> "Agent A, please send a request to Agent B to build the project in production mode and wait for the result."

### AI_Language (~12 tokens)
```
A→B:REQ:action:build|mode:prod
B→A:RES:status:ok|time:4.2s
```

---

## 2. Error Notification with UI Feedback

### Natural Language (~50 tokens)
> "유저가 건물 배치를 요청했는데 자원이 부족해서 불가능하다는 걸 UI에 빨간색 경고 메시지로 3초간 표시하고 사라지게 해줘"

### AI_Language (~15 tokens)
```
A→B:ERR:type:res_lack|UI.WARN:color:red|dur:3s|fade:T
```

---

## 3. Multi-Agent Collaboration: Web App Deployment

### Scenario
3 agents collaborate: `ORCH` (orchestrator), `BUILD` (build agent), `DEPLOY` (deploy agent)

### Natural Language (~180 tokens)
> "오케스트레이터야, 빌드 에이전트한테 프론트엔드 코드를 프로덕션 모드로 빌드하라고 해. 빌드가 끝나면 결과물을 디플로이 에이전트한테 보내서 스테이징 서버에 배포하게 해. 배포가 되면 헬스체크를 하고, 통과하면 프로덕션으로 프로모트해. 실패하면 롤백하고 나한테 알려줘."

### AI_Language (~45 tokens)
```
ORCH→BUILD:DO:task:build|src:frontend|mode:prod
BUILD→ORCH:DONE:task:build|artifact:dist_v42|size:12mb
ORCH→DEPLOY:DO:task:deploy|artifact:dist_v42|target:staging
DEPLOY→ORCH:DONE:task:deploy|url:staging.app.com|health:ok
ORCH→DEPLOY:DO:task:promote|from:staging|to:prod
DEPLOY→ORCH:DONE:task:promote|url:app.com|status:ok
```

Failure path:
```
DEPLOY→ORCH:FAIL:task:deploy|reason:health_check|detail:503
ORCH→DEPLOY:DO:task:rollback|target:staging
DEPLOY→ORCH:DONE:task:rollback|status:ok
ORCH→USER:ERR:op:deploy|msg:health_fail|action:rolled_back
```

---

## 4. Data Pipeline with 4 Agents

### Scenario
`SRC` (data source) → `ETL` (transform) → `ML` (model) → `STORE` (storage)

### Natural Language (~150 tokens)
> "데이터 소스에서 최근 24시간 로그를 가져와서 ETL 에이전트가 정제하고, ML 에이전트가 이상 탐지 모델을 돌린 후, 결과를 스토리지 에이전트가 DB에 저장해. 이상이 발견되면 모든 에이전트에게 알려줘."

### AI_Language (~40 tokens)
```
ORCH→SRC:GET:logs|range:24h|fmt:json
SRC→ETL:DATA:rows:15420|size:8mb|stream:T
ETL→ML:DATA:rows:15000|clean:T|fmt:tensor
ML→STORE:SET:table:anomalies|data:[{ts:1700001,score:0.95},{ts:1700042,score:0.91}]
ML→*:EVT:type:anomaly_detected|cnt:2|max_score:0.95
STORE→ORCH:DONE:task:pipeline|stored:2|table:anomalies
```

---

## 5. Game World: Multi-Agent NPC System

### Scenario
`GM` (game master), `NPC_A`, `NPC_B`, `WORLD` (world state)

### Natural Language (~120 tokens)
> "게임 마스터가 NPC_A한테 좌표 (10,20)으로 이동하라고 명령하고, NPC_B한테는 플레이어를 공격하라고 해. NPC_A가 이동 완료하면 월드 상태를 업데이트하고, NPC_B의 공격 결과(데미지 25, 플레이어 HP 75)도 월드에 반영해."

### AI_Language (~35 tokens)
```
GM→NPC_A:GAME.MOVE:pos:[10,20]
GM→NPC_B:GAME.ATK:target:player|skill:slash
NPC_A→WORLD:GAME.UPDATE:ent:npc_a|pos:[10,20]|status:idle
NPC_B→WORLD:GAME.UPDATE:ent:player|hp:75|dmg:25|src:npc_b
WORLD→GM:SYNC:ctx:{npc_a:{pos:[10,20]},player:{hp:75}}
```

---

## 6. Error Handling Flow

### Natural Language (~80 tokens)
> "A가 B에게 파일을 요청했는데, B가 해당 파일을 찾을 수 없어서 에러를 반환했다. A는 재시도를 3초 후에 하고, 여전히 실패하면 C에게 대체 경로를 요청한다."

### AI_Language (~25 tokens)
```
A→B:GET:file:data.csv
B→A:ERR:code:404|msg:not_found|retry:T|delay:3s
A→B:RETRY:ref:m1|attempt:2
B→A:ERR:code:404|msg:not_found|retry:F
A→C:GET:file:data.csv|fallback:T
C→A:RES:status:ok|data:{...}
```

---

## 7. Session Handshake with Extension Negotiation

### Natural Language (~90 tokens)
> "A가 B에게 세션을 시작하자고 제안하면서 자기는 게임 확장 v2와 ML 확장 v1을 지원한다고 알린다. B는 게임 확장 v1만 지원하므로 v1로 합의하고, ML 확장도 수락한다."

### AI_Language (~20 tokens)
```
A→B:HELLO:v:0.1|sid:s1|ext:[GAME_V2,ML_V1]
B→A:HELLO:v:0.1|sid:s1|ext:[GAME_V1,ML_V1]|compat:{GAME:V1}
A→B:ACK:sid:s1|agreed:{GAME:V1,ML:V1}
```

---

## 8. Streaming Data Transfer

### Natural Language (~60 tokens)
> "A가 B에게 대용량 데이터를 스트림으로 보내는데, 3개의 청크로 나눠서 보내고, 각 청크에 시퀀스 번호를 붙이고, 다 보내면 종료 신호를 보낸다."

### AI_Language (~20 tokens)
```
A→B:STREAM:id:s1|total:3|type:csv
A→B:CHUNK:sid:s1|seq:1|d:[row1,row2,row3]
A→B:CHUNK:sid:s1|seq:2|d:[row4,row5,row6]
A→B:CHUNK:sid:s1|seq:3|d:[row7,row8]
A→B:END:sid:s1|total:8
B→A:ACK:sid:s1|received:8
```

---

## 9. Token Comparison Summary

| Scenario                          | Natural Language (tokens) | AI_Language (tokens) | Reduction |
|-----------------------------------|---------------------------|----------------------|-----------|
| Basic request-response            | ~45                       | ~12                  | **73%**   |
| Error + UI notification           | ~50                       | ~15                  | **70%**   |
| Web deployment (3 agents)         | ~180                      | ~45                  | **75%**   |
| Data pipeline (4 agents)          | ~150                      | ~40                  | **73%**   |
| Game NPC system (4 agents)        | ~120                      | ~35                  | **71%**   |
| Error handling flow               | ~80                       | ~25                  | **69%**   |
| Session + extension negotiation   | ~90                       | ~20                  | **78%**   |
| Streaming data transfer           | ~60                       | ~20                  | **67%**   |
| **Average**                       |                           |                      | **72%**   |

> **Note**: Token counts are estimates. Phase 4 benchmarks will provide exact measurements using tiktoken.

---

## 10. Quick Reference Card

```
# Message format
SENDER→RECEIVER:COMMAND:key:val|key2:val2

# Broadcast
A→*:EVT:type:alert

# Multicast
A→[B,C]:REQ:action:vote

# Types
string    hello, "hello world"
int       42
float     3.14
bool      T, F
null      _
list      [a,b,c]
map       {k:v,k2:v2}

# Core commands
REQ RES GET SET DEL PUT          (CRUD)
ACK NAK PING PONG               (Control)
EVT LOG WARN NOTE                (Events)
ERR FAIL                        (Errors)
DO DONE CANCEL WAIT RETRY       (Tasks)
SUB UNSUB PUB                   (Pub/Sub)
HELLO BYE SYNC META             (Session)
DATA STREAM CHUNK END           (Transfer)
```
