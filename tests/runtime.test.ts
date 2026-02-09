import { describe, it, expect } from 'vitest';
import { Agent, Router, SessionManager } from '../src/runtime';
import { AILMessage } from '../src/types';

describe('Agent', () => {
  it('should create an agent with an ID', () => {
    const agent = new Agent({ id: 'A' });
    expect(agent.id).toBe('A');
  });

  it('should log sent and received messages', () => {
    const router = new Router();
    const a = new Agent({ id: 'A' });
    const b = new Agent({ id: 'B', onMessage: () => {} });
    router.register(a);
    router.register(b);

    a.send({ receiver: { type: 'single', id: 'B' }, command: 'PING' });

    expect(a.getLog()).toHaveLength(1);
    expect(a.getLog()[0].direction).toBe('out');
    expect(b.getLog()).toHaveLength(1);
    expect(b.getLog()[0].direction).toBe('in');
  });
});

describe('Router', () => {
  describe('unicast', () => {
    it('should deliver messages to a specific agent', () => {
      const router = new Router();
      const a = new Agent({ id: 'A' });
      const b = new Agent({ id: 'B' });
      const received: AILMessage[] = [];

      b.onMessage((msg) => received.push(msg));
      router.register(a);
      router.register(b);

      a.send({
        receiver: { type: 'single', id: 'B' },
        command: 'REQ',
        payload: { action: 'build' },
      });

      expect(received).toHaveLength(1);
      expect(received[0].command).toBe('REQ');
      expect(received[0].payload!.action).toBe('build');
    });
  });

  describe('broadcast', () => {
    it('should deliver to all agents except sender', () => {
      const router = new Router();
      const a = new Agent({ id: 'A' });
      const b = new Agent({ id: 'B' });
      const c = new Agent({ id: 'C' });
      const bReceived: AILMessage[] = [];
      const cReceived: AILMessage[] = [];

      b.onMessage((msg) => bReceived.push(msg));
      c.onMessage((msg) => cReceived.push(msg));
      router.register(a);
      router.register(b);
      router.register(c);

      a.send({
        receiver: { type: 'broadcast' },
        command: 'EVT',
        payload: { type: 'shutdown' },
      });

      expect(bReceived).toHaveLength(1);
      expect(cReceived).toHaveLength(1);
    });
  });

  describe('multicast', () => {
    it('should deliver to specified agents only', () => {
      const router = new Router();
      const a = new Agent({ id: 'A' });
      const b = new Agent({ id: 'B' });
      const c = new Agent({ id: 'C' });
      const d = new Agent({ id: 'D' });
      const bReceived: AILMessage[] = [];
      const cReceived: AILMessage[] = [];
      const dReceived: AILMessage[] = [];

      b.onMessage((msg) => bReceived.push(msg));
      c.onMessage((msg) => cReceived.push(msg));
      d.onMessage((msg) => dReceived.push(msg));
      router.register(a);
      router.register(b);
      router.register(c);
      router.register(d);

      a.send({
        receiver: { type: 'multicast', ids: ['B', 'C'] },
        command: 'REQ',
        payload: { action: 'vote' },
      });

      expect(bReceived).toHaveLength(1);
      expect(cReceived).toHaveLength(1);
      expect(dReceived).toHaveLength(0);
    });
  });

  describe('anycast', () => {
    it('should deliver to one agent from a group (round-robin)', () => {
      const router = new Router();
      const a = new Agent({ id: 'A' });
      const w1 = new Agent({ id: 'W1' });
      const w2 = new Agent({ id: 'W2' });
      const w1Received: AILMessage[] = [];
      const w2Received: AILMessage[] = [];

      w1.onMessage((msg) => w1Received.push(msg));
      w2.onMessage((msg) => w2Received.push(msg));
      router.register(a);
      router.register(w1);
      router.register(w2);
      router.createGroup('WORKERS', ['W1', 'W2']);

      // First message → W1
      a.send({
        receiver: { type: 'anycast', group: 'WORKERS' },
        command: 'DO',
        payload: { task: 'job1' },
      });

      // Second message → W2
      a.send({
        receiver: { type: 'anycast', group: 'WORKERS' },
        command: 'DO',
        payload: { task: 'job2' },
      });

      expect(w1Received).toHaveLength(1);
      expect(w2Received).toHaveLength(1);
      expect(w1Received[0].payload!.task).toBe('job1');
      expect(w2Received[0].payload!.task).toBe('job2');
    });
  });

  describe('raw send', () => {
    it('should parse and route raw AI_Language strings', () => {
      const router = new Router();
      const a = new Agent({ id: 'A' });
      const b = new Agent({ id: 'B' });
      const received: AILMessage[] = [];

      b.onMessage((msg) => received.push(msg));
      router.register(a);
      router.register(b);

      router.send('A→B:REQ:action:build|target:prod', 'A');

      expect(received).toHaveLength(1);
      expect(received[0].command).toBe('REQ');
      expect(received[0].payload!.target).toBe('prod');
    });
  });

  describe('logging', () => {
    it('should log all routed messages', () => {
      const router = new Router();
      const a = new Agent({ id: 'A' });
      const b = new Agent({ id: 'B' });
      router.register(a);
      router.register(b);

      a.send({ receiver: { type: 'single', id: 'B' }, command: 'PING' });
      b.send({ receiver: { type: 'single', id: 'A' }, command: 'PONG' });

      const log = router.getLog();
      expect(log).toHaveLength(2);
      expect(log[0].from).toBe('A');
      expect(log[0].to).toBe('B');
      expect(log[1].from).toBe('B');
      expect(log[1].to).toBe('A');
    });
  });

  describe('registration', () => {
    it('should throw on duplicate registration', () => {
      const router = new Router();
      const a = new Agent({ id: 'A' });
      router.register(a);
      expect(() => router.register(new Agent({ id: 'A' }))).toThrow('already registered');
    });

    it('should support unregistration', () => {
      const router = new Router();
      const a = new Agent({ id: 'A' });
      router.register(a);
      router.unregister('A');
      expect(router.getAgentIds()).toEqual([]);
    });
  });
});

describe('SessionManager', () => {
  it('should create and retrieve sessions', () => {
    const sm = new SessionManager();
    const session = sm.create('s1');
    expect(session.id).toBe('s1');
    expect(sm.get('s1')).toBe(session);
  });

  it('should manage session context', () => {
    const sm = new SessionManager();
    const session = sm.create('s1');

    session.setContext('project', 'alpha');
    session.setContext('env', 'prod');

    expect(session.getContextValue('project')).toBe('alpha');
    expect(session.getContext()).toEqual({ project: 'alpha', env: 'prod' });
  });

  it('should merge context', () => {
    const sm = new SessionManager();
    const session = sm.create('s1');
    session.setContext('a', 1);
    session.mergeContext({ b: 2, c: 3 });
    expect(session.getContext()).toEqual({ a: 1, b: 2, c: 3 });
  });

  it('should delete context keys', () => {
    const sm = new SessionManager();
    const session = sm.create('s1');
    session.setContext('a', 1);
    expect(session.deleteContext('a')).toBe(true);
    expect(session.getContextValue('a')).toBeUndefined();
  });

  it('should handle session expiry', async () => {
    const sm = new SessionManager();
    sm.create('s1', { ttl: 50 }); // 50ms TTL

    expect(sm.get('s1')).toBeDefined();

    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(sm.get('s1')).toBeUndefined();
  });

  it('should cleanup expired sessions', async () => {
    const sm = new SessionManager();
    sm.create('s1', { ttl: 50 });
    sm.create('s2'); // no expiry

    await new Promise((resolve) => setTimeout(resolve, 60));

    const removed = sm.cleanup();
    expect(removed).toBe(1);
    expect(sm.getActiveIds()).toEqual(['s2']);
  });

  it('should throw on duplicate session creation', () => {
    const sm = new SessionManager();
    sm.create('s1');
    expect(() => sm.create('s1')).toThrow('already exists');
  });

  it('should getOrCreate sessions', () => {
    const sm = new SessionManager();
    const s1 = sm.getOrCreate('s1');
    const s2 = sm.getOrCreate('s1');
    expect(s1).toBe(s2);
  });
});
