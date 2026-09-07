(function () {
    const DriverSearchService = {
        _hasAccents(str) {
            if (!str) return false;
            const value = String(str);
            if (/[^\u0000-\u007f]/.test(value)) {
                return true;
            }
            const normalized = value.normalize('NFD');
            return normalized !== String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        },

        _normalizeExactDisplayName(value) {
            return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
        },

        _foldEuropeanSearchName(value) {
            const map = {
                'ß': 'ss',
                'ẞ': 'ss',
                'æ': 'ae',
                'Æ': 'ae',
                'ǽ': 'ae',
                'Ǽ': 'ae',
                'ǣ': 'ae',
                'Ǣ': 'ae',
                'œ': 'oe',
                'Œ': 'oe',
                'ø': 'o',
                'Ø': 'o',
                'ð': 'd',
                'Ð': 'd',
                'þ': 'th',
                'Þ': 'th',
                'ł': 'l',
                'Ł': 'l',
                'đ': 'd',
                'Đ': 'd',
                'ħ': 'h',
                'Ħ': 'h',
                'ı': 'i',
                'ĸ': 'k',
                'ſ': 's'
            };

            return String(value || '').replace(/[ßẞæÆǽǼǣǢœŒøØðÐþÞłŁđĐħĦıĸſ]/g, (char) => map[char] || char);
        },

        _reduceEuropeanSearchName(value) {
            const map = {
                'ß': 's',
                'ẞ': 's',
                'æ': 'a',
                'Æ': 'a',
                'ǽ': 'a',
                'Ǽ': 'a',
                'ǣ': 'a',
                'Ǣ': 'a',
                'œ': 'o',
                'Œ': 'o',
                'ø': 'o',
                'Ø': 'o',
                'ð': 'd',
                'Ð': 'd',
                'þ': 't',
                'Þ': 't',
                'ł': 'l',
                'Ł': 'l',
                'đ': 'd',
                'Đ': 'd',
                'ħ': 'h',
                'Ħ': 'h',
                'ı': 'i',
                'ĸ': 'k',
                'ſ': 's'
            };

            return String(value || '').replace(/[ßẞæÆǽǼǣǢœŒøØðÐþÞłŁđĐħĦıĸſ]/g, (char) => map[char] || char);
        },

        _hasSpecialEuropeanLetters(value) {
            return /[ßẞæÆǽǼǣǢœŒøØðÐþÞłŁđĐħĦıĸſ]/.test(String(value || ''));
        },

        _buildLookupKeyCandidates(value) {
            const normalized = this._normalizeDriverLookupName(value);
            const folded = this._foldEuropeanSearchName(normalized);
            const reduced = this._reduceEuropeanSearchName(normalized);
            return Array.from(new Set([normalized, folded, reduced].filter(Boolean)));
        },

        _accentExactWordMatch(candidateName, searchTerm) {
            if (!candidateName || !searchTerm) return false;
            const words = searchTerm.split(/\s+/).filter(Boolean);
            if (words.length === 0) return false;
            if (words.length === 1) {
                // Single word: must appear as a whole word (bounded by space or string edges)
                const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                return new RegExp(`(^|\\s)${escaped}(\\s|$)`, 'i').test(candidateName);
            }
            // Multi-word: require full phrase equality
            return candidateName === searchTerm;
        },

        _matchesDriverSearchTerm(searchTarget, searchLower, isExactSearch) {
            const normalizedTarget = this._normalizeDriverLookupName(searchTarget);
            const normalizedSearch = this._normalizeDriverLookupName(searchLower);
            const foldedTarget = this._foldEuropeanSearchName(normalizedTarget);
            const foldedSearch = this._foldEuropeanSearchName(normalizedSearch);
            const reducedTarget = this._reduceEuropeanSearchName(normalizedTarget);
            const reducedSearch = this._reduceEuropeanSearchName(normalizedSearch);
            if (!normalizedTarget) {
                return false;
            }

            if (!isExactSearch) {
                return normalizedTarget.includes(normalizedSearch)
                    || foldedTarget.includes(foldedSearch)
                    || reducedTarget.includes(reducedSearch);
            }

            // For exact search: if accents are present, allow normalized pre-filtering here.
            // Strict accent-aware equality is applied after shard/metadata lookup.
            if (this._hasAccents(searchLower)) {
                return normalizedTarget.includes(normalizedSearch)
                    || foldedTarget.includes(foldedSearch)
                    || reducedTarget.includes(reducedSearch);
            }

            // For exact search, use direct string comparison to avoid word boundary issues with punctuation
            if (normalizedTarget === normalizedSearch) {
                return true;
            }

            if (foldedTarget === foldedSearch) {
                return true;
            }

            if (reducedTarget === reducedSearch) {
                return true;
            }

            // Fallback to word-boundary regex for multi-word exact searches without punctuation
            const words = normalizedSearch.split(/\s+/).filter(Boolean);
            if (words.length === 0) {
                return false;
            }

            if (words.length === 1) {
                const wordRegex = new RegExp(`\\b${words[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
                return wordRegex.test(normalizedTarget);
            }

            const escapedWords = words.map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
            const pattern = escapedWords.map(word => `\\b${word}\\b`).join('\\s+');
            const phraseRegex = new RegExp(pattern, 'i');
            return phraseRegex.test(normalizedTarget);
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
                const selectedTrackIds = (window.R3ETrackUtils && typeof window.R3ETrackUtils.getTrackIdsForFilterValue === 'function')
                    ? window.R3ETrackUtils.getTrackIdsForFilterValue(filters.trackId)
                    : (() => {
                        const rawValue = String(filters.trackId).trim();
                        const tracks = Array.isArray(window.TRACKS_DATA) ? window.TRACKS_DATA : [];
                        const selectedTrack = tracks.find(track => String(track?.id) === rawValue);
                        if (!selectedTrack) return [rawValue];

                        const selectedBase = String(selectedTrack.label || selectedTrack.name || '').trim();
                        const baseName = selectedBase.match(/^(.+)(?:\s+[-–—]\s+)(.+)$/)
                            ? selectedBase.match(/^(.+)(?:\s+[-–—]\s+)(.+)$/)[1].trim()
                            : selectedBase;

                        return tracks
                            .filter(track => {
                                const label = String(track?.label || track?.name || '').trim();
                                const match = label.match(/^(.+)(?:\s+[-–—]\s+)(.+)$/);
                                const labelBase = match ? match[1].trim() : label;
                                return labelBase === baseName;
                            })
                            .map(track => String(track.id));
                    })();

                filteredEntries = filteredEntries.filter(entry => {
                    const entryTrackId = entry.track_id || entry.TrackID || entry.trackId ||
                        (entry.track && (entry.track.id || entry.track.Id || entry.track.track_id));
                    if (entryTrackId === undefined || entryTrackId === null) {
                        return false;
                    }
                    return selectedTrackIds.includes(String(entryTrackId));
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
                avatar: mirrorMeta.avatar || '',
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
                    avatar: String(primaryMeta.avatar || ''),
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
                    avatar: String(metadataForPath.avatar || ''),
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

        _parseSearchInput(driverName) {
            let searchTerm = driverName.trim();
            let isExactSearch = false;

            if ((searchTerm.startsWith('"') && searchTerm.endsWith('"')) ||
                (searchTerm.startsWith("'") && searchTerm.endsWith("'"))) {
                isExactSearch = true;
                searchTerm = searchTerm.slice(1, -1).trim();
            }

            const searchLower = searchTerm.toLowerCase();
            const accentSearch = this._hasAccents(searchTerm);

            return {
                searchTerm,
                searchLower,
                isExactSearch,
                accentSearch,
                exactAccentSearch: isExactSearch && accentSearch,
                partialAccentSearch: !isExactSearch && accentSearch,
                accentSearchTerm: accentSearch ? this._normalizeExactDisplayName(searchTerm) : ''
            };
        },

        _findMatchedMirrorKeys(driverMirror, searchCtx) {
            const { searchTerm, searchLower, isExactSearch } = searchCtx;

            if (isExactSearch) {
                const candidates = this._buildLookupKeyCandidates(searchTerm);
                const exactMatches = new Set();
                for (const candidate of candidates) {
                    if (candidate in driverMirror) {
                        exactMatches.add(candidate);
                    }
                }
                if (searchTerm in driverMirror) {
                    exactMatches.add(searchTerm);
                }
                const searchLowerTrimmed = searchLower.trim();
                if (searchLowerTrimmed in driverMirror) {
                    exactMatches.add(searchLowerTrimmed);
                }
                let matchedKeys = [...exactMatches];

                if (matchedKeys.length === 0) {
                    const mirrorKeys = Object.keys(driverMirror);
                    matchedKeys = mirrorKeys.filter(mirrorKey =>
                        this._matchesDriverSearchTerm(mirrorKey, searchLower, isExactSearch)
                    );
                }
                return matchedKeys;
            }

            const mirrorKeys = Object.keys(driverMirror);
            return mirrorKeys.filter(mirrorKey =>
                this._matchesDriverSearchTerm(mirrorKey, searchLower, isExactSearch)
            );
        },

        _capAndSortMirrorKeys(matchedMirrorKeys, searchLower) {
            const MAX_MATCHED_DRIVERS = 500;
            if (matchedMirrorKeys.length <= MAX_MATCHED_DRIVERS) {
                return matchedMirrorKeys;
            }

            const normalizedSearch = this._normalizeDriverLookupName(searchLower);
            matchedMirrorKeys.sort((a, b) => {
                const aN = this._normalizeDriverLookupName(a);
                const bN = this._normalizeDriverLookupName(b);
                const aPrefix = aN.startsWith(normalizedSearch) ? 0 : 1;
                const bPrefix = bN.startsWith(normalizedSearch) ? 0 : 1;
                if (aPrefix !== bPrefix) return aPrefix - bPrefix;
                return aN.length - bN.length;
            });
            return matchedMirrorKeys.slice(0, MAX_MATCHED_DRIVERS);
        },

        async _loadShardsForKeys(matchedMirrorKeys) {
            const shardKeysToLoad = new Set(matchedMirrorKeys.map(mirrorKey => this._getShardKeyForName(mirrorKey)));
            const shardDataByKey = new Map();
            const metadataByKey = new Map();

            await Promise.all(Array.from(shardKeysToLoad).map(async shardKey => {
                const [shardData, metadataShard] = await Promise.all([
                    this._loadDriverShard(shardKey),
                    this._loadDriverMetadataShard(shardKey).catch(() => null)
                ]);
                shardDataByKey.set(shardKey, shardData || {});
                metadataByKey.set(shardKey, metadataShard || null);
            }));

            let fallbackLoaded = false;
            let fallbackShard = null;
            let fallbackMetadata = null;

            const ensureFallbackData = async () => {
                if (fallbackLoaded) return;
                fallbackLoaded = true;
                [fallbackShard, fallbackMetadata] = await Promise.all([
                    this._loadDriverShard('_'),
                    this._loadDriverMetadataShard('_').catch(() => null)
                ]);
            };

            return { shardDataByKey, metadataByKey, ensureFallbackData, getFallback: () => ({ fallbackShard, fallbackMetadata }) };
        },

        async _resolveDriverData(mirrorKey, shardCtx) {
            const { shardDataByKey, metadataByKey, ensureFallbackData, getFallback } = shardCtx;
            const shardKey = this._getShardKeyForName(mirrorKey);
            const shardData = shardDataByKey.get(shardKey) || {};
            const metadataShard = metadataByKey.get(shardKey) || null;

            const normalizedLookupName = this._normalizeDriverLookupName(mirrorKey);
            const lookupCandidates = this._buildLookupKeyCandidates(mirrorKey);

            let metaEntry = null;
            if (metadataShard) {
                metaEntry = metadataShard[mirrorKey] || metadataShard[normalizedLookupName] || null;
                if (!metaEntry) {
                    for (const candidateKey of lookupCandidates) {
                        if (metadataShard[candidateKey]) {
                            metaEntry = metadataShard[candidateKey];
                            break;
                        }
                    }
                }
            }

            let driverEntries = [];
            for (const candidateKey of [mirrorKey, normalizedLookupName, ...lookupCandidates]) {
                const candidateEntries = shardData[candidateKey];
                if (Array.isArray(candidateEntries) && candidateEntries.length > 0) {
                    driverEntries = candidateEntries;
                    break;
                }
            }

            if ((!metaEntry || !Array.isArray(driverEntries) || driverEntries.length === 0) && shardKey !== '_') {
                await ensureFallbackData();
                const { fallbackShard, fallbackMetadata } = getFallback();

                if (!metaEntry && fallbackMetadata) {
                    metaEntry = fallbackMetadata[normalizedLookupName] || fallbackMetadata[mirrorKey] || null;
                    if (!metaEntry) {
                        for (const candidateKey of lookupCandidates) {
                            if (fallbackMetadata[candidateKey]) {
                                metaEntry = fallbackMetadata[candidateKey];
                                break;
                            }
                        }
                    }
                }

                if (!Array.isArray(driverEntries) || driverEntries.length === 0) {
                    for (const candidateKey of [mirrorKey, normalizedLookupName, ...lookupCandidates]) {
                        const candidateEntries = fallbackShard && fallbackShard[candidateKey];
                        if (Array.isArray(candidateEntries) && candidateEntries.length > 0) {
                            driverEntries = candidateEntries;
                            break;
                        }
                    }

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

            return { metaEntry, driverEntries, normalizedLookupName };
        },

        _filterMetadataExact(metadataCandidates, searchCtx) {
            const { exactAccentSearch, accentSearchTerm } = searchCtx;
            const exactMatchTerm = exactAccentSearch ? accentSearchTerm : searchCtx.searchLower;
            const useSpecialLetterFallback = exactAccentSearch && this._hasSpecialEuropeanLetters(exactMatchTerm);
            const foldedExactMatchTerm = useSpecialLetterFallback ? this._foldEuropeanSearchName(exactMatchTerm) : '';
            const reducedExactMatchTerm = useSpecialLetterFallback ? this._reduceEuropeanSearchName(exactMatchTerm) : '';

            let matched = metadataCandidates.filter(candidate => {
                const candidateName = this._normalizeExactDisplayName(candidate && candidate.name);
                return this._accentExactWordMatch(candidateName, exactMatchTerm);
            });

            if (matched.length === 0 && useSpecialLetterFallback) {
                matched = metadataCandidates.filter(candidate => {
                    const candidateName = this._normalizeExactDisplayName(candidate && candidate.name);
                    const foldedCandidateName = this._foldEuropeanSearchName(candidateName);
                    if (this._accentExactWordMatch(foldedCandidateName, foldedExactMatchTerm)) {
                        return true;
                    }
                    const reducedCandidateName = this._reduceEuropeanSearchName(candidateName);
                    return this._accentExactWordMatch(reducedCandidateName, reducedExactMatchTerm);
                });
            }

            return matched;
        },

        _filterMetadataPartialAccent(metadataCandidates, searchCtx) {
            const { accentSearchTerm } = searchCtx;
            const useSpecialLetterFallback = this._hasSpecialEuropeanLetters(accentSearchTerm);
            const foldedAccentSearchTerm = useSpecialLetterFallback ? this._foldEuropeanSearchName(accentSearchTerm) : '';
            const reducedAccentSearchTerm = useSpecialLetterFallback ? this._reduceEuropeanSearchName(accentSearchTerm) : '';

            return metadataCandidates.filter(candidate => {
                const candidateName = this._normalizeExactDisplayName(candidate && candidate.name);
                if (candidateName.includes(accentSearchTerm)) {
                    return true;
                }
                if (!useSpecialLetterFallback) {
                    return false;
                }
                const foldedCandidateName = this._foldEuropeanSearchName(candidateName);
                if (foldedCandidateName.includes(foldedAccentSearchTerm)) {
                    return true;
                }
                const reducedCandidateName = this._reduceEuropeanSearchName(candidateName);
                return reducedCandidateName.includes(reducedAccentSearchTerm);
            });
        },

        _filterEntriesByPathIds(filteredEntries, matchedMetadataCandidates) {
            const allowedPathIds = new Set(
                matchedMetadataCandidates
                    .map(candidate => this._extractPathId(candidate))
                    .filter(Boolean)
            );

            if (allowedPathIds.size === 0) {
                return filteredEntries;
            }
            return filteredEntries.filter(entry => allowedPathIds.has(this._extractPathId(entry)));
        },

        _filterLegacyEntriesExact(filteredEntries, searchCtx) {
            const { exactAccentSearch, accentSearchTerm } = searchCtx;
            const exactMatchTerm = exactAccentSearch ? accentSearchTerm : searchCtx.searchLower;
            const useSpecialLetterFallback = exactAccentSearch && this._hasSpecialEuropeanLetters(exactMatchTerm);
            const foldedExactMatchTerm = useSpecialLetterFallback ? this._foldEuropeanSearchName(exactMatchTerm) : '';
            const reducedExactMatchTerm = useSpecialLetterFallback ? this._reduceEuropeanSearchName(exactMatchTerm) : '';

            let matched = filteredEntries.filter(entry => {
                const entryName = this._normalizeExactDisplayName(entry && (entry.name || entry.Name));
                return this._accentExactWordMatch(entryName, exactMatchTerm);
            });

            if (matched.length === 0 && useSpecialLetterFallback) {
                matched = filteredEntries.filter(entry => {
                    const entryName = this._normalizeExactDisplayName(entry && (entry.name || entry.Name));
                    const foldedEntryName = this._foldEuropeanSearchName(entryName);
                    if (this._accentExactWordMatch(foldedEntryName, foldedExactMatchTerm)) {
                        return true;
                    }
                    const reducedEntryName = this._reduceEuropeanSearchName(entryName);
                    return this._accentExactWordMatch(reducedEntryName, reducedExactMatchTerm);
                });
            }

            return matched;
        },

        _filterLegacyEntriesPartialAccent(filteredEntries, searchCtx) {
            const { accentSearchTerm } = searchCtx;
            const useSpecialLetterFallback = this._hasSpecialEuropeanLetters(accentSearchTerm);
            const foldedAccentSearchTerm = useSpecialLetterFallback ? this._foldEuropeanSearchName(accentSearchTerm) : '';
            const reducedAccentSearchTerm = useSpecialLetterFallback ? this._reduceEuropeanSearchName(accentSearchTerm) : '';

            return filteredEntries.filter(entry => {
                const entryName = this._normalizeExactDisplayName(entry && (entry.name || entry.Name));
                if (entryName.includes(accentSearchTerm)) {
                    return true;
                }
                if (!useSpecialLetterFallback) {
                    return false;
                }
                const foldedEntryName = this._foldEuropeanSearchName(entryName);
                if (foldedEntryName.includes(foldedAccentSearchTerm)) {
                    return true;
                }
                const reducedEntryName = this._reduceEuropeanSearchName(entryName);
                return reducedEntryName.includes(reducedAccentSearchTerm);
            });
        },

        _buildResultsForMirrorKey(filteredEntries, metaEntry, mirrorKey, driverEntries, searchCtx) {
            const { isExactSearch, partialAccentSearch } = searchCtx;
            const normalizedLookupName = this._normalizeDriverLookupName(mirrorKey);
            const metadataCandidates = this._normalizeMetadataCandidates(metaEntry);

            if (metadataCandidates.length > 0) {
                let matchedMetadataCandidates = metadataCandidates;
                let matchedEntries = filteredEntries;

                if (isExactSearch) {
                    matchedMetadataCandidates = this._filterMetadataExact(metadataCandidates, searchCtx);
                    if (matchedMetadataCandidates.length === 0) return null;

                    matchedEntries = this._filterEntriesByPathIds(filteredEntries, matchedMetadataCandidates);
                    if (matchedEntries.length === 0) return null;
                } else if (partialAccentSearch) {
                    matchedMetadataCandidates = this._filterMetadataPartialAccent(metadataCandidates, searchCtx);
                    if (matchedMetadataCandidates.length === 0) return null;

                    matchedEntries = this._filterEntriesByPathIds(filteredEntries, matchedMetadataCandidates);
                    if (matchedEntries.length === 0) return null;
                }

                return this._buildMetadataSearchResultsForPathIds(matchedEntries, matchedMetadataCandidates, mirrorKey, driverEntries);
            }

            const mirrorMeta = {
                lookupKey: normalizedLookupName,
                displayName: mirrorKey,
                country: '',
                team: '',
                rank: '',
                hasMetadata: false
            };

            if (isExactSearch) {
                const matchedLegacyEntries = this._filterLegacyEntriesExact(filteredEntries, searchCtx);
                if (matchedLegacyEntries.length === 0) return null;
                return this._buildLegacySearchResults(matchedLegacyEntries, mirrorMeta, mirrorKey, driverEntries);
            }

            if (partialAccentSearch) {
                const matchedLegacyEntries = this._filterLegacyEntriesPartialAccent(filteredEntries, searchCtx);
                if (matchedLegacyEntries.length === 0) return null;
                return this._buildLegacySearchResults(matchedLegacyEntries, mirrorMeta, mirrorKey, driverEntries);
            }

            return this._buildLegacySearchResults(filteredEntries, mirrorMeta, mirrorKey, driverEntries);
        },

        _deduplicateResults(results) {
            const dedupedResultsByIdentity = new Map();

            for (const result of results) {
                const normalizedDriver = this._normalizeExactDisplayName(result.driver || '');
                const identityKey = result.pathId
                    ? `path:${String(result.pathId)}`
                    : `legacy:${normalizedDriver}|${String(result.country || '')}|${String(result.team || '')}`;

                if (!dedupedResultsByIdentity.has(identityKey)) {
                    dedupedResultsByIdentity.set(identityKey, {
                        ...result,
                        entries: Array.isArray(result.entries) ? [...result.entries] : []
                    });
                    continue;
                }

                const existing = dedupedResultsByIdentity.get(identityKey);
                const mergedEntries = [];
                const seenEntryKeys = new Set();
                const sourceEntries = []
                    .concat(Array.isArray(existing.entries) ? existing.entries : [])
                    .concat(Array.isArray(result.entries) ? result.entries : []);

                for (const entry of sourceEntries) {
                    const entryKey = [
                        this._extractPathId(entry),
                        String(entry.track_id || entry.TrackID || entry.trackId || ''),
                        String(entry.car_class || entry.CarClass || entry.Class || entry.class || ''),
                        String(entry.difficulty || entry.Difficulty || entry.driving_model || ''),
                        String(entry.lap_time || entry.LapTime || entry['Lap Time'] || '')
                    ].join('|');

                    if (seenEntryKeys.has(entryKey)) {
                        continue;
                    }
                    seenEntryKeys.add(entryKey);
                    mergedEntries.push(entry);
                }

                existing.entries = mergedEntries;
                if (!existing.country && result.country) {
                    existing.country = result.country;
                }
                if (!existing.team && result.team) {
                    existing.team = result.team;
                }
                if (!existing.rank && result.rank) {
                    existing.rank = result.rank;
                }
                if (!existing.avatar && result.avatar) {
                    existing.avatar = result.avatar;
                }
            }

            return Array.from(dedupedResultsByIdentity.values());
        },

        async searchDriver(driverName, filters = {}) {
            const driverMirror = await this.waitForDriverIndex();

            if (!driverMirror || Object.keys(driverMirror).length === 0) {
                throw new Error('Driver index is loading or unavailable. Please try again in a moment.');
            }

            const searchCtx = this._parseSearchInput(driverName);
            let matchedMirrorKeys = this._findMatchedMirrorKeys(driverMirror, searchCtx);

            if (matchedMirrorKeys.length === 0) {
                return [];
            }

            matchedMirrorKeys = this._capAndSortMirrorKeys(matchedMirrorKeys, searchCtx.searchLower);
            const shardCtx = await this._loadShardsForKeys(matchedMirrorKeys);

            const results = [];
            for (const mirrorKey of matchedMirrorKeys) {
                const { metaEntry, driverEntries } = await this._resolveDriverData(mirrorKey, shardCtx);

                if (!Array.isArray(driverEntries) || driverEntries.length === 0) {
                    continue;
                }

                const filteredEntries = this._filterDriverEntries(driverEntries, filters);
                if (filteredEntries.length === 0) {
                    continue;
                }

                const keyResults = this._buildResultsForMirrorKey(filteredEntries, metaEntry, mirrorKey, driverEntries, searchCtx);
                if (keyResults) {
                    results.push(...keyResults);
                }
            }

            return this._deduplicateResults(results);
        }
    };

    window.R3EDriverSearchService = DriverSearchService;
})();
