import { beforeAll, describe, expect, it, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

beforeAll(() => {
    window.TRACKS_DATA = [
        { id: 301, label: 'Donington Park - National' },
        { id: 302, label: 'Donington Park - Grand Prix' }
    ];
    window.R3EUtils = {
        resolveTrackLabel: vi.fn((id, fallback) => {
            const map = {
                '100': 'Spa',
                '200': 'Monza',
                '300': 'Nurburgring',
                '301': 'Donington Park - National',
                '302': 'Donington Park - Grand Prix'
            };
            return map[String(id)] || fallback || String(id);
        })
    };
    loadBrowserScript('modules/track-helper.js');
    loadBrowserScript('modules/driver-profile-data.js');
});

describe('DriverProfileData.countByField', () => {
    it('returns empty array for empty entries', () => {
        expect(window.DriverProfileData.countByField([], ['car_class'])).toEqual([]);
    });

    it('counts occurrences correctly', () => {
        const entries = [
            { car_class: 'GT3' },
            { car_class: 'GT3' },
            { car_class: 'TCR' }
        ];
        const result = window.DriverProfileData.countByField(entries, ['car_class']);
        expect(result).toEqual([
            { label: 'GT3', value: 2 },
            { label: 'TCR', value: 1 }
        ]);
    });

    it('tries multiple field aliases', () => {
        const entries = [
            { CarClass: 'DTM' },
            { car_class: 'GT3' }
        ];
        const result = window.DriverProfileData.countByField(entries, ['car_class', 'CarClass']);
        // First alias that matches wins per entry
        expect(result).toHaveLength(2);
        expect(result.find(r => r.label === 'GT3')).toBeTruthy();
        expect(result.find(r => r.label === 'DTM')).toBeTruthy();
    });

    it('skips entries with no matching field', () => {
        const entries = [
            { other: 'value' },
            { car_class: 'GT3' }
        ];
        const result = window.DriverProfileData.countByField(entries, ['car_class']);
        expect(result).toEqual([{ label: 'GT3', value: 1 }]);
    });

    it('sorts by count descending', () => {
        const entries = [
            { car_class: 'A' },
            { car_class: 'B' },
            { car_class: 'B' },
            { car_class: 'C' },
            { car_class: 'C' },
            { car_class: 'C' }
        ];
        const result = window.DriverProfileData.countByField(entries, ['car_class']);
        expect(result[0].label).toBe('C');
        expect(result[0].value).toBe(3);
        expect(result[1].label).toBe('B');
        expect(result[2].label).toBe('A');
    });
});

describe('DriverProfileData.getCarClassDistribution', () => {
    it('extracts car class from various field names', () => {
        const entries = [
            { car_class: 'GT3' },
            { CarClass: 'GT3' },
            { Class: 'TCR' }
        ];
        const result = window.DriverProfileData.getCarClassDistribution(entries);
        expect(result.find(r => r.label === 'GT3').value).toBe(2);
        expect(result.find(r => r.label === 'TCR').value).toBe(1);
    });
});

describe('DriverProfileData.getCarDistribution', () => {
    it('extracts car from various field names', () => {
        const entries = [
            { Car: 'BMW M4 GT3' },
            { car: 'BMW M4 GT3' },
            { CarName: 'Porsche 911 GT3 R' }
        ];
        const result = window.DriverProfileData.getCarDistribution(entries);
        expect(result.find(r => r.label === 'BMW M4 GT3').value).toBe(2);
        expect(result.find(r => r.label === 'Porsche 911 GT3 R').value).toBe(1);
    });
});

describe('DriverProfileData.getTrackDistribution', () => {
    it('resolves track IDs to labels', () => {
        const entries = [
            { track_id: 100 },
            { track_id: 100 },
            { track_id: 200 }
        ];
        const result = window.DriverProfileData.getTrackDistribution(entries);
        expect(result.find(r => r.label === 'Spa').value).toBe(2);
        expect(result.find(r => r.label === 'Monza').value).toBe(1);
    });

    it('falls back to track name when no resolver', () => {
        const entries = [
            { Track: 'Custom Track', track_id: '' }
        ];
        // Track name fallback when track_id is empty
        const result = window.DriverProfileData.getTrackDistribution(entries);
        expect(result).toHaveLength(1);
    });

    it('groups layouts under one track with layout details', () => {
        const result = window.DriverProfileData.getTrackDistribution([
            { track_id: 301 },
            { track_id: 302 }
        ]);

        expect(result).toEqual([{
            label: 'Donington Park',
            value: 2,
            details: [
                { label: 'National', value: 1 },
                { label: 'Grand Prix', value: 1 }
            ]
        }]);
    });
});

describe('DriverProfileData.buildProfileData', () => {
    it('builds complete profile from driver group', () => {
        const group = {
            driver: 'Test Driver',
            country: 'DE',
            team: 'Team Alpha',
            rank: '5',
            avatar: 'https://example.com/avatar.png',
            pathId: 'abc123',
            entries: [
                { car_class: 'GT3', Car: 'BMW M4', track_id: 100 },
                { car_class: 'GT3', Car: 'Porsche 911', track_id: 200 },
                { car_class: 'TCR', Car: 'Hyundai i30', track_id: 100 }
            ]
        };
        const profile = window.DriverProfileData.buildProfileData(group);

        expect(profile.name).toBe('Test Driver');
        expect(profile.country).toBe('DE');
        expect(profile.team).toBe('Team Alpha');
        expect(profile.rank).toBe('5');
        expect(profile.avatar).toBe('https://example.com/avatar.png');
        expect(profile.totalEntries).toBe(3);
        expect(profile.carClassDistribution).toHaveLength(2);
        expect(profile.carDistribution).toHaveLength(3);
        expect(profile.trackDistribution).toHaveLength(2);
    });

    it('handles driver group with no entries', () => {
        const group = { driver: 'Empty', country: '', entries: [] };
        const profile = window.DriverProfileData.buildProfileData(group);
        expect(profile.totalEntries).toBe(0);
        expect(profile.carClassDistribution).toEqual([]);
        expect(profile.carDistribution).toEqual([]);
        expect(profile.trackDistribution).toEqual([]);
    });

    it('handles missing optional fields gracefully', () => {
        const group = { driver: 'Minimal' };
        const profile = window.DriverProfileData.buildProfileData(group);
        expect(profile.name).toBe('Minimal');
        expect(profile.country).toBe('');
        expect(profile.team).toBe('');
        expect(profile.totalEntries).toBe(0);
    });
});

describe('DriverProfileData.getRaceRoomProfileUrl', () => {
    it('returns correct profile URL from pathId', () => {
        const url = window.DriverProfileData.getRaceRoomProfileUrl('abc123');
        expect(url).toBe('https://game.raceroom.com/users/abc123');
    });

    it('encodes special characters in pathId', () => {
        const url = window.DriverProfileData.getRaceRoomProfileUrl('path id');
        expect(url).toBe('https://game.raceroom.com/users/path%20id');
    });

    it('returns empty string for empty pathId', () => {
        expect(window.DriverProfileData.getRaceRoomProfileUrl('')).toBe('');
    });

    it('returns empty string for null pathId', () => {
        expect(window.DriverProfileData.getRaceRoomProfileUrl(null)).toBe('');
    });
});

describe('DriverProfileData.computeClassBreakdown', () => {
    it('exposes pole and podium threshold constants', () => {
        expect(window.DriverProfileData.MIN_ENTRIES_FOR_POLE).toBe(2);
        expect(window.DriverProfileData.MIN_ENTRIES_FOR_PODIUM).toBe(4);
    });

    it('computes bested per class as sum of (total_entries - position)', () => {
        const entries = [
            { car_class: 'GTR 4', position: 10, total_entries: 100 },
            { car_class: 'GTR 4', position: 5, total_entries: 50 },
            { car_class: 'GTE', position: 20, total_entries: 200 }
        ];
        const result = window.DriverProfileData.computeClassBreakdown(entries);
        // GTR 4: (100-10) + (50-5) = 90+45 = 135
        // GTE: 200-20 = 180
        expect(result.bested).toEqual([
            { className: 'GTE', value: 180 },
            { className: 'GTR 4', value: 135 }
        ]);
    });

    it('counts pole positions only when total_entries >= MIN_ENTRIES_FOR_POLE', () => {
        const entries = [
            { car_class: 'GTR 4', position: 1, total_entries: 100 }, // counts (100 >= 2)
            { car_class: 'GTR 4', position: 1, total_entries: 2 },   // counts (2 >= 2)
            { car_class: 'GTR 4', position: 1, total_entries: 1 },   // does NOT count (1 < 2)
            { car_class: 'GTE', position: 1, total_entries: 200 }    // counts
        ];
        const result = window.DriverProfileData.computeClassBreakdown(entries);
        expect(result.pole).toEqual([
            { className: 'GTR 4', value: 2 },
            { className: 'GTE', value: 1 }
        ]);
    });

    it('counts podiums only when total_entries >= MIN_ENTRIES_FOR_PODIUM', () => {
        const entries = [
            { car_class: 'GTR 4', position: 1, total_entries: 100 }, // counts (100 >= 4)
            { car_class: 'GTR 4', position: 3, total_entries: 4 },   // counts (4 >= 4)
            { car_class: 'GTR 4', position: 2, total_entries: 3 },   // does NOT count (3 < 4)
            { car_class: 'GTR 4', position: 4, total_entries: 80 }   // not a podium
        ];
        const result = window.DriverProfileData.computeClassBreakdown(entries);
        expect(result.podium).toEqual([{ className: 'GTR 4', value: 2 }]);
    });

    it('computes avg_bested with entryCount', () => {
        const entries = [
            { car_class: 'GTR 4', position: 1, total_entries: 101 }, // 100/100 = 100%
            { car_class: 'GTR 4', position: 51, total_entries: 101 } // 50/100 = 50%
        ];
        const result = window.DriverProfileData.computeClassBreakdown(entries);
        expect(result.avg_bested[0].className).toBe('GTR 4');
        expect(result.avg_bested[0].value).toBeCloseTo(75, 1);
        expect(result.avg_bested[0].entryCount).toBe(2);
    });

    it('returns empty arrays for no entries', () => {
        const result = window.DriverProfileData.computeClassBreakdown([]);
        expect(result.bested).toEqual([]);
        expect(result.pole).toEqual([]);
        expect(result.podium).toEqual([]);
        expect(result.avg_bested).toEqual([]);
    });

    it('excludes entries with missing car_class', () => {
        const entries = [
            { car_class: '', position: 1, total_entries: 100 },
            { position: 1, total_entries: 100 }
        ];
        const result = window.DriverProfileData.computeClassBreakdown(entries);
        expect(result.pole).toEqual([]);
    });

    it('excludes zero-bested classes from bested results', () => {
        const entries = [
            { car_class: 'GTR 4', position: 50, total_entries: 50 } // bested = 0
        ];
        const result = window.DriverProfileData.computeClassBreakdown(entries);
        expect(result.bested).toEqual([]);
    });

    it('sorts results descending by value', () => {
        const entries = [
            { car_class: 'A', position: 10, total_entries: 20 },  // bested=10
            { car_class: 'B', position: 5, total_entries: 100 },  // bested=95
            { car_class: 'C', position: 2, total_entries: 60 }    // bested=58
        ];
        const result = window.DriverProfileData.computeClassBreakdown(entries);
        expect(result.bested.map(r => r.className)).toEqual(['B', 'C', 'A']);
    });
});

describe('DriverProfileData.getCarToClassMap', () => {
    it('maps each car to its most frequent class', () => {
        const entries = [
            { Car: 'BMW M4', car_class: 'GT3' },
            { Car: 'BMW M4', car_class: 'GT3' },
            { Car: 'BMW M4', car_class: 'DTM' },
            { Car: 'Hyundai', car_class: 'TCR' }
        ];
        const map = window.DriverProfileData.getCarToClassMap(entries);
        expect(map.get('BMW M4')).toBe('GT3');
        expect(map.get('Hyundai')).toBe('TCR');
    });

    it('returns empty map for empty entries', () => {
        const map = window.DriverProfileData.getCarToClassMap([]);
        expect(map.size).toBe(0);
    });
});
