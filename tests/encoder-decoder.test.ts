import { describe, it, expect } from 'vitest';
import { encode } from '../src/encoder';
import { decode } from '../src/decoder';
import { AILMessage } from '../src/types';

describe('Encoder', () => {
  it('should encode a minimal command', () => {
    expect(encode({ command: 'ACK' })).toBe('ACK');
  });

  it('should encode with routing', () => {
    const msg: AILMessage = {
      sender: 'A',
      receiver: { type: 'single', id: 'B' },
      command: 'PING',
    };
    expect(encode(msg)).toBe('A→B:PING');
  });

  it('should encode broadcast', () => {
    const msg: AILMessage = {
      sender: 'SYS',
      receiver: { type: 'broadcast' },
      command: 'EVT',
      payload: { type: 'shutdown' },
    };
    expect(encode(msg)).toBe('SYS→*:EVT:type:shutdown');
  });

  it('should encode multicast', () => {
    const msg: AILMessage = {
      sender: 'A',
      receiver: { type: 'multicast', ids: ['B', 'C'] },
      command: 'REQ',
    };
    expect(encode(msg)).toBe('A→[B,C]:REQ');
  });

  it('should encode anycast', () => {
    const msg: AILMessage = {
      sender: 'A',
      receiver: { type: 'anycast', group: 'WORKERS' },
      command: 'DO',
    };
    expect(encode(msg)).toBe('A→<WORKERS>:DO');
  });

  it('should encode payload with multiple key-value pairs', () => {
    const msg: AILMessage = {
      command: 'SET',
      payload: { color: 'red', size: 'lg', visible: true },
    };
    expect(encode(msg)).toBe('SET:color:red|size:lg|visible:T');
  });

  it('should encode numbers', () => {
    const msg: AILMessage = {
      command: 'SET',
      payload: { count: 42, rate: 3.14 },
    };
    expect(encode(msg)).toBe('SET:count:42|rate:3.14');
  });

  it('should encode null and booleans', () => {
    const msg: AILMessage = {
      command: 'SET',
      payload: { data: null, active: false },
    };
    expect(encode(msg)).toBe('SET:data:_|active:F');
  });

  it('should encode lists', () => {
    const msg: AILMessage = {
      command: 'SET',
      payload: { tags: ['a', 'b', 'c'] },
    };
    expect(encode(msg)).toBe('SET:tags:[a,b,c]');
  });

  it('should encode maps', () => {
    const msg: AILMessage = {
      command: 'SET',
      payload: { env: { node: 18, os: 'linux' } },
    };
    expect(encode(msg)).toBe('SET:env:{node:18,os:linux}');
  });

  it('should quote strings with special chars', () => {
    const msg: AILMessage = {
      command: 'SET',
      payload: { msg: 'hello world' },
    };
    expect(encode(msg)).toBe('SET:msg:"hello world"');
  });

  it('should quote strings that look like booleans', () => {
    const msg: AILMessage = {
      command: 'SET',
      payload: { val: 'T' },
    };
    expect(encode(msg)).toBe('SET:val:"T"');
  });

  it('should encode nested structures', () => {
    const msg: AILMessage = {
      command: 'DATA',
      payload: {
        users: [
          { name: 'alice', score: 95 },
          { name: 'bob', score: 87 },
        ],
      },
    };
    const encoded = encode(msg);
    expect(encoded).toBe('DATA:users:[{name:alice,score:95},{name:bob,score:87}]');
  });
});

describe('Decoder', () => {
  it('should decode a minimal command', () => {
    const msg = decode('ACK');
    expect(msg.command).toBe('ACK');
    expect(msg.sender).toBeUndefined();
    expect(msg.payload).toBeUndefined();
  });

  it('should decode routing', () => {
    const msg = decode('A→B:PING');
    expect(msg.sender).toBe('A');
    expect(msg.receiver).toEqual({ type: 'single', id: 'B' });
    expect(msg.command).toBe('PING');
  });

  it('should decode payload key-value pairs', () => {
    const msg = decode('SET:color:red|size:lg|visible:T');
    expect(msg.payload).toEqual({
      color: 'red',
      size: 'lg',
      visible: true,
    });
  });

  it('should decode lists', () => {
    const msg = decode('SET:tags:[a,b,c]');
    expect(msg.payload!.tags).toEqual(['a', 'b', 'c']);
  });

  it('should decode maps', () => {
    const msg = decode('SET:env:{node:18,os:linux}');
    expect(msg.payload!.env).toEqual({ node: 18, os: 'linux' });
  });

  it('should decode nested structures', () => {
    const msg = decode('DATA:users:[{name:alice,score:95},{name:bob,score:87}]');
    expect(msg.payload!.users).toEqual([
      { name: 'alice', score: 95 },
      { name: 'bob', score: 87 },
    ]);
  });

  it('should decode broadcast', () => {
    const msg = decode('SYS→*:ERR:code:503|msg:service_down');
    expect(msg.receiver).toEqual({ type: 'broadcast' });
    expect(msg.payload).toEqual({ code: 503, msg: 'service_down' });
  });

  it('should decode references', () => {
    const msg = decode('ACK:#msg42');
    expect(msg.payload!._0).toBe('#msg42');
  });
});

describe('Roundtrip: encode → decode', () => {
  const cases: [string, AILMessage][] = [
    ['minimal', { command: 'ACK' }],
    [
      'routed',
      {
        sender: 'A',
        receiver: { type: 'single', id: 'B' },
        command: 'REQ',
        payload: { action: 'build', target: 'prod' },
      },
    ],
    [
      'broadcast with payload',
      {
        sender: 'SYS',
        receiver: { type: 'broadcast' },
        command: 'EVT',
        payload: { type: 'shutdown' },
      },
    ],
    [
      'with list and map',
      {
        command: 'SET',
        payload: {
          flags: ['verbose', 'clean'],
          env: { node: 18, os: 'linux' },
        },
      },
    ],
    [
      'with null and booleans',
      {
        command: 'SET',
        payload: { data: null, active: true, debug: false },
      },
    ],
    [
      'nested list of maps',
      {
        command: 'DATA',
        payload: {
          users: [
            { name: 'alice', score: 95 },
            { name: 'bob', score: 87 },
          ],
        },
      },
    ],
  ];

  for (const [name, original] of cases) {
    it(`should roundtrip: ${name}`, () => {
      const encoded = encode(original);
      const decoded = decode(encoded);

      expect(decoded.command).toBe(original.command);
      expect(decoded.sender).toBe(original.sender);

      if (original.receiver) {
        expect(decoded.receiver).toEqual(original.receiver);
      }

      if (original.payload) {
        expect(decoded.payload).toEqual(original.payload);
      }
    });
  }
});
