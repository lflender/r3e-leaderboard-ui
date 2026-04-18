(function () {
    const DriverIndexService = {
        _transformMirrorToNameIndex(mirrorData) {
            if (!mirrorData || typeof mirrorData !== 'object') return mirrorData;
            const firstKey = Object.keys(mirrorData)[0];
            if (firstKey === undefined) return mirrorData;
            // Detect indexed mirror format: keys are sequential numeric strings
            if (/^\d+$/.test(firstKey) && typeof mirrorData[firstKey] === 'string') {
                const nameIndex = {};
                for (const v of Object.values(mirrorData)) {
                    if (typeof v === 'string' && v) {
                        nameIndex[v] = v;
                    }
                }
                return nameIndex;
            }
            return mirrorData;
        },

        async loadDriverIndex(onProgress = null) {
            if (this.driverIndex) {
                return this.driverIndex;
            }

            const cached = this._getCachedDriverIndex();
            if (cached) {
                this.driverIndex = cached;
                setTimeout(() => { this._refreshDriverIndexInBackground(); }, 0);
                setTimeout(() => { this._updateLastIndexFromStatus(); }, 0);
                this._startIndexStatusRevalidator();
                return this.driverIndex;
            }

            if (this.driverIndexPromise) {
                return this.driverIndexPromise;
            }

            const maxAttempts = 10;
            const baseDelayMs = 250;
            this.driverIndexPromise = (async () => {
                for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                    try {
                        const mirrorData = await this._fetchDriverMirrorData();
                        this.driverIndex = this._transformMirrorToNameIndex(mirrorData);

                        if (!this.driverIndex || typeof this.driverIndex !== 'object') {
                            throw new Error('Driver name mirror index is not an object');
                        }
                        const keyCount = Object.keys(this.driverIndex).length;
                        if (keyCount === 0) {
                            throw new Error('Driver name mirror index is empty');
                        }
                        this.driverNameMirror = this.driverIndex;
                        this._saveDriverIndexToCache(this.driverIndex);
                        setTimeout(() => { this._updateLastIndexFromStatus(); }, 0);
                        this._startIndexStatusRevalidator();
                        return this.driverIndex;
                    } catch (error) {
                        const delay = baseDelayMs * Math.min(20, attempt);
                        console.warn(`Driver index load attempt ${attempt}/${maxAttempts} failed:`, error?.message || error);
                        if (attempt === maxAttempts) {
                            console.error('Giving up loading driver index after retries');
                            throw error;
                        }
                        await new Promise(r => setTimeout(r, delay));
                    }
                }
            })();

            return this.driverIndexPromise;
        },

        _getShardKeyForName(normalizedName) {
            if (!normalizedName || typeof normalizedName !== 'string') {
                return '_';
            }

            const firstChar = normalizedName.trim().charAt(0).toLowerCase();
            if (firstChar >= 'a' && firstChar <= 'z') {
                return firstChar;
            }
            return '_';
        },

        _normalizeDriverLookupName(name) {
            return String(name || '')
                .trim()
                .replace(/\s+/g, ' ')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase();
        },

        _extractDriverMirrorMetadata(mirrorKey, mirrorEntry) {
            if (mirrorEntry && typeof mirrorEntry === 'object' && !Array.isArray(mirrorEntry)) {
                const lookupKey = this._normalizeDriverLookupName(
                    mirrorEntry.lookup_key ||
                    mirrorEntry.lookupKey ||
                    mirrorEntry.canonical_key ||
                    mirrorEntry.canonicalKey ||
                    mirrorEntry.canonical_name ||
                    mirrorEntry.canonicalName ||
                    mirrorKey
                );

                return {
                    lookupKey: lookupKey || this._normalizeDriverLookupName(mirrorKey),
                    displayName: String(
                        mirrorEntry.name ||
                        mirrorEntry.canonical_name ||
                        mirrorEntry.canonicalName ||
                        mirrorKey
                    ),
                    country: String(mirrorEntry.country || ''),
                    team: String(mirrorEntry.team || ''),
                    rank: String(mirrorEntry.rank || ''),
                    hasMetadata: true
                };
            }

            return {
                lookupKey: this._normalizeDriverLookupName(String(mirrorEntry || mirrorKey)),
                displayName: String(mirrorEntry || mirrorKey),
                country: '',
                team: '',
                rank: '',
                hasMetadata: false
            };
        },

        async getDriverMetadata(driverName, driverMirror = null) {
            const mirror = driverMirror || this.driverIndex || this.driverNameMirror;
            if (!mirror || typeof mirror !== 'object') {
                return null;
            }

            const normalizedName = this._normalizeDriverLookupName(driverName);
            if (!normalizedName) {
                return null;
            }

            // Check driver exists in mirror
            if (!(normalizedName in mirror) && !(String(driverName) in mirror)) {
                return null;
            }

            // Load metadata from per-letter shard
            const shardKey = this._getShardKeyForName(normalizedName);
            try {
                const metadataShard = await this._loadDriverMetadataShard(shardKey);
                let metaEntry = metadataShard && metadataShard[normalizedName];

                // Fallback: diacritical names live in _ shard with search_name alias
                if (!metaEntry && shardKey !== '_') {
                    const fallbackShard = await this._loadDriverMetadataShard('_');
                    metaEntry = fallbackShard && fallbackShard[normalizedName];
                }

                if (metaEntry && typeof metaEntry === 'object') {
                    return {
                        lookupKey: normalizedName,
                        displayName: String(metaEntry.name || normalizedName),
                        country: String(metaEntry.country || ''),
                        team: String(metaEntry.team || ''),
                        rank: String(metaEntry.rank || ''),
                        originalKey: metaEntry._originalKey || null,
                        hasMetadata: true
                    };
                }
            } catch (_) {
                // Fall through to basic result
            }

            return {
                lookupKey: normalizedName,
                displayName: normalizedName,
                country: '',
                team: '',
                rank: '',
                originalKey: null,
                hasMetadata: false
            };
        },

        async enrichEntriesWithDriverMetadata(entries) {
            if (!Array.isArray(entries) || entries.length === 0) {
                return entries;
            }

            const driverMirror = await this.waitForDriverIndex();
            if (!driverMirror || typeof driverMirror !== 'object' || Object.keys(driverMirror).length === 0) {
                return entries;
            }

            // Collect unique shard keys needed for metadata lookup
            const shardKeysNeeded = new Set();
            entries.forEach(entry => {
                const driverName = window.DataNormalizer && typeof window.DataNormalizer.extractName === 'function'
                    ? window.DataNormalizer.extractName(entry)
                    : (entry.name || entry.Name || '');
                if (!driverName) return;
                const normalizedName = this._normalizeDriverLookupName(driverName);
                if (!(normalizedName in driverMirror)) return;
                shardKeysNeeded.add(this._getShardKeyForName(normalizedName));
            });

            // Always include _ shard for diacritical name fallback
            shardKeysNeeded.add('_');

            // Pre-load all needed metadata shards in parallel
            await Promise.all([...shardKeysNeeded].map(key =>
                this._loadDriverMetadataShard(key).catch(() => null)
            ));

            // Enrich from cached metadata shards
            entries.forEach(entry => {
                const driverName = window.DataNormalizer && typeof window.DataNormalizer.extractName === 'function'
                    ? window.DataNormalizer.extractName(entry)
                    : (entry.name || entry.Name || '');
                if (!driverName) return;

                const normalizedName = this._normalizeDriverLookupName(driverName);
                if (!(normalizedName in driverMirror)) return;

                const shardKey = this._getShardKeyForName(normalizedName);
                let metadataShard = this.driverMetadataShardCache.get(shardKey);
                let metaEntry = metadataShard && metadataShard[normalizedName];

                // Fallback: diacritical names live in _ shard with search_name alias
                if (!metaEntry && shardKey !== '_') {
                    metadataShard = this.driverMetadataShardCache.get('_');
                    metaEntry = metadataShard && metadataShard[normalizedName];
                }

                if (!metaEntry || typeof metaEntry !== 'object') return;

                if (metaEntry.country) {
                    entry.country = metaEntry.country;
                    entry.Country = metaEntry.country;
                }
                entry.team = metaEntry.team || '';
                entry.Team = metaEntry.team || '';
                entry.rank = metaEntry.rank || '';
                entry.Rank = metaEntry.rank || '';
            });

            return entries;
        },

        async _loadDriverShard(shardKey) {
            const safeShardKey = (typeof shardKey === 'string' && shardKey.length > 0) ? shardKey : '_';

            if (this.driverShardCache.has(safeShardKey)) {
                return this.driverShardCache.get(safeShardKey);
            }

            if (this.driverShardPromises.has(safeShardKey)) {
                return this.driverShardPromises.get(safeShardKey);
            }

            const shardPromise = (async () => {
                const parsed = await this._fetchSingleDriverShard(safeShardKey);
                this.driverShardCache.set(safeShardKey, parsed);
                return parsed;
            })();

            this.driverShardPromises.set(safeShardKey, shardPromise);
            try {
                return await shardPromise;
            } finally {
                this.driverShardPromises.delete(safeShardKey);
            }
        },

        async _fetchSingleDriverShard(shardKey) {
            const maxAttempts = 6;
            const baseDelayMs = 200;

            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                try {
                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), 8000);
                    const timestamp = Date.now();
                    const response = await fetch(`${this.driverShardBasePath}/${shardKey}.json.gz?v=${timestamp}`, {
                        cache: 'no-store',
                        headers: {
                            'Cache-Control': 'no-cache, no-store, must-revalidate',
                            'Pragma': 'no-cache',
                            'Expires': '0'
                        },
                        signal: controller.signal
                    });
                    clearTimeout(timeout);

                    if (!response.ok) {
                        throw new Error(`Failed to load shard ${shardKey}: ${response.status} ${response.statusText}`);
                    }

                    const helper = this._getCompressedJsonHelper();
                    const text = await helper.readGzipText(response);
                    if (!text || text.trim().length === 0) {
                        throw new Error(`Shard ${shardKey} response is empty`);
                    }

                    const parsed = await this._parseJsonWhenIdle(text);
                    if (!parsed || typeof parsed !== 'object') {
                        throw new Error(`Shard ${shardKey} is not an object`);
                    }

                    return parsed;
                } catch (error) {
                    const delay = baseDelayMs * Math.min(20, attempt);
                    if (attempt === maxAttempts) {
                        throw error;
                    }
                    await new Promise(r => setTimeout(r, delay));
                }
            }

            throw new Error(`Failed to load shard ${shardKey}`);
        },

        async _loadDriverMetadataShard(shardKey) {
            const safeShardKey = (typeof shardKey === 'string' && shardKey.length > 0) ? shardKey : '_';

            if (this.driverMetadataShardCache.has(safeShardKey)) {
                return this.driverMetadataShardCache.get(safeShardKey);
            }

            if (this.driverMetadataShardPromises.has(safeShardKey)) {
                return this.driverMetadataShardPromises.get(safeShardKey);
            }

            const shardPromise = (async () => {
                const parsed = await this._fetchSingleDriverMetadataShard(safeShardKey);
                this._buildSearchNameAliases(parsed);
                this.driverMetadataShardCache.set(safeShardKey, parsed);
                return parsed;
            })();

            this.driverMetadataShardPromises.set(safeShardKey, shardPromise);
            try {
                return await shardPromise;
            } finally {
                this.driverMetadataShardPromises.delete(safeShardKey);
            }
        },

        async _fetchSingleDriverMetadataShard(shardKey) {
            const maxAttempts = 6;
            const baseDelayMs = 200;

            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                try {
                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), 8000);
                    const timestamp = Date.now();
                    const response = await fetch(`${this.driverMetadataBasePath}/${shardKey}.json.gz?v=${timestamp}`, {
                        cache: 'no-store',
                        headers: {
                            'Cache-Control': 'no-cache, no-store, must-revalidate',
                            'Pragma': 'no-cache',
                            'Expires': '0'
                        },
                        signal: controller.signal
                    });
                    clearTimeout(timeout);

                    if (!response.ok) {
                        throw new Error(`Failed to load metadata shard ${shardKey}: ${response.status} ${response.statusText}`);
                    }

                    const helper = this._getCompressedJsonHelper();
                    const text = await helper.readGzipText(response);
                    if (!text || text.trim().length === 0) {
                        throw new Error(`Metadata shard ${shardKey} response is empty`);
                    }

                    const parsed = await this._parseJsonWhenIdle(text);
                    if (!parsed || typeof parsed !== 'object') {
                        throw new Error(`Metadata shard ${shardKey} is not an object`);
                    }

                    return parsed;
                } catch (error) {
                    const delay = baseDelayMs * Math.min(20, attempt);
                    if (attempt === maxAttempts) {
                        throw error;
                    }
                    await new Promise(r => setTimeout(r, delay));
                }
            }

            throw new Error(`Failed to load metadata shard ${shardKey}`);
        },

        _buildSearchNameAliases(parsed) {
            const aliasesToAdd = [];
            for (const [key, entry] of Object.entries(parsed)) {
                if (entry && typeof entry === 'object' && entry.search_name && entry.search_name !== key) {
                    if (!(entry.search_name in parsed)) {
                        entry._originalKey = key;
                        aliasesToAdd.push([entry.search_name, entry]);
                    }
                }
            }
            for (const [alias, entry] of aliasesToAdd) {
                parsed[alias] = entry;
            }
        },

        async _fetchDriverMirrorData() {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            const response = await fetch(`${this.driverMirrorPath}?v=${Date.now()}`, {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                },
                signal: controller.signal
            });
            clearTimeout(timeout);

            if (!response.ok) {
                throw new Error(`Failed to load driver index: ${response.status} ${response.statusText}`);
            }

            const helper = this._getCompressedJsonHelper();
            const text = await helper.readGzipText(response);
            if (!text || text.trim().length === 0) {
                throw new Error('Driver name mirror response is empty');
            }

            const parsed = await this._parseJsonWhenIdle(text);
            if (!parsed || typeof parsed !== 'object' || Object.keys(parsed).length === 0) {
                throw new Error('Driver name mirror index is invalid');
            }

            return parsed;
        },

        async _streamParseDriverIndex(response, onProgress) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let text = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }

                text += decoder.decode(value, { stream: true });
            }

            text += decoder.decode();
            const index = JSON.parse(text);
            if (!index || typeof index !== 'object' || Array.isArray(index)) {
                return {};
            }

            if (onProgress) {
                Object.entries(index).forEach(([driverName, entries]) => {
                    onProgress(driverName, entries);
                });
            }

            return index;
        },

        async waitForDriverIndex(maxAttempts = 50) {
            if (this.driverIndex !== null) {
                return this.driverIndex;
            }

            const promise = this.loadDriverIndex();
            if (promise && typeof promise.then === 'function') {
                try {
                    const timeoutMs = Math.max(5000, maxAttempts * 250);
                    return await this._withTimeout(promise, timeoutMs);
                } catch (e) {
                    console.error('waitForDriverIndex timed out or failed:', e?.message || e);
                    return this.driverIndex || {};
                }
            }

            return this.driverIndex || {};
        },

        async _parseJsonWhenIdle(text) {
            if (typeof requestIdleCallback === 'function') {
                return await new Promise((resolve, reject) => {
                    requestIdleCallback(() => {
                        try { resolve(JSON.parse(text)); }
                        catch (e) { reject(e); }
                    }, { timeout: 2000 });
                });
            }
            return JSON.parse(text);
        },

        _getCachedDriverIndex() {
            if (!this.ENABLE_INDEX_LOCAL_CACHE) return null;
            try {
                const raw = localStorage.getItem(this.DRIVER_INDEX_CACHE_KEY);
                if (!raw) return null;
                const parsed = JSON.parse(raw);
                if (!parsed || typeof parsed !== 'object') return null;
                if (Object.keys(parsed).length === 0) return null;
                return parsed;
            } catch (_) {
                return null;
            }
        },

        _saveDriverIndexToCache(idx) {
            if (!this.ENABLE_INDEX_LOCAL_CACHE) return;
            try {
                localStorage.setItem(this.DRIVER_INDEX_CACHE_KEY, JSON.stringify(idx));
            } catch (_) {
                // Ignore storage errors
            }
        },

        async _refreshDriverIndexInBackground() {
            try {
                const maxAttempts = 5;
                const baseDelayMs = 250;
                for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                    try {
                        const parsed = await this._fetchDriverMirrorData();
                        if (!parsed || typeof parsed !== 'object' || Object.keys(parsed).length === 0) {
                            throw new Error('Invalid index');
                        }
                        const transformed = this._transformMirrorToNameIndex(parsed);
                        this.driverIndex = transformed;
                        this.driverNameMirror = transformed;
                        this.driverShardCache.clear();
                        this.driverShardPromises.clear();
                        this.driverMetadataShardCache.clear();
                        this.driverMetadataShardPromises.clear();
                        this._saveDriverIndexToCache(transformed);
                        setTimeout(() => { this._updateLastIndexFromStatus(); }, 0);
                        return;
                    } catch (e) {
                        if (attempt === maxAttempts) return;
                        await new Promise(r => setTimeout(r, baseDelayMs * Math.min(20, attempt)));
                    }
                }
            } catch (_) {
                // Swallow background refresh failures
            }
        },

        _withTimeout(promise, ms) {
            return new Promise((resolve, reject) => {
                const t = setTimeout(() => reject(new Error('Timeout')), ms);
                promise.then(v => { clearTimeout(t); resolve(v); })
                    .catch(e => { clearTimeout(t); reject(e); });
            });
        },

        async _updateLastIndexFromStatus() {
            try {
                const status = await this.calculateStatus();
                const latest = status && (status.last_index_update || status.last_scrape_end) || null;
                if (latest) this.lastIndexUpdate = String(latest);
            } catch (_) { /* ignore */ }
        },

        _startIndexStatusRevalidator() {
            if (this.indexRevalidatorStarted) return;
            this.indexRevalidatorStarted = true;

            const baseIntervalMs = 10 * 60 * 1000;
            const jitterMs = Math.floor(Math.random() * 60 * 1000);

            const runCheck = async () => {
                try {
                    if (typeof document !== 'undefined' && document.hidden) return;
                    const status = await this.calculateStatus();
                    const latest = status && (status.last_index_update || status.last_scrape_end) || null;
                    if (!latest) return;
                    const latestStr = String(latest);
                    if (!this.lastIndexUpdate) {
                        this.lastIndexUpdate = latestStr;
                        return;
                    }
                    if (latestStr !== this.lastIndexUpdate) {
                        this.lastIndexUpdate = latestStr;
                        await this._refreshDriverIndexInBackground();
                    }
                } catch (_) { /* ignore */ }
            };

            if (typeof document !== 'undefined') {
                document.addEventListener('visibilitychange', () => {
                    if (!document.hidden) setTimeout(runCheck, 500);
                });
            }

            setTimeout(runCheck, 2000 + jitterMs);
            setInterval(runCheck, baseIntervalMs + jitterMs);
        }
    };

    window.R3EDriverIndexService = DriverIndexService;
})();
