import {TokenCollector} from '../src/core/TokenCollector'

describe('TokenCollector', () => {
  it('resets correctly', () => {
    const tc = new TokenCollector();

    tc.found('a');
    tc.found('b');
    tc.consume();

    tc.reset();

    expect(() => tc.consume()).toThrowError('queue empty');
  });

  it('hasMoreTokens', () => {
    const tc = new TokenCollector();

    expect(tc.hasMoreTokens()).toBe(false);
    tc.found('aa');
    expect(tc.hasMoreTokens()).toBe(true);
    tc.consume();
    expect(tc.hasMoreTokens()).toBe(false);
  });

  it('consumes and finds correctly', () => {
    const tc = new TokenCollector();

    expect(() => tc.consume()).toThrowError('queue empty');

    tc.found('aa')
    expect(tc.consume()).toBe('aa');
    expect(() => tc.consume()).toThrowError('queue empty');
    tc.found('aa')
    expect(() => tc.consume()).toThrowError('queue empty');
    tc.found('bb');
    tc.found('cc');
    expect(tc.consume()).toBe('cc');
    expect(tc.consume()).toBe('bb');
    expect(() => tc.consume()).toThrowError('queue empty');
  });
})
