/**
 * AI_Language Multi-Agent Demo: Deployment Pipeline
 *
 * 3 agents collaborate using AI_Language to deploy an application:
 *   - ORCH: Orchestrator — coordinates the pipeline
 *   - BUILD: Build Agent — compiles the application
 *   - DEPLOY: Deploy Agent — handles deployment
 *
 * Run: npx tsx demo/deploy-pipeline.ts
 */

import { Agent, Router } from '../src/runtime';
import { AILMessage } from '../src/types';
import { encode } from '../src/encoder';

// ── Formatting helpers ──

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const AGENT_COLORS: Record<string, string> = {
  ORCH: COLORS.cyan,
  BUILD: COLORS.yellow,
  DEPLOY: COLORS.magenta,
};

function logMessage(raw: string, msg: AILMessage, natural: string) {
  const senderColor = AGENT_COLORS[msg.sender ?? ''] ?? COLORS.reset;
  const prefix = `${senderColor}${COLORS.bold}[${msg.sender}]${COLORS.reset}`;
  console.log(`${prefix} ${COLORS.dim}AIL:${COLORS.reset}  ${raw}`);
  console.log(`${prefix} ${COLORS.dim}NL:${COLORS.reset}   ${natural}`);
  console.log();
}

// ── Step simulation with delays ──

function step(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Main Demo ──

async function main() {
  console.log(`\n${COLORS.bold}═══════════════════════════════════════════════════════════${COLORS.reset}`);
  console.log(`${COLORS.bold}  AI_Language Demo: 3-Agent Deployment Pipeline${COLORS.reset}`);
  console.log(`${COLORS.bold}═══════════════════════════════════════════════════════════${COLORS.reset}\n`);

  const router = new Router();

  // ── Create agents ──
  const orch = new Agent({ id: 'ORCH' });
  const build = new Agent({ id: 'BUILD' });
  const deploy = new Agent({ id: 'DEPLOY' });

  router.register(orch);
  router.register(build);
  router.register(deploy);

  // ── BUILD agent handler ──
  build.onMessage(async (msg: AILMessage) => {
    if (msg.command === 'DO' && msg.payload?.task === 'build') {
      await step(300);
      const response: AILMessage = {
        sender: 'BUILD',
        receiver: { type: 'single', id: 'ORCH' },
        command: 'DONE',
        payload: {
          task: 'build',
          artifact: 'dist_v42',
          size: '12mb',
          time: '4.2s',
        },
      };
      const raw = encode(response);
      logMessage(raw, response, 'Build completed. Artifact: dist_v42 (12mb), took 4.2s.');
      build.send(response);
    }
  });

  // ── DEPLOY agent handler ──
  deploy.onMessage(async (msg: AILMessage) => {
    if (msg.command === 'DO' && msg.payload?.task === 'deploy') {
      await step(200);
      const response: AILMessage = {
        sender: 'DEPLOY',
        receiver: { type: 'single', id: 'ORCH' },
        command: 'DONE',
        payload: {
          task: 'deploy',
          url: 'staging.app.com',
          health: 'ok',
        },
      };
      const raw = encode(response);
      logMessage(raw, response, 'Deployed to staging.app.com. Health check passed.');
      deploy.send(response);
    }

    if (msg.command === 'DO' && msg.payload?.task === 'promote') {
      await step(200);
      const response: AILMessage = {
        sender: 'DEPLOY',
        receiver: { type: 'single', id: 'ORCH' },
        command: 'DONE',
        payload: {
          task: 'promote',
          url: 'app.com',
          status: 'ok',
        },
      };
      const raw = encode(response);
      logMessage(raw, response, 'Promoted to production at app.com. Status: OK.');
      deploy.send(response);
    }
  });

  // ── Pipeline execution ──

  // Step 1: ORCH → BUILD: build frontend
  console.log(`${COLORS.green}--- Step 1: Initiate Build ---${COLORS.reset}\n`);
  {
    const msg: AILMessage = {
      sender: 'ORCH',
      receiver: { type: 'single', id: 'BUILD' },
      command: 'DO',
      payload: { task: 'build', src: 'frontend', mode: 'prod' },
    };
    const raw = encode(msg);
    logMessage(raw, msg, 'Build the frontend in production mode.');
    orch.send(msg);
  }

  await step(500);

  // Step 2: ORCH → DEPLOY: deploy to staging
  console.log(`${COLORS.green}--- Step 2: Deploy to Staging ---${COLORS.reset}\n`);
  {
    const msg: AILMessage = {
      sender: 'ORCH',
      receiver: { type: 'single', id: 'DEPLOY' },
      command: 'DO',
      payload: { task: 'deploy', artifact: 'dist_v42', target: 'staging' },
    };
    const raw = encode(msg);
    logMessage(raw, msg, 'Deploy artifact dist_v42 to staging environment.');
    orch.send(msg);
  }

  await step(400);

  // Step 3: ORCH → DEPLOY: promote to production
  console.log(`${COLORS.green}--- Step 3: Promote to Production ---${COLORS.reset}\n`);
  {
    const msg: AILMessage = {
      sender: 'ORCH',
      receiver: { type: 'single', id: 'DEPLOY' },
      command: 'DO',
      payload: { task: 'promote', from: 'staging', to: 'prod' },
    };
    const raw = encode(msg);
    logMessage(raw, msg, 'Promote staging deployment to production.');
    orch.send(msg);
  }

  await step(400);

  // Step 4: ORCH → *: broadcast completion
  console.log(`${COLORS.green}--- Step 4: Broadcast Completion ---${COLORS.reset}\n`);
  {
    const msg: AILMessage = {
      sender: 'ORCH',
      receiver: { type: 'broadcast' },
      command: 'EVT',
      payload: { type: 'deploy_complete', url: 'app.com', version: 'v42' },
    };
    const raw = encode(msg);
    logMessage(raw, msg, 'Deployment complete! App is live at app.com, version v42.');
    orch.send(msg);
  }

  // ── Summary ──
  console.log(`\n${COLORS.bold}═══════════════════════════════════════════════════════════${COLORS.reset}`);
  console.log(`${COLORS.bold}  Communication Log Summary${COLORS.reset}`);
  console.log(`${COLORS.bold}═══════════════════════════════════════════════════════════${COLORS.reset}`);

  const log = router.getLog();
  console.log(`  Total messages routed: ${log.length}`);
  console.log(`  Agents involved: ORCH, BUILD, DEPLOY`);
  console.log();

  let totalChars = 0;
  for (const entry of log) {
    totalChars += entry.raw.length;
  }
  console.log(`  Total AI_Language characters transmitted: ${totalChars}`);
  console.log(`  Average message length: ${(totalChars / log.length).toFixed(1)} chars`);
  console.log();
}

main().catch(console.error);
