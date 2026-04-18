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

        _extractPathId(record) {
            if (!record || typeof record !== 'object') {
                return '';
            }

            const rawPathId = record.path_id || record.pathId || record.pathID || record.PathID || record['Path ID'];
            return String(rawPathId || '').trim();
        },

        _normalizeMetadataCandidates(metaEntry) {
            if (Array.isArray(metaEntry)) {
                return metaEntry.filter(entry => entry && typeof entry === 'object');
            }

            if (metaEntry && typeof metaEntry === 'object') {
                return [metaEntry];
            }

            return [];
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
                pathId: mirrorMeta.pathId || '',
                entries: enrichedEntries
            };
        },

        _buildMetadataSearchResultsForPathIds(filteredEntries, metaEntry, mirrorKey, driverEntries) {
            const metadataCandidates = this._normalizeMetadataCandidates(metaEntry);
            if (metadataCandidates.length === 0) {
                return [];
            }

            const metadataByPathId = new Map();
            metadataCandidates.forEach(candidate => {
                const pathId = this._extractPathId(candidate);
                if (pathId && !metadataByPathId.has(pathId)) {
                    metadataByPathId.set(pathId, candidate);
                }
            });

            const entriesByPathId = new Map();
            filteredEntries.forEach(entry => {
                const pathId = this._extractPathId(entry);
                const groupKey = pathId || '__no_path_id__';
                if (!entriesByPathId.has(groupKey)) {
                    entriesByPathId.set(groupKey, []);
                }
                entriesByPathId.get(groupKey).push(entry);
            });

            // If we only have metadata and no entries path IDs, keep single-result behavior.
            if (entriesByPathId.size === 1 && entriesByPathId.has('__no_path_id__')) {
                const primaryMeta = metadataCandidates[0];
                const mirrorMeta = {
                    lookupKey: this._normalizeDriverLookupName(mirrorKey),
                    displayName: String(primaryMeta.name || mirrorKey),
                    country: String(primaryMeta.country || ''),
                    team: String(primaryMeta.team || ''),
                    rank: String(primaryMeta.rank || ''),
                    pathId: this._extractPathId(primaryMeta),
                    hasMetadata: true
                };
                return [this._buildMetadataSearchResult(filteredEntries, mirrorMeta, mirrorKey, driverEntries)];
            }

            const groupedResults = [];
            entriesByPathId.forEach((entriesForPath, groupKey) => {
                const pathId = groupKey === '__no_path_id__' ? '' : groupKey;
                const metadataForPath = (pathId && metadataByPathId.get(pathId)) || metadataCandidates[0];
                const mirrorMeta = {
                    lookupKey: this._normalizeDriverLookupName(mirrorKey),
                    displayName: String(metadataForPath.name || mirrorKey),
                    country: String(metadataForPath.country || ''),
                    team: String(metadataForPath.team || ''),
                    rank: String(metadataForPath.rank || ''),
                    pathId: pathId || this._extractPathId(metadataForPath),
                    hasMetadata: true
                };

                groupedResults.push(this._buildMetadataSearchResult(entriesForPath, mirrorMeta, mirrorKey, driverEntries));
            });

            return groupedResults;
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

            for (const mirrorKey of Object.keys(driverMirror)) {
                if (!this._matchesDriverSearchTerm(mirrorKey, searchLower, isExactSearch)) {
                    continue;
                }

                const shardKey = this._getShardKeyForName(mirrorKey);
                const [shardData, metadataShard] = await Promise.all([
                    this._loadDriverShard(shardKey),
                    this._loadDriverMetadataShard(shardKey).catch(() => null)
                ]);

                const normalizedLookupName = this._normalizeDriverLookupName(mirrorKey);
                let metaEntry = metadataShard && (metadataShard[normalizedLookupName] || metadataShard[mirrorKey]);
                let driverEntries = shardData[normalizedLookupName] || shardData[mirrorKey] || [];

                // Fallback: diacritical names live in _ shards with search_name alias
                if ((!metaEntry || !Array.isArray(driverEntries) || driverEntries.length === 0) && shardKey !== '_') {
                    const [fallbackShard, fallbackMetadata] = await Promise.all([
                        this._loadDriverShard('_'),
                        this._loadDriverMetadataShard('_').catch(() => null)
                    ]);

                    if (!metaEntry && fallbackMetadata) {
                        metaEntry = fallbackMetadata[normalizedLookupName] || fallbackMetadata[mirrorKey];
                    }

                    if (!Array.isArray(driverEntries) || driverEntries.length === 0) {
                        // Use original key from metadata to find entries in _ leaderboard shard
                        let originalKey = null;
                        if (Array.isArray(metaEntry)) {
                            const withOriginalKey = metaEntry.find(entry => entry && typeof entry === 'object' && entry._originalKey);
                            originalKey = withOriginalKey ? withOriginalKey._originalKey : null;
                        } else {
                            originalKey = metaEntry && metaEntry._originalKey;
                        }
                        if (originalKey && fallbackShard) {
                            driverEntries = fallbackShard[originalKey] || [];
                        }
                    }
                }

                if (!Array.isArray(driverEntries) || driverEntries.length === 0) {
                    continue;
                }

                const filteredEntries = this._filterDriverEntries(driverEntries, filters);
                if (filteredEntries.length === 0) {
                    continue;
                }

                const metadataCandidates = this._normalizeMetadataCandidates(metaEntry);
                if (metadataCandidates.length > 0) {
                    results.push(...this._buildMetadataSearchResultsForPathIds(filteredEntries, metadataCandidates, mirrorKey, driverEntries));
                } else {
                    const mirrorMeta = {
                        lookupKey: normalizedLookupName,
                        displayName: mirrorKey,
                        country: '',
                        team: '',
                        rank: '',
                        hasMetadata: false
                    };
                    results.push(...this._buildLegacySearchResults(filteredEntries, mirrorMeta, mirrorKey, driverEntries));
                }
            }

            return results;
        }
    };

    window.R3EDriverSearchService = DriverSearchService;
})();
