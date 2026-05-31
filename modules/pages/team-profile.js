/**
 * Team Profile Page Module
 * Displays a single team's profile: header, stat cards, members table, entries table.
 */

class TeamProfilePage {
    constructor() {
        this.elements = {
            profileContainer: document.getElementById('team-profile-container')
        };

        if (!this.elements.profileContainer) return;

        this._profileMembers = [];
        this._profileSortKey = this._loadSortPref('teamProfileSort') || 'bested';
        this._profileSortDir = 'desc';
        this._memberStatMap = new Map();
        this._entriesSortBy = this._loadSortPref('teamEntriesSort') || 'gapPercent';
        this._entriesPage = 1;
        this._entriesPerPage = 50;
        this._teamEntries = [];

        this.init();
    }

    init() {
        const teamName = R3EUrlUtils.getUrlParam('team');
        if (!teamName) return;
        this.loadTeamProfile(teamName);
    }

    async loadTeamProfile(teamName) {
        if (!window.dataService || typeof window.dataService.loadTeams !== 'function') return;

        await TemplateHelper.showLoading(this.elements.profileContainer, 'Loading team...');

        try {
            const teams = await window.dataService.loadTeams();
            const team = teams[teamName];
            if (!team) {
                this.elements.profileContainer.innerHTML = '<div class="error"><strong>Error:</strong> Team not found.</div>';
                return;
            }
            await this.showTeamProfile(teamName, team);
        } catch (err) {
            this.elements.profileContainer.innerHTML = '<div class="error"><strong>Error:</strong> Failed to load team data.</div>';
        }
    }

    async showTeamProfile(teamName, members) {
        const enrichedMembers = await this._enrichMembers(members);
        this._profileMembers = enrichedMembers;
        this._memberStatMap = new Map();

        const escapedName = R3EUtils.escapeHtml(teamName);
        const teamFlag = this._getTeamFlag(enrichedMembers);

        // Header tile
        let html = '<div class="driver-profile-header">';
        html += '<div class="driver-profile-info">';
        html += `<h2 class="driver-profile-name">${teamFlag}${escapedName}</h2>`;
        html += `<p class="driver-profile-meta">${enrichedMembers.length} member${enrichedMembers.length !== 1 ? 's' : ''}</p>`;
        html += '</div></div>';

        // Stat cards grid (loading state)
        html += '<div class="driver-stats-grid team-stats-grid" id="team-totals">';
        const statDefs = [
            { key: 'avg_bested', label: 'Average Bested %' },
            { key: 'bested', label: 'Drivers Bested' },
            { key: 'pole', label: 'Pole Positions' },
            { key: 'podium', label: 'Podiums' },
            { key: 'entries', label: 'Entries' }
        ];
        for (const stat of statDefs) {
            html += `<div class="driver-stat-card driver-stat-card--loading" id="team-stat-${stat.key}">`;
            html += `<div class="driver-stat-label">${stat.label}</div>`;
            html += '<div class="driver-stat-value"><span class="driver-stat-spinner"></span></div>';
            html += '</div>';
        }
        html += '</div>';

        // Members table tile
        html += '<div class="team-section-tile">';
        html += '<h3 class="team-section-tile-title">Members</h3>';
        html += this._renderProfileTable(enrichedMembers);
        html += '</div>';

        // Charts containers (populated after entries load)
        html += '<div id="team-charts-wrapper" class="driver-profile-distributions-grid" style="display:none">';
        html += '<div class="driver-profile-dist-card" id="team-dist-chart-container"></div>';
        html += '<div class="driver-profile-dist-card" id="team-perf-chart-container"></div>';
        html += '</div>';

        // Entries container tile
        html += '<div class="team-section-tile" id="team-entries-container"></div>';

        this.elements.profileContainer.innerHTML = html;
        this._bindSortHandlers();

        // Lazily load stats and entries in parallel
        this._loadMemberStats(enrichedMembers);
        this._loadTeamEntries(enrichedMembers);
    }

    // ── localStorage helpers ──────────────────────────

    _loadSortPref(key) {
        try {
            const val = localStorage.getItem(key);
            return val || null;
        } catch (_) { return null; }
    }

    _saveSortPref(key, value) {
        try { localStorage.setItem(key, value); } catch (_) { /* ignored */ }
    }

    // ── Members table ─────────────────────────────────

    _renderProfileTable(members) {
        const buildDriverCell = window.StatsRenderer && window.StatsRenderer.buildDriverCell;
        const sortKey = this._profileSortKey;
        const sortDir = this._profileSortDir;
        const statMap = this._memberStatMap;
        const formatValue = (window.DriverStatsService && DriverStatsService.formatValue) ||
            ((v, fmt) => fmt === 'percent' ? v.toFixed(1) + '%' : Number(v).toLocaleString());

        const sorted = this._sortMembers(members);

        const cols = [
            { key: 'driver', label: 'Driver' },
            { key: 'avg_bested', label: 'Avg Bested' },
            { key: 'bested', label: 'Bested' },
            { key: 'pole', label: 'Poles' },
            { key: 'podium', label: 'Podiums' },
            { key: 'entries', label: 'Entries' }
        ];

        let html = '<table class="results-table team-profile-table">';
        html += '<thead><tr>';
        html += '<th class="stats-pos-th">#</th>';
        for (const col of cols) {
            const isActive = sortKey === col.key;
            const activeClass = isActive ? ' sort-active' : '';
            const cssClass = col.key === 'driver' ? '' : ' team-stat-col';
            html += `<th class="sortable${activeClass}${cssClass}" data-sort="${col.key}">${col.label}</th>`;
        }
        html += '</tr></thead>';
        html += '<tbody>';

        sorted.forEach((member, idx) => {
            const posBadge = window.StatsRenderer
                ? window.StatsRenderer.buildPositionBadge(idx + 1)
                : `<span class="pos-number">${idx + 1}</span>`;

            let driverCell;
            if (buildDriverCell) {
                driverCell = buildDriverCell({
                    name: member.name,
                    country: member.country || '',
                    rank: member.rank || '',
                    path_id: member.path_id || '',
                    avatar: member.avatar || null,
                    team: null
                });
            } else {
                const memberName = R3EUtils.escapeHtml(member.name);
                const profileLink = `drivers.html?driver=${encodeURIComponent('"' + member.name + '"')}&id=${encodeURIComponent(member.path_id)}`;
                driverCell = `<a href="${profileLink}">${memberName}</a>`;
            }

            const pathId = member.path_id || '';
            const values = statMap.get(pathId) || {};
            const statKeys = ['avg_bested', 'bested', 'pole', 'podium', 'entries'];

            html += `<tr data-path-id="${R3EUtils.escapeHtml(pathId)}" data-name="${R3EUtils.escapeHtml(member.name)}">`;
            html += `<td class="pos-cell">${posBadge}</td>`;
            html += `<td class="stats-driver-cell">${driverCell}</td>`;
            for (const sk of statKeys) {
                const val = values[sk];
                const fmt = sk === 'avg_bested' ? 'percent' : 'number';
                const display = val != null ? formatValue(val, fmt) : '\u2014';
                html += `<td class="team-stat-col">${display}</td>`;
            }
            html += '</tr>';
        });

        html += '</tbody></table>';
        return html;
    }

    _sortMembers(members) {
        const key = this._profileSortKey;
        const dir = this._profileSortDir;
        const statMap = this._memberStatMap;

        return [...members].sort((a, b) => {
            if (key === 'driver') {
                const cmp = a.name.localeCompare(b.name);
                return dir === 'asc' ? cmp : -cmp;
            }
            const aVals = statMap.get(a.path_id || '') || {};
            const bVals = statMap.get(b.path_id || '') || {};
            const aVal = aVals[key] ?? -Infinity;
            const bVal = bVals[key] ?? -Infinity;
            if (aVal === bVal) return a.name.localeCompare(b.name);
            return dir === 'desc' ? bVal - aVal : aVal - bVal;
        });
    }

    _bindSortHandlers() {
        const headers = this.elements.profileContainer.querySelectorAll('.team-profile-table th.sortable');
        headers.forEach(th => {
            th.addEventListener('click', () => {
                const newKey = th.dataset.sort;
                if (this._profileSortKey === newKey) {
                    this._profileSortDir = this._profileSortDir === 'desc' ? 'asc' : 'desc';
                } else {
                    this._profileSortKey = newKey;
                    this._profileSortDir = newKey === 'driver' ? 'asc' : 'desc';
                }
                this._saveSortPref('teamProfileSort', this._profileSortKey);
                this._rerenderProfileTable();
            });
        });

        // Wire members table hover via TeamProfileInteractions
        const membersTable = this.elements.profileContainer.querySelector('.team-profile-table');
        if (membersTable && window.TeamProfileInteractions) {
            TeamProfileInteractions.wireTableHover(this.elements.profileContainer, membersTable);
        }
    }

    _rerenderProfileTable() {
        const oldTable = this.elements.profileContainer.querySelector('.team-profile-table');
        if (oldTable) oldTable.remove();
        const tile = this.elements.profileContainer.querySelector('.team-section-tile');
        if (tile) {
            tile.innerHTML = '<h3 class="team-section-tile-title">Members</h3>' + this._renderProfileTable(this._profileMembers);
        }
        this._bindSortHandlers();
    }

    // ── Stats loading ─────────────────────────────────

    _loadMemberStats(members) {
        if (!window.DriverStatsService || !window.StatsData) return Promise.resolve();

        const statKeys = ['avg_bested', 'bested', 'pole', 'podium', 'entries'];

        const promises = members.map(member => {
            const pathId = member.path_id || '';
            return Promise.all(
                statKeys.map(key => DriverStatsService.lookupSingleStat(member.name, key, pathId))
            ).then(results => {
                const values = { avg_bested: null, bested: null, pole: null, podium: null, entries: null };
                statKeys.forEach((key, i) => {
                    if (results[i]) values[key] = results[i].value;
                });
                this._memberStatMap.set(pathId, values);
                this._updateMemberRow(pathId, values);
                this._updateTotalCards();
            }).catch(() => {
                this._memberStatMap.set(pathId, { avg_bested: null, bested: null, pole: null, podium: null, entries: null });
                this._updateMemberRow(pathId, { avg_bested: null, bested: null, pole: null, podium: null, entries: null });
                this._updateTotalCards();
            });
        });

        return Promise.all(promises).then(() => {
            this._rerenderProfileTable();
        });
    }

    _updateMemberRow(pathId, values) {
        const escapedId = (window.CSS && CSS.escape) ? CSS.escape(pathId) : pathId.replace(/"/g, '\\"');
        const row = this.elements.profileContainer.querySelector(`tr[data-path-id="${escapedId}"]`);
        if (!row) return;
        const formatValue = (window.DriverStatsService && DriverStatsService.formatValue) ||
            ((v, fmt) => fmt === 'percent' ? v.toFixed(1) + '%' : Number(v).toLocaleString());
        const statKeys = ['avg_bested', 'bested', 'pole', 'podium', 'entries'];
        const cells = row.querySelectorAll('td.team-stat-col');
        statKeys.forEach((key, i) => {
            if (!cells[i]) return;
            const val = values[key];
            const fmt = key === 'avg_bested' ? 'percent' : 'number';
            cells[i].textContent = val != null ? formatValue(val, fmt) : '\u2014';
        });
    }

    _updateTotalCards() {
        const formatValue = (window.DriverStatsService && DriverStatsService.formatValue) ||
            ((v, fmt) => fmt === 'percent' ? v.toFixed(1) + '%' : Number(v).toLocaleString());

        let sumBested = 0, sumPole = 0, sumPodium = 0, sumEntries = 0;
        let sumAvgBested = 0, avgCount = 0;

        for (const values of this._memberStatMap.values()) {
            if (values.bested != null) sumBested += values.bested;
            if (values.pole != null) sumPole += values.pole;
            if (values.podium != null) sumPodium += values.podium;
            if (values.entries != null) sumEntries += values.entries;
            if (values.avg_bested != null) { sumAvgBested += values.avg_bested; avgCount++; }
        }

        const avgBested = avgCount > 0 ? sumAvgBested / avgCount : null;
        const totals = {
            avg_bested: avgBested != null ? formatValue(avgBested, 'percent') : '\u2014',
            bested: formatValue(sumBested, 'number'),
            pole: formatValue(sumPole, 'number'),
            podium: formatValue(sumPodium, 'number'),
            entries: formatValue(sumEntries, 'number')
        };

        for (const [key, display] of Object.entries(totals)) {
            const card = document.getElementById('team-stat-' + key);
            if (!card) continue;
            card.classList.remove('driver-stat-card--loading');
            const valueEl = card.querySelector('.driver-stat-value');
            if (valueEl) valueEl.textContent = display;
        }
    }

    // ── Entries table ─────────────────────────────────

    async _loadTeamEntries(members) {
        if (!window.dataService || typeof window.dataService.searchDriver !== 'function') return;

        const container = this.elements.profileContainer.querySelector('#team-entries-container');
        if (!container) return;

        container.innerHTML = '<h3 class="team-section-tile-title">Entries</h3><p class="loading-text">Loading entries...</p>';

        const allEntries = [];
        await Promise.all(
            members.map(async (member) => {
                try {
                    const results = await dataService.searchDriver(`"${member.name}"`, {});
                    const match = results.find(r => String(r.pathId || '') === String(member.path_id || '')) || results[0];
                    if (match && Array.isArray(match.entries)) {
                        for (const entry of match.entries) {
                            allEntries.push({
                                ...entry,
                                name: member.name,
                                path_id: member.path_id || '',
                                country: member.country || entry.country || entry.Country || '',
                                rank: member.rank || entry.rank || entry.Rank || '',
                                avatar: member.avatar || entry.avatar || null
                            });
                        }
                    }
                } catch (_) { /* skip failed lookups */ }
            })
        );

        if (allEntries.length === 0) {
            container.innerHTML = '';
            return;
        }

        this._teamEntries = allEntries;
        this._entriesPage = 1;
        this._sortTeamEntries();
        this._renderEntriesTable();
        this._renderTeamCharts(allEntries);
    }

    _renderTeamCharts(entries) {
        if (!window.TeamCharts) return;
        const wrapper = this.elements.profileContainer.querySelector('#team-charts-wrapper');
        const distContainer = this.elements.profileContainer.querySelector('#team-dist-chart-container');
        const perfContainer = this.elements.profileContainer.querySelector('#team-perf-chart-container');
        if (!wrapper || !distContainer || !perfContainer) return;

        const colorMap = TeamCharts.buildColorMap(entries);
        const distHtml = TeamCharts.generateEntriesDistribution(entries, colorMap);
        const perfHtml = TeamCharts.generatePerformanceChart(entries, colorMap);

        if (!distHtml && !perfHtml) return;

        if (distHtml) {
            distContainer.innerHTML = distHtml;
            distContainer.style.display = '';
        } else {
            distContainer.style.display = 'none';
        }

        if (perfHtml) {
            perfContainer.innerHTML = perfHtml;
            perfContainer.style.display = '';
        } else {
            perfContainer.style.display = 'none';
        }

        wrapper.style.display = '';

        // Wire chart interactions via dedicated interactions module
        if (window.TeamProfileInteractions) {
            TeamProfileInteractions.wireChartInteractions(
                this.elements.profileContainer, distContainer, perfContainer
            );
        } else {
            TeamCharts.wireInteractions(distContainer, perfContainer);
        }
    }

    _sortTeamEntries() {
        const tr = window.tableRenderer;
        if (tr && tr.sortService) {
            tr.sortService.sortDriverEntries(this._teamEntries, this._entriesSortBy);
        } else {
            this._teamEntries.sort((a, b) => {
                const posA = parseInt(a.position || a.Position || 999999);
                const posB = parseInt(b.position || b.Position || 999999);
                return posA - posB;
            });
        }
    }

    _renderEntriesTable() {
        const container = this.elements.profileContainer.querySelector('#team-entries-container');
        if (!container) return;

        const entries = this._teamEntries;
        const totalEntries = entries.length;
        const totalPages = Math.ceil(totalEntries / this._entriesPerPage);
        const startIndex = (this._entriesPage - 1) * this._entriesPerPage;
        const endIndex = Math.min(startIndex + this._entriesPerPage, totalEntries);
        const pageEntries = entries.slice(startIndex, endIndex);

        const tr = window.tableRenderer;
        const buildDriverCell = window.StatsRenderer && window.StatsRenderer.buildDriverCell;

        let keys = null;
        if (pageEntries.length > 0 && window.ColumnConfig) {
            const dataKeys = Object.keys(pageEntries[0]);
            const hasTrackId = dataKeys.some(k => ['track_id', 'TrackID', 'trackId'].includes(k));
            const hasTrack = dataKeys.some(k => ['Track', 'track'].includes(k));
            const keysForDisplay = hasTrackId && !hasTrack ? dataKeys.concat('track') : dataKeys;
            const filtered = keysForDisplay.filter(k => k !== 'avatar');
            keys = window.ColumnConfig.getOrderedColumns(filtered, { addSynthetic: true });
        }

        const sortBy = this._entriesSortBy;
        let html = '<table class="results-table team-entries-table">';
        html += '<thead><tr>';
        html += '<th>Driver</th>';
        if (keys && tr) {
            for (const key of keys) {
                html += tr.renderHeaderCell(key, sortBy);
            }
        }
        html += '</tr></thead>';
        html += '<tbody>';

        for (const entry of pageEntries) {
            let driverCell = '';
            if (buildDriverCell) {
                driverCell = buildDriverCell({
                    name: entry.name || entry.Name || '',
                    country: entry.country || entry.Country || '',
                    rank: entry.rank || entry.Rank || '',
                    path_id: entry.path_id || entry.pathId || '',
                    avatar: entry.avatar || null,
                    team: null
                });
            } else {
                driverCell = R3EUtils.escapeHtml(entry.name || entry.Name || '');
            }

            html += '<tr class="driver-data-row"';
            if (tr) {
                const trackId = entry.track_id || entry.TrackID || '';
                const classId = entry.class_id || entry.ClassID || '';
                html += ` onclick="openDetailView(event, this)"`;
                html += ` data-position="${parseInt(String(entry.position || entry.Position || '').toString().replace(/[^0-9]/g, '')) || ''}"`;
                html += ` data-trackid="${R3EUtils.escapeHtml(String(trackId))}"`;
                html += ` data-classid="${R3EUtils.escapeHtml(String(classId))}"`;
                html += ` data-name="${R3EUtils.escapeHtml(entry.name || entry.Name || '')}"`;
                html += ` data-time="${R3EUtils.escapeHtml(String(entry.laptime || entry.LapTime || entry.lap_time || ''))}"`;
            }
            html += '>';
            html += `<td class="stats-driver-cell">${driverCell}</td>`;
            if (keys && tr) {
                for (const key of keys) {
                    if (key === 'GapPercent') {
                        html += tr.renderGapPercentCell(entry, null);
                    } else {
                        html += tr.renderCell(entry, key);
                    }
                }
            }
            html += '</tr>';
        }

        html += '</tbody></table>';

        if (totalPages > 1) {
            const infoText = `Showing entries ${startIndex + 1}\u2013${endIndex} of ${totalEntries}`;
            html += window.generatePaginationHTML({
                startIndex,
                endIndex,
                total: totalEntries,
                currentPage: this._entriesPage,
                totalPages,
                onPageChange: 'goToEntriesPage',
                infoText
            });
        }

        container.innerHTML = '<h3 class="team-section-tile-title">Entries</h3>' + html;

        // Wire entries table hover via TeamProfileInteractions
        const table = container.querySelector('.team-entries-table');
        if (table && window.TeamProfileInteractions) {
            TeamProfileInteractions.wireTableHover(this.elements.profileContainer, table);
        }

        window.goToEntriesPage = (page) => {
            this._entriesPage = page;
            this._renderEntriesTable();
            container.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };

        this._bindEntriesSortHandlers();
    }

    _bindEntriesSortHandlers() {
        const container = this.elements.profileContainer.querySelector('#team-entries-container');
        if (!container) return;
        const headers = container.querySelectorAll('th[data-sort-key]');
        headers.forEach(th => {
            th.addEventListener('click', () => {
                let sortBy = th.getAttribute('data-sort-key');
                if (sortBy === 'lapTimeToggle') {
                    if (this._entriesSortBy === 'gap') {
                        sortBy = 'lapTime';
                    } else if (this._entriesSortBy === 'lapTime') {
                        sortBy = 'gap';
                    } else {
                        sortBy = 'gap';
                    }
                }
                if (this._entriesSortBy === sortBy) return;
                this._entriesSortBy = sortBy;
                this._saveSortPref('teamEntriesSort', sortBy);
                this._entriesPage = 1;
                this._sortTeamEntries();
                this._renderEntriesTable();
            });
        });
    }

    // ── Team flag (majority country) ─────────────────

    _getTeamFlag(enrichedMembers) {
        const counts = {};
        let total = 0;
        for (const m of enrichedMembers) {
            if (m.country) {
                counts[m.country] = (counts[m.country] || 0) + 1;
                total++;
            }
        }
        let dominant = null;
        let maxCount = 0;
        for (const [country, count] of Object.entries(counts)) {
            if (count > maxCount) {
                maxCount = count;
                dominant = country;
            }
        }
        const flag = (dominant && maxCount / total > 0.5)
            ? window.FlagHelper?.countryToFlag(dominant) || ''
            : window.FlagHelper?.countryToFlag('Various') || '';
        return flag ? `<span class="team-flag">${flag}</span> ` : '';
    }

    // ── Enrich members ────────────────────────────────

    async _enrichMembers(members) {
        if (!window.dataService || typeof window.dataService._loadDriverMetadataShard !== 'function') {
            return members;
        }

        const ds = window.dataService;
        const normalize = ds._normalizeDriverLookupName.bind(ds);
        const getShardKey = ds._getShardKeyForName.bind(ds);

        const shardKeys = new Set();
        for (const m of members) {
            shardKeys.add(getShardKey(normalize(m.name)));
        }

        const shardEntries = await Promise.all(
            [...shardKeys].map(async key => {
                try {
                    const shard = await ds._loadDriverMetadataShard(key);
                    return [key, shard];
                } catch (_) {
                    return [key, null];
                }
            })
        );
        const shardMap = new Map(shardEntries);

        return members.map(m => {
            const normalizedName = normalize(m.name);
            const shardKey = getShardKey(normalizedName);
            const shard = shardMap.get(shardKey);
            if (!shard) return m;

            const metaEntry = shard[normalizedName];
            if (!metaEntry) return m;

            let match;
            if (Array.isArray(metaEntry)) {
                match = metaEntry.find(e => String(e.path_id) === String(m.path_id)) || metaEntry[0];
            } else {
                match = metaEntry;
            }

            return {
                ...m,
                country: match.country || m.country || '',
                rank: match.rank || m.rank || '',
                avatar: match.avatar || m.avatar || null
            };
        });
    }
}

// Expose class for testing
window.TeamProfilePage = TeamProfilePage;

// Auto-initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    window.teamProfilePage = new TeamProfilePage();
});
