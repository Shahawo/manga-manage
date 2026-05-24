import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSeriesGroups } from './manga.js';

// Mock dependencies
vi.mock('../store.js', () => ({
    store: {
        data: [],
        seriesMetadata: {},
        userSeriesSettings: {}
    }
}));

vi.mock('../supabase-client.js', () => ({
    supabase: {}
}));

import { store } from '../../store.js';

describe('manga mixins - getSeriesGroups', () => {
    beforeEach(() => {
        // Reset store before each test
        store.data = [];
        store.seriesMetadata = {};
        store.userSeriesSettings = {};
        
        // Mock document for sorting
        document.body.innerHTML = '<input type="hidden" id="sort-order" value="az">';
    });

    it('should return empty array if no data', () => {
        const groups = getSeriesGroups();
        expect(groups).toEqual([]);
    });

    it('should group manga by series and calculate basic percent', () => {
        store.data = [
            { id: 1, series: 'Naruto', volume: '1', title: 'Tập 1' },
            { id: 2, series: 'Naruto', volume: '2', title: 'Tập 2' }
        ];

        const groups = getSeriesGroups();
        expect(groups).toHaveLength(1);
        
        const naruto = groups[0];
        expect(naruto.title).toBe('Naruto');
        expect(naruto.count).toBe(2);
        expect(naruto.maxVolume).toBe(2);
        expect(naruto.total).toBe(2);
        expect(naruto.percent).toBe(100);
        expect(naruto.latestVolume.volume).toBe('2');
    });

    it('should calculate total from maxVolume if it is higher than count', () => {
        // Only have volume 3
        store.data = [
            { id: 1, series: 'Conan', volume: '3', title: 'Tập 3' }
        ];

        const groups = getSeriesGroups();
        expect(groups).toHaveLength(1);
        
        const conan = groups[0];
        expect(conan.count).toBe(1); // Have 1 book
        expect(conan.maxVolume).toBe(3);
        expect(conan.total).toBe(3); // Total should be at least maxVolume
        expect(conan.percent).toBe(Math.round((1 / 3) * 100)); // ~33%
    });

    it('should use seriesMetadata for total if available', () => {
        store.data = [
            { id: 1, series: 'Bleach', volume: '1', title: 'Tập 1' }
        ];
        store.seriesMetadata = {
            'Bleach': { total_volumes: 74 }
        };

        const groups = getSeriesGroups();
        expect(groups[0].total).toBe(74);
        expect(groups[0].percent).toBe(Math.round((1 / 74) * 100));
    });

    it('should use userSeriesSettings to override total target', () => {
        store.data = [
            { id: 1, series: 'Bleach', volume: '1', title: 'Tập 1' }
        ];
        store.seriesMetadata = {
            'Bleach': { total_volumes: 74 }
        };
        store.userSeriesSettings = {
            'Bleach': { target_volumes: 10 } // User only wants 10 volumes
        };

        const groups = getSeriesGroups();
        expect(groups[0].total).toBe(10);
        expect(groups[0].percent).toBe(10); // 1 / 10 = 10%
    });

    it('should sort alphabetically A to Z by default', () => {
        store.data = [
            { id: 1, series: 'Zebra', volume: '1' },
            { id: 2, series: 'Apple', volume: '1' },
            { id: 3, series: 'Mango', volume: '1' }
        ];

        const groups = getSeriesGroups();
        expect(groups[0].title).toBe('Apple');
        expect(groups[1].title).toBe('Mango');
        expect(groups[2].title).toBe('Zebra');
    });

    it('should handle undefined series name gracefully', () => {
        store.data = [
            { id: 1, series: undefined, volume: '1' }
        ];

        const groups = getSeriesGroups();
        expect(groups[0].title).toBe('Không có tên Series');
    });
});
