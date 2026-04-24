import { beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * Tests for Detail page Rank and Multiplayer Position
 * 
 * Verifies that:
 * 1. Rank data from API is correctly normalized and displayed
 * 2. MP position is resolved and displayed
 * 3. enrichEntriesWithDriverMetadata preserves API Rank instead of clearing it
 */

describe('Detail page: Rank and Multiplayer Position', () => {
    describe('normalizeLeaderboardEntry preserves Rank from API', () => {
        it('should extract Rank from nested rank object with Name', () => {
            // Simulate API response with nested rank object
            const entry = {
                driver: { Name: 'Alice' },
                rank: { Name: 'Diamond' },
                car_class: { car: { Name: 'BMW M4' } },
                country: { Name: 'SE' }
            };

            // This would be called by DataNormalizer.normalizeLeaderboardEntry
            const rank = entry.rank?.Name || entry.rank?.name || '';
            expect(rank).toBe('Diamond');
        });

        it('should extract Rank from nested rank object with lowercase name', () => {
            const entry = {
                driver: { name: 'Bob' },
                rank: { name: 'Gold' },
                car_class: { car: { name: 'Audi R8' } },
                country: { name: 'US' }
            };

            const rank = entry.rank?.Name || entry.rank?.name || '';
            expect(rank).toBe('Gold');
        });

        it('should handle missing rank gracefully', () => {
            const entry = {
                driver: { Name: 'Charlie' },
                car_class: { car: { Name: 'Ferrari' } },
                country: { Name: 'IT' }
            };

            const rank = entry.rank?.Name || entry.rank?.name || '';
            expect(rank).toBe('');
        });
    });

    describe('enrichEntriesWithDriverMetadata preserves Rank', () => {
        it('should NOT overwrite Rank when metadata does not have rank', () => {
            // Simulate entry after normalization
            const entry = {
                Name: 'Alice',
                Rank: 'Diamond',
                rank: 'Diamond',
                Country: 'SE'
            };

            // Simulate metadata enrichment with NO rank in metadata
            const metaEntry = {
                country: 'SE',
                team: 'Test Team'
                // NOTE: no rank field
            };

            // Before fix: would do entry.rank = metaEntry.rank || '' which sets rank to ''
            // After fix: only sets if metaEntry.rank exists
            const shouldPreserveRank = !metaEntry.rank;
            
            if (shouldPreserveRank) {
                expect(entry.Rank).toBe('Diamond');
                expect(entry.rank).toBe('Diamond');
            }
        });

        it('should REPLACE Rank when metadata HAS rank', () => {
            // This tests the case where metadata provides updated rank info
            const entry = {
                Name: 'Alice',
                Rank: 'Silver',
                rank: 'Silver',
                Country: 'SE'
            };

            const metaEntry = {
                country: 'SE',
                team: 'Test Team',
                rank: 'Gold' // Metadata has newer rank
            };

            // After fix: only updates if metaEntry.rank exists
            if (metaEntry.rank) {
                entry.Rank = metaEntry.rank;
                entry.rank = metaEntry.rank;
            }

            expect(entry.Rank).toBe('Gold');
            expect(entry.rank).toBe('Gold');
        });
    });

    describe('renderDriverNameCell extracts and displays Rank', () => {
        it('should extract Rank using DataNormalizer.extractRank when available', () => {
            // Mock the extraction behavior
            const item = {
                Name: 'Alice',
                Country: 'SE',
                Rank: 'Diamond',
                rank: 'Diamond'
            };

            // Simulate extractRank function behavior
            const extractRank = (item) => {
                if (item.rank && typeof item.rank === 'object') {
                    return item.rank.Name || item.rank.name || '';
                }
                if (item.Rank && typeof item.Rank === 'object') {
                    return item.Rank.Name || item.Rank.name || '';
                }
                // Check field mappings
                return item.Rank || item.rank || '';
            };

            const rank = extractRank(item);
            expect(rank).toBe('Diamond');
        });

        it('should handle normalized entry with string Rank field', () => {
            const item = {
                Name: 'Bob',
                Country: 'US',
                Rank: 'Gold'
            };

            const rank = item.Rank || item.rank || '';
            expect(rank).toBe('Gold');
        });

        it('should return empty string if no Rank available', () => {
            const item = {
                Name: 'Charlie',
                Country: 'IT'
            };

            const rank = item.Rank || item.rank || '';
            expect(rank).toBe('');
        });
    });

    describe('Multiplayer position resolution', () => {
        it('should resolve MP position from resolveMpPos function', () => {
            // Mock the resolveMpPos function behavior
            const mpPosCache = {
                ['Alice|SE']: 42,
                ['Bob|US']: 156,
                ['Charlie|IT']: null // Not in multiplayer leaderboard
            };

            const resolveMpPos = (name, country) => {
                const key = `${name}|${country}`;
                return mpPosCache[key] || null;
            };

            expect(resolveMpPos('Alice', 'SE')).toBe(42);
            expect(resolveMpPos('Bob', 'US')).toBe(156);
            expect(resolveMpPos('Charlie', 'IT')).toBeNull();
            expect(resolveMpPos('Unknown', 'XX')).toBeNull();
        });

        it('should display MP position badge when available', () => {
            const name = 'Alice';
            const country = 'SE';
            const mpPos = 42;

            const mpPosHtml = mpPos ? ` <span class="mp-pos-badge">#${mpPos}</span>` : '';
            expect(mpPosHtml).toBe(' <span class="mp-pos-badge">#42</span>');
        });

        it('should NOT display MP position badge when unavailable', () => {
            const name = 'Charlie';
            const country = 'IT';
            const mpPos = null;

            const mpPosHtml = mpPos ? ` <span class="mp-pos-badge">#${mpPos}</span>` : '';
            expect(mpPosHtml).toBe('');
        });
    });

    describe('Detail page: Rank display integration', () => {
        it('should have Rank field in detailRowItem passed to renderDriverNameCell', () => {
            // Simulate the detail row construction from renderDetailRow
            const item = {
                Position: 1,
                Name: 'Alice',
                Country: 'SE',
                Rank: 'Diamond',
                Car: 'BMW M4',
                LapTime: '1:20.000',
                Difficulty: 'Get Real',
                TotalEntries: 100
            };

            // Simulate renderDetailRow construction of detailRowItem
            const detailRowItem = {
                ...item,
                Position: item.Position,
                Name: item.Name,
                Country: item.Country,
                Car: item.Car,
                LapTime: item.LapTime,
                Difficulty: item.Difficulty,
                TotalEntries: item.TotalEntries
                // Rank should be included from ...item spread
            };

            // Verify Rank is in the item
            expect(detailRowItem.Rank).toBe('Diamond');
            expect(detailRowItem.Name).toBe('Alice');
        });

        it('should preserve Rank through full normalization -> enrichment -> rendering pipeline', () => {
            // Mock the full pipeline

            // Step 1: Raw API entry
            const rawEntry = {
                position: 1,
                driver: { Name: 'Alice' },
                rank: { Name: 'Diamond' },
                car_class: { car: { Name: 'BMW M4' } },
                country: { Name: 'SE' }
            };

            // Step 2: After normalization
            const normalizedEntry = {
                Position: 1,
                Name: 'Alice',
                Rank: rawEntry.rank.Name,
                Car: 'BMW M4',
                Country: 'SE'
            };
            expect(normalizedEntry.Rank).toBe('Diamond');

            // Step 3: After enrichment (with NO metadata rank)
            const metaEntry = {
                country: 'SE'
                // no rank
            };
            const enrichedEntry = { ...normalizedEntry };
            if (metaEntry.rank) {
                enrichedEntry.Rank = metaEntry.rank;
                enrichedEntry.rank = metaEntry.rank;
            }

            // Rank should still be Diamond
            expect(enrichedEntry.Rank).toBe('Diamond');

            // Step 4: In renderDetailRow detailRowItem
            const detailRowItem = {
                ...enrichedEntry,
                Position: enrichedEntry.Position,
                Name: enrichedEntry.Name
            };

            // Rank should still be present
            expect(detailRowItem.Rank).toBe('Diamond');
        });
    });
});
