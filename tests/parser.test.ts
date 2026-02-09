import { describe, it, expect } from 'vitest';
import { parse } from '../src/parser';

describe('Parser', () => {
  describe('minimal messages', () => {
    it('should parse a bare command', () => {
      const msg = parse('ACK');
      expect(msg.routing).toBeNull();
      expect(msg.command.command).toBe('ACK');
      expect(msg.command.payload).toBeNull();
    });

    it('should parse command with single value payload', () => {
      const msg = parse('REQ:start');
      expect(msg.command.command).toBe('REQ');
      expect(msg.command.payload!.groups).toHaveLength(1);
      expect(msg.command.payload!.groups[0].entry).toEqual({
        kind: 'String',
        value: 'start',
      });
    });
  });

  describe('routing', () => {
    it('should parse unicast routing', () => {
      const msg = parse('A→B:PING');
      expect(msg.routing!.sender).toBe('A');
      expect(msg.routing!.receiver).toEqual({ type: 'single', id: 'B' });
      expect(msg.command.command).toBe('PING');
    });

    it('should parse broadcast routing', () => {
      const msg = parse('SYS→*:EVT:type:shutdown');
      expect(msg.routing!.sender).toBe('SYS');
      expect(msg.routing!.receiver).toEqual({ type: 'broadcast' });
    });

    it('should parse multicast routing', () => {
      const msg = parse('A→[B,C,D]:REQ:action:vote');
      expect(msg.routing!.receiver).toEqual({
        type: 'multicast',
        ids: ['B', 'C', 'D'],
      });
    });

    it('should parse anycast routing', () => {
      const msg = parse('A→<WORKERS>:DO:task:render');
      expect(msg.routing!.receiver).toEqual({
        type: 'anycast',
        group: 'WORKERS',
      });
    });
  });

  describe('payload: key-value pairs', () => {
    it('should parse single key-value', () => {
      const msg = parse('SET:color:red');
      const groups = msg.command.payload!.groups;
      expect(groups).toHaveLength(1);
      expect(groups[0].entry).toEqual({
        kind: 'KeyValue',
        key: 'color',
        value: { kind: 'String', value: 'red' },
      });
    });

    it('should parse multiple pipe-separated key-values', () => {
      const msg = parse('SET:color:red|size:lg|visible:T');
      const groups = msg.command.payload!.groups;
      expect(groups).toHaveLength(3);
      expect(groups[2].entry).toEqual({
        kind: 'KeyValue',
        key: 'visible',
        value: { kind: 'Boolean', value: true },
      });
    });

    it('should parse dotted keys', () => {
      const msg = parse('GET:user.profile:name');
      const groups = msg.command.payload!.groups;
      expect(groups[0].entry).toEqual({
        kind: 'KeyValue',
        key: 'user.profile',
        value: { kind: 'String', value: 'name' },
      });
    });
  });

  describe('payload: data types', () => {
    it('should parse numbers', () => {
      const msg = parse('SET:count:42');
      const entry = msg.command.payload!.groups[0].entry;
      expect(entry).toEqual({
        kind: 'KeyValue',
        key: 'count',
        value: { kind: 'Number', value: 42 },
      });
    });

    it('should parse floats', () => {
      const msg = parse('SET:rate:3.14');
      const entry = msg.command.payload!.groups[0].entry;
      expect(entry).toEqual({
        kind: 'KeyValue',
        key: 'rate',
        value: { kind: 'Number', value: 3.14 },
      });
    });

    it('should parse booleans', () => {
      const msg = parse('SET:active:T');
      const entry = msg.command.payload!.groups[0].entry;
      expect(entry).toEqual({
        kind: 'KeyValue',
        key: 'active',
        value: { kind: 'Boolean', value: true },
      });
    });

    it('should parse null', () => {
      const msg = parse('SET:data:_');
      const entry = msg.command.payload!.groups[0].entry;
      expect(entry).toEqual({
        kind: 'KeyValue',
        key: 'data',
        value: { kind: 'Null' },
      });
    });

    it('should parse quoted strings', () => {
      const msg = parse('SET:msg:"hello world"');
      const entry = msg.command.payload!.groups[0].entry;
      expect(entry).toEqual({
        kind: 'KeyValue',
        key: 'msg',
        value: { kind: 'String', value: 'hello world' },
      });
    });

    it('should parse references', () => {
      const msg = parse('ACK:#msg42');
      const group = msg.command.payload!.groups[0].entry;
      expect(group).toEqual({ kind: 'Reference', id: 'msg42' });
    });
  });

  describe('payload: compound types', () => {
    it('should parse lists', () => {
      const msg = parse('SET:tags:[a,b,c]');
      const entry = msg.command.payload!.groups[0].entry as any;
      expect(entry.value.kind).toBe('List');
      expect(entry.value.items).toHaveLength(3);
      expect(entry.value.items[0]).toEqual({ kind: 'String', value: 'a' });
    });

    it('should parse maps', () => {
      const msg = parse('SET:env:{node:18,os:linux}');
      const entry = msg.command.payload!.groups[0].entry as any;
      expect(entry.value.kind).toBe('Map');
      expect(entry.value.entries).toHaveLength(2);
    });

    it('should parse nested structures', () => {
      const msg = parse('DATA:users:[{name:alice,score:95},{name:bob,score:87}]');
      const entry = msg.command.payload!.groups[0].entry as any;
      expect(entry.value.kind).toBe('List');
      expect(entry.value.items[0].kind).toBe('Map');
    });

    it('should parse grouped values (function-like)', () => {
      const msg = parse('CALL:fn(1,2,3)');
      const group = msg.command.payload!.groups[0].entry as any;
      expect(group.kind).toBe('Grouped');
      expect(group.name).toBe('fn');
      expect(group.args).toHaveLength(3);
    });
  });

  describe('namespaced commands', () => {
    it('should parse dotted command names', () => {
      const msg = parse('GAME.SPAWN:entity:npc');
      expect(msg.command.command).toBe('GAME.SPAWN');
    });
  });

  describe('complex real-world messages', () => {
    it('should parse a full routed request with mixed payload', () => {
      const msg = parse('A→B:REQ:action:build|target:prod|flags:[verbose,clean]|env:{node:18,os:linux}');
      expect(msg.routing!.sender).toBe('A');
      expect(msg.routing!.receiver).toEqual({ type: 'single', id: 'B' });
      expect(msg.command.command).toBe('REQ');
      expect(msg.command.payload!.groups).toHaveLength(4);
    });

    it('should parse broadcast error', () => {
      const msg = parse('SYS→*:ERR:code:503|msg:service_down|retry:T');
      expect(msg.routing!.receiver).toEqual({ type: 'broadcast' });
      expect(msg.command.command).toBe('ERR');
      const groups = msg.command.payload!.groups;
      expect(groups).toHaveLength(3);
    });

    it('should parse with duration values', () => {
      const msg = parse('SET:dur:3s|delay:500ms');
      const groups = msg.command.payload!.groups;
      expect(groups).toHaveLength(2);
      // 3s is tokenized as IDENTIFIER, so it becomes a String value
      const durEntry = groups[0].entry as any;
      expect(durEntry.value).toEqual({ kind: 'String', value: '3s' });
    });

    it('should parse empty list', () => {
      const msg = parse('SET:items:[]');
      const entry = msg.command.payload!.groups[0].entry as any;
      expect(entry.value).toEqual({ kind: 'List', items: [] });
    });

    it('should parse empty map', () => {
      const msg = parse('SET:data:{}');
      const entry = msg.command.payload!.groups[0].entry as any;
      expect(entry.value).toEqual({ kind: 'Map', entries: [] });
    });
  });

  describe('error handling', () => {
    it('should throw on unexpected token', () => {
      expect(() => parse('A→B')).toThrow(); // missing colon and command after routing
    });

    it('should throw on empty input', () => {
      expect(() => parse('')).toThrow();
    });
  });
});
