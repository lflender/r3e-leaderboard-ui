/**
 * Teams Page Module
 * Handles team search and listing only. Profile is on team-profile.html.
 */

class TeamsPage {
    constructor() {
        this.elements = {
            teamSearch: document.getElementById('team-search'),
            resultsContainer: document.getElementById('results-container')
        };

        if (!this.elements.teamSearch) return;

        this.allTeams = null;
        this.filteredTeams = [];
        this.currentPage = 1;
        this.itemsPerPage = 50;
        this.searchDebounceTimer = null;
        this.minSearchLength = 0;

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.preloadTeams();
    }

    /**
     * Preload teams data in background using single-flight promise on dataService
     */
    preloadTeams() {
        if (window.dataService && typeof window.dataService.loadTeams === 'function') {
            window.dataService.loadTeams().then(teams => {
                this.allTeams = teams;
                const searchTerm = (this.elements.teamSearch.value || '').trim();
                if (searchTerm.length === 0) {
                    this.showAllTeams();
                }
            }).catch(() => {});
        }
    }

    setupEventListeners() {
        this.elements.teamSearch.addEventListener('input', (e) => {
            const searchTerm = e.target.value.trim();

            if (this.searchDebounceTimer) {
                clearTimeout(this.searchDebounceTimer);
            }

            this.searchDebounceTimer = setTimeout(() => {
                R3EUrlUtils.updateUrlParam('team', searchTerm || '');
                this.searchTeams(searchTerm);
            }, 200);
        });

        this.elements.teamSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                if (this.searchDebounceTimer) {
                    clearTimeout(this.searchDebounceTimer);
                }
                e.target.blur();
                const searchTerm = this.elements.teamSearch.value.trim();
                R3EUrlUtils.updateUrlParam('team', searchTerm || '');
                this.searchTeams(searchTerm);
            }
        });

        // Make goToPage available for pagination
        window.goToPage = (page) => this.goToPage(page);
    }

    showAllTeams() {
        this.searchTeams('');
    }

    async searchTeams(searchTerm) {
        if (!this.allTeams) {
            await TemplateHelper.showLoading(this.elements.resultsContainer, 'Loading teams...');
            try {
                this.allTeams = await window.dataService.loadTeams();
            } catch (err) {
                this.elements.resultsContainer.innerHTML = '<div class="error"><strong>Error:</strong> Failed to load teams data.</div>';
                return;
            }
        }

        const teams = this.allTeams;
        const teamNames = Object.keys(teams);

        // Filter
        let filtered;
        if (!searchTerm) {
            filtered = teamNames;
        } else {
            const lowerSearch = searchTerm.toLowerCase();
            filtered = teamNames.filter(name => name.toLowerCase().includes(lowerSearch));
        }

        // Sort by member count descending, then alphabetically
        filtered.sort((a, b) => {
            const aDrivers = teams[a].drivers || teams[a];
            const bDrivers = teams[b].drivers || teams[b];
            const diff = bDrivers.length - aDrivers.length;
            return diff !== 0 ? diff : a.localeCompare(b);
        });

        // Map to display objects
        this.filteredTeams = filtered.map(name => ({
            name,
            members: teams[name].drivers || teams[name],
            country: teams[name].country || null
        }));

        this.currentPage = 1;
        this.displayResults();
    }

    displayResults() {
        const data = this.filteredTeams;

        if (data.length === 0) {
            TemplateHelper.showNoResults(this.elements.resultsContainer);
            return;
        }

        // Paginate
        const totalTeams = data.length;
        const totalPages = Math.ceil(totalTeams / this.itemsPerPage);
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = Math.min(startIndex + this.itemsPerPage, totalTeams);
        const pageTeams = data.slice(startIndex, endIndex);

        // Render table
        let html = '<table class="results-table teams-table">';
        html += '<thead><tr>';
        html += '<th>Team</th>';
        html += '<th class="team-members-cell">Members</th>';
        html += '</tr></thead>';
        html += '<tbody>';

        for (const team of pageTeams) {
            const escapedName = R3EUtils.escapeHtml(team.name);
            const flagHtml = team.country && window.FlagHelper
                ? (window.FlagHelper.countryToFlag(team.country) || '')
                : '';
            const flagPrefix = flagHtml ? `<span class="country-flag">${flagHtml}</span>` : '';
            html += `<tr class="team-row" data-team="${escapedName}">`;
            html += `<td class="team-name-cell">${flagPrefix}<strong>${escapedName}</strong></td>`;
            html += `<td class="team-members-cell">${team.members.length}</td>`;
            html += '</tr>';
        }

        html += '</tbody></table>';

        // Pagination
        let paginationHTML = '';
        if (totalPages > 1) {
            const infoText = `Showing teams ${startIndex + 1}\u2013${endIndex} of ${totalTeams}`;
            paginationHTML = window.generatePaginationHTML({
                startIndex,
                endIndex,
                total: totalTeams,
                currentPage: this.currentPage,
                totalPages,
                onPageChange: 'goToPage',
                infoText
            });
        }

        this.elements.resultsContainer.innerHTML = html + paginationHTML;

        // Add click handlers — open team profile in a new tab
        this.elements.resultsContainer.querySelectorAll('.team-row').forEach(row => {
            row.addEventListener('click', () => {
                const teamName = row.getAttribute('data-team');
                const url = `team-profile.html?team=${encodeURIComponent(teamName)}`;
                window.open(url, '_blank');
            });
        });
    }

    goToPage(page) {
        this.currentPage = page;
        this.displayResults();
        this.elements.resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Expose class for testing
window.TeamsPage = TeamsPage;

// Auto-initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    window.teamsPage = new TeamsPage();
});
