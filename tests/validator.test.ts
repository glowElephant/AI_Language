import { describe, it, expect } from 'vitest';
import { validate } from '../src/validator';

describe('Validator', () => {
  describe('syntax validation', () => {
    it('should validate correct messages', () => {
      expect(validate('ACK').valid).toBe(true);
      expect(validate('A→B:REQ:action:build').valid).toBe(true);
      expect(validate('SYS→*:EVT:type:shutdown').valid).toBe(true);
    });

    it('should catch syntax errors', () => {
      const result = validate('A→');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Syntax error');
    });
  });

  describe('routing validation', () => {
    it('should warn on same sender and receiver', () => {
      const result = validate('A→A:PING');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('same');
    });
  });

  describe('command validation (strict mode)', () => {
    it('should accept built-in commands in strict mode', () => {
      const result = validate('REQ:action:build', { strictCommands: true });
      expect(result.valid).toBe(true);
    });

    it('should reject unknown commands in strict mode', () => {
      const result = validate('FOOBAR:data:test', { strictCommands: true });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Unknown command');
    });

    it('should accept custom commands when provided', () => {
      const result = validate('DEPLOY:target:prod', {
        strictCommands: true,
        customCommands: new Set(['DEPLOY']),
      });
      expect(result.valid).toBe(true);
    });

    it('should accept namespaced commands even in strict mode', () => {
      const result = validate('GAME.SPAWN:entity:npc', { strictCommands: true });
      expect(result.valid).toBe(true);
    });

    it('should reject reserved namespace usage', () => {
      const result = validate('SYS.CUSTOM:data:x', { strictCommands: true });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('reserved');
    });
  });

  describe('payload validation', () => {
    it('should catch duplicate keys', () => {
      const result = validate('SET:color:red|color:blue');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Duplicate');
    });

    it('should allow unique keys', () => {
      const result = validate('SET:color:red|size:lg');
      expect(result.valid).toBe(true);
    });
  });

  describe('complex valid messages', () => {
    it('should validate complex real-world messages', () => {
      expect(
        validate('A→B:REQ:action:build|target:prod|flags:[verbose,clean]|env:{node:18,os:linux}').valid
      ).toBe(true);

      expect(
        validate('SYS→*:ERR:code:503|msg:service_down|retry:T').valid
      ).toBe(true);

      expect(
        validate('A→[B,C,D]:REQ:action:vote|topic:deploy').valid
      ).toBe(true);

      expect(
        validate('DATA:users:[{name:alice,score:95},{name:bob,score:87}]').valid
      ).toBe(true);
    });
  });
});
