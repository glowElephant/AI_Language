import { describe, it, expect } from 'vitest';
import { encoding_for_model } from 'tiktoken';

const enc = encoding_for_model('gpt-4o');

function countTokens(text: string): number {
  return enc.encode(text).length;
}

interface BenchmarkCase {
  name: string;
  description: string;
  naturalLanguage: string;
  ailLanguage: string;
}

// Key insight: The comparison should be between what an AI agent would actually
// say in natural language vs the AIL equivalent. In real multi-agent systems,
// agents send structured instructions that include all necessary context.
const benchmarkCases: BenchmarkCase[] = [
  {
    name: 'Simple acknowledgment',
    description: 'Acknowledging a previous message',
    naturalLanguage:
      'I acknowledge receipt of your message with ID msg42. The request has been received and understood.',
    ailLanguage: 'ACK:#msg42',
  },
  {
    name: 'Status query',
    description: 'Querying system status',
    naturalLanguage:
      'Please provide me with the current system status including CPU usage, memory usage, and disk usage metrics.',
    ailLanguage: 'GET:sys.status|fields:[cpu,mem,disk]',
  },
  {
    name: 'Status response',
    description: 'Responding with status data',
    naturalLanguage:
      'Here is the current system status you requested. CPU usage is at 45 percent, memory usage is at 72 percent, disk usage is at 31 percent, and overall status is healthy.',
    ailLanguage: 'RES:status:ok|data:{cpu:45,mem:72,disk:31,health:ok}',
  },
  {
    name: 'Error notification',
    description: 'Reporting an error with context',
    naturalLanguage:
      'An error occurred while processing the build operation. The error code is 503 indicating the service is unavailable. The error message is that the service is down. You may retry this request. Please wait 5 seconds before retrying.',
    ailLanguage: 'ERR:code:503|msg:service_down|retry:T|delay:5s',
  },
  {
    name: 'Task assignment',
    description: 'Assigning a build task to an agent',
    naturalLanguage:
      'I need you to execute a build task. The source directory is the frontend folder. Build it in production mode with the verbose and clean flags enabled.',
    ailLanguage: 'DO:task:build|src:frontend|mode:prod|flags:[verbose,clean]',
  },
  {
    name: 'Task completion report',
    description: 'Reporting task completion with results',
    naturalLanguage:
      'The build task has been completed successfully. The output artifact is dist_v42 with a file size of 12 megabytes. The build process took 4.2 seconds to complete.',
    ailLanguage: 'DONE:task:build|artifact:dist_v42|size:12mb|time:4.2s',
  },
  {
    name: 'Configuration update',
    description: 'Setting multiple configuration values',
    naturalLanguage:
      'Please update the following configuration settings: set the theme to dark mode, set the language to Korean, enable notifications, set the timeout value to 30 seconds, and set the maximum retry count to 3.',
    ailLanguage: 'SET:theme:dark|lang:ko|notify:T|timeout:30s|max_retry:3',
  },
  {
    name: 'Data transfer with nested structure',
    description: 'Sending structured user data',
    naturalLanguage:
      'Here is the user data you requested. There are two users. The first user is named Alice with admin role and a score of 95. The second user is named Bob with user role and a score of 87.',
    ailLanguage: 'DATA:users:[{name:alice,role:admin,score:95},{name:bob,role:user,score:87}]',
  },
  {
    name: 'Subscription request',
    description: 'Subscribing to event topics',
    naturalLanguage:
      'I would like to subscribe to the following event topics: build status updates, deployment status updates, and system alerts. Please send me notifications whenever these events occur.',
    ailLanguage: 'SUB:topics:[build.status,deploy.status,sys.alerts]',
  },
  {
    name: 'Multi-step pipeline instruction',
    description: 'Instructing a complex pipeline',
    naturalLanguage:
      'Execute the following data processing pipeline: First, fetch logs from the last 24 hours in JSON format. Then clean and validate the data, removing any null entries. Next, run the anomaly detection model version 2 on the cleaned data. Finally, store the results in the anomalies table in the database and notify me when complete.',
    ailLanguage: 'DO:task:pipeline|steps:[{op:fetch,src:logs,range:24h,fmt:json},{op:clean,rm_null:T},{op:detect,model:anomaly_v2},{op:store,table:anomalies}]|notify:T',
  },
];

describe('Token Efficiency Benchmark', () => {
  const results: Array<{
    name: string;
    nlTokens: number;
    ailTokens: number;
    reduction: number;
  }> = [];

  for (const tc of benchmarkCases) {
    it(`${tc.name}: AIL should use fewer tokens`, () => {
      const nlTokens = countTokens(tc.naturalLanguage);
      const ailTokens = countTokens(tc.ailLanguage);
      const reduction = (1 - ailTokens / nlTokens) * 100;

      results.push({ name: tc.name, nlTokens, ailTokens, reduction });

      // AI_Language should use fewer tokens than natural language
      expect(ailTokens).toBeLessThan(nlTokens);
    });
  }

  it('should print benchmark summary and achieve overall savings', () => {
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  AI_Language Token Efficiency Benchmark (GPT-4o tokenizer)');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(
      `${'Scenario'.padEnd(42)} ${'NL'.padStart(5)} ${'AIL'.padStart(5)} ${'Saved'.padStart(7)}`
    );
    console.log('───────────────────────────────────────────────────────────────');

    let totalNl = 0;
    let totalAil = 0;

    for (const r of results) {
      const pct = r.reduction.toFixed(1) + '%';
      console.log(
        `${r.name.padEnd(42)} ${String(r.nlTokens).padStart(5)} ${String(r.ailTokens).padStart(5)} ${pct.padStart(7)}`
      );
      totalNl += r.nlTokens;
      totalAil += r.ailTokens;
    }

    const avgReduction = ((1 - totalAil / totalNl) * 100).toFixed(1);
    console.log('───────────────────────────────────────────────────────────────');
    console.log(
      `${'OVERALL'.padEnd(42)} ${String(totalNl).padStart(5)} ${String(totalAil).padStart(5)} ${(avgReduction + '%').padStart(7)}`
    );
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Overall should achieve meaningful reduction
    expect(totalAil).toBeLessThan(totalNl);
  });
});
