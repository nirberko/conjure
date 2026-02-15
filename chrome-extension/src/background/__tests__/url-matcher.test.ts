import { matchUrlPattern } from '../url-matcher.js';
import { describe, it, expect } from 'vitest';

describe('matchUrlPattern', () => {
  it('matches exact URLs', () => {
    expect(matchUrlPattern('https://example.com', 'https://example.com')).toBe(true);
  });

  it('rejects non-matching exact URLs', () => {
    expect(matchUrlPattern('https://example.com', 'https://other.com')).toBe(false);
  });

  it('matches wildcard * for any characters', () => {
    expect(matchUrlPattern('https://example.com/*', 'https://example.com/path/to/page')).toBe(true);
    expect(matchUrlPattern('https://example.com/*', 'https://example.com/')).toBe(true);
  });

  it('matches * at beginning', () => {
    expect(matchUrlPattern('*://example.com/*', 'https://example.com/page')).toBe(true);
    expect(matchUrlPattern('*://example.com/*', 'http://example.com/page')).toBe(true);
  });

  it('matches broad wildcard patterns', () => {
    expect(matchUrlPattern('https://example.com/page*', 'https://example.com/page1')).toBe(true);
    expect(matchUrlPattern('https://example.com/page*', 'https://example.com/pageAB')).toBe(true);
    expect(matchUrlPattern('https://example.com/page*', 'https://example.com/other')).toBe(false);
  });

  it('handles special regex characters in pattern', () => {
    // Dots should be literal
    expect(matchUrlPattern('https://example.com', 'https://exampleXcom')).toBe(false);
  });

  it('matches subdomain wildcard', () => {
    expect(matchUrlPattern('https://*.example.com/*', 'https://app.example.com/dashboard')).toBe(true);
    expect(matchUrlPattern('https://*.example.com/*', 'https://example.com/dashboard')).toBe(false);
  });

  it('matches empty path with wildcard', () => {
    expect(matchUrlPattern('https://example.com*', 'https://example.com')).toBe(true);
    expect(matchUrlPattern('https://example.com*', 'https://example.com/anything')).toBe(true);
  });
});
