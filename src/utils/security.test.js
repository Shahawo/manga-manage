import { describe, it, expect } from 'vitest';
import { escapeHTML } from './security.js';

describe('security utils - escapeHTML', () => {
    it('should escape HTML tags to prevent XSS', () => {
        const input = '<script>alert("xss")</script>';
        const expected = '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;';
        expect(escapeHTML(input)).toBe(expected);
    });

    it('should handle single quotes', () => {
        const input = "User's string";
        const expected = 'User&#39;s string';
        expect(escapeHTML(input)).toBe(expected);
    });

    it('should handle ampersands', () => {
        const input = 'Tom & Jerry';
        const expected = 'Tom &amp; Jerry';
        expect(escapeHTML(input)).toBe(expected);
    });

    it('should handle null and undefined', () => {
        expect(escapeHTML(null)).toBe('');
        expect(escapeHTML(undefined)).toBe('');
    });

    it('should handle non-string values by converting them', () => {
        expect(escapeHTML(123)).toBe('123');
        expect(escapeHTML(true)).toBe('true');
    });

    it('should return empty string for empty string input', () => {
        expect(escapeHTML('')).toBe('');
    });
});
