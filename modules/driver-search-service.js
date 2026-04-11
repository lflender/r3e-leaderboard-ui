(function () {
    const DriverSearchService = {
        _matchesDriverSearchTerm(searchTarget, searchLower, isExactSearch) {
            const normalizedTarget = this._normalizeDriverLookupName(searchTarget);
            if (!normalizedTarget) {
                return false;
            }

            if (!isExactSearch) {
                return normalizedTarget.includes(searchLower);
            }

            const words = searchLower.split(/\s+/).filter(Boolean);
            if (words.length === 0) {
                return false;
            }

            if (words.length === 1) {
                const wordRegex = new RegExp(`\\b${words[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
                return wordRegex.test(searchTarget);
            }

            const escapedWords = words.map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
            const pattern = escapedWords.map(word => `\\b${word}\\b`).join('\\s+');
            const phraseRegex = new RegExp(pattern, 'i');
            return phraseRegex.test(searchTarget);
        },

        _getSuperclassClasses(superclassName) {
            const superclassClasses = new Set();
            if (!window.CARS_DATA || !Array.isArray(window.CARS_DATA)) {
                return superclassClasses;
            }

            window.CARS_DATA.forEach(entry => {
                if (entry.superclass !== superclassName) {
                    return;
                }

                const cls = entry.class || entry.car_class || entry.CarClass || '';
                if (cls) {
                    superclassClasses.add(String(cls));
                }
            });

            return superclassClasses;
        },

        _filterDriverEntries(entries, filters = {}) {
            let filteredEntries = Array.isArray(entries) ? entries : [];

            if (filters.trackId !== undefined && filters.trackId !== null && String(filters.trackId).trim() !== '') {
                const selectedTrackId = Number(filters.trackId);
                filteredEntries = filteredEntries.filter(entry => {
                    const entryTrackId = entry.track_id || entry.TrackID || entry.trackId ||
                        (entry.track && (entry.track.id || entry.track.Id || entry.track.track_id));
                    if (entryTrackId === undefined || entryTrackId === null) {
                        return false;
                    }
                    return Number(entryTrackId) === selectedTrackId;
                });
            }

            const rawClassFilterValue = filters.classId ?? filters.className ?? '';
            const classFilterValue = rawClassFilterValue === '' ? '' : String(rawClassFilterValue).trim();
            if (classFilterValue) {
                if (classFilterValue.startsWith('superclass:')) {
                    const superclassName = classFilterValue.replace('superclass:', '');
                    const superclassClasses = this._getSuperclassClasses(superclassName);
                    filteredEntries = filteredEntries.filter(entry => {
                        const entryClass = entry.car_class || entry.CarClass || entry['Car Class'] || entry.Class || entry.class || '';
                        return superclassClasses.has(String(entryClass || ''));
                    });
                } else {
                    filteredEntries = filteredEntries.filter(entry => {
                        const entryClass = entry.car_class || entry.CarClass || entry['Car Class'] || entry.Class || entry.class || '';
                        return String(entryClass || '') === classFilterValue;
                    });
                }
            }

            if (filters.difficulty && filters.difficulty !== 'All difficulties') {
                filteredEntries = filteredEntries.filter(entry => {
                    const entryDifficulty = entry.difficulty || entry.Difficulty || entry.driving_model || '';
                    return entryDifficulty === filters.difficulty;
                });
            }

            return filteredEntries;
        },

        _buildMetadataSearchResult(filteredEntries, mirrorMeta, mirrorKey, driverEntries) {
            const enrichedEntries = filteredEntries.map(entry => {
                const enrichedEntry = { ...entry };
                if (mirrorMeta.country) {
                    enrichedEntry.country = mirrorMeta.country;
                    enrichedEntry.Country = mirrorMeta.country;
                }
                enrichedEntry.team = mirrorMeta.team;
                enrichedEntry.Team = mirrorMeta.team;
                enrichedEntry.rank = mirrorMeta.rank;
                enrichedEntry.Rank = mirrorMeta.rank;
                if (mirrorMeta.displayName && !enrichedEntry.name && !enrichedEntry.Name) {
                    enrichedEntry.name = mirrorMeta.displayName;
                }
                return enrichedEntry;
            });

            return {
                driver: mirrorMeta.displayName || driverEntries[0].name || mirrorKey,
                country: mirrorMeta.country || '-',
                team: mirrorMeta.team || '',
                rank: mirrorMeta.rank || '',
                entries: enrichedEntries
            };
        },

        _buildLegacySearchResults(filteredEntries, mirrorMeta, mirrorKey, driverEntries) {
            const entriesByCountryAndTeam = new Map();

            filteredEntries.forEach(entry => {
                const country = entry.country || entry.Country || '-';
                const team = entry.team || entry.Team || '-';
                const groupKey = `${country}|${team}`;
                if (!entriesByCountryAndTeam.has(groupKey)) {
                    entriesByCountryAndTeam.set(groupKey, {
                        country: country,
                        team: team,
                        rank: entry.rank || entry.Rank || '',
                        entries: []
                    });
                }
                entriesByCountryAndTeam.get(groupKey).entries.push(entry);
            });

            const driverName = driverEntries[0].name || mirrorMeta.displayName || mirrorKey;
            return Array.from(entriesByCountryAndTeam.values(), groupData => ({
                driver: driverName,
                country: groupData.country,
                team: groupData.team,
                rank: groupData.rank,
                entries: groupData.entries
            }));
        },

        async searchDriver(driverName, filters = {}) {
            const driverMirror = await this.waitForDriverIndex();

            if (!driverMirror || Object.keys(driverMirror).length === 0) {
                throw new Error('Driver index is loading or unavailable. Please try again in a moment.');
            }

            let searchTerm = driverName.trim();
            let isExactSearch = false;

            if ((searchTerm.startsWith('"') && searchTerm.endsWith('"')) ||
                (searchTerm.startsWith("'") && searchTerm.endsWith("'"))) {
                isExactSearch = true;
                searchTerm = searchTerm.slice(1, -1).trim();
            }

            const searchLower = searchTerm.toLowerCase();
            const results = [];

            for (const [mirrorKey, mirrorEntry] of Object.entries(driverMirror)) {
                const mirrorMeta = this._extractDriverMirrorMetadata(mirrorKey, mirrorEntry);
                const searchTarget = mirrorMeta.displayName || mirrorKey;
                if (!this._matchesDriverSearchTerm(searchTarget, searchLower, isExactSearch)) {
                    continue;
                }

                const shardKey = this._getShardKeyForName(mirrorKey);
                const shardData = await this._loadDriverShard(shardKey);
                const normalizedLookupName = mirrorMeta.lookupKey || this._normalizeDriverLookupName(mirrorKey);
                const driverEntries = shardData[normalizedLookupName] || shardData[mirrorKey] || shardData[this._normalizeDriverLookupName(searchTarget)] || [];
                if (!Array.isArray(driverEntries) || driverEntries.length === 0) {
                    continue;
                }

                const filteredEntries = this._filterDriverEntries(driverEntries, filters);
                if (filteredEntries.length === 0) {
                    continue;
                }

                if (mirrorMeta.hasMetadata) {
                    results.push(this._buildMetadataSearchResult(filteredEntries, mirrorMeta, mirrorKey, driverEntries));
                    continue;
                }

                results.push(...this._buildLegacySearchResults(filteredEntries, mirrorMeta, mirrorKey, driverEntries));
            }

            return results;
        }
    };

    window.R3EDriverSearchService = DriverSearchService;
})();
