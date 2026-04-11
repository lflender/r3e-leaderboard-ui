/**
 * Detail difficulty badge filter module.
 */

(function () {
    const DIFFICULTIES = ['Get Real', 'Amateur', 'Novice'];

    function normalizeDifficultyName(value) {
        const key = String(value || '').trim().toLowerCase();
        if (key === 'get real') return 'Get Real';
        if (key === 'amateur') return 'Amateur';
        if (key === 'novice') return 'Novice';
        return '';
    }

    function getDifficultyBadgeClass(diffName) {
        if (diffName === 'Get Real') return 'difficulty-get-real';
        if (diffName === 'Amateur') return 'difficulty-amateur';
        return 'difficulty-novice';
    }

    function createDetailDifficultyFilter(options = {}) {
        const escapeHtml = typeof options.escapeHtml === 'function'
            ? options.escapeHtml
            : (value) => String(value ?? '');

        let activeDifficulties = new Set(DIFFICULTIES);
        let onChange = null;

        function setActiveDifficulties(nextSet) {
            activeDifficulties = new Set(nextSet);
        }

        function getActiveDifficulties() {
            return new Set(activeDifficulties);
        }

        function getActiveDifficultyLabel() {
            const orderedActive = DIFFICULTIES.filter(name => activeDifficulties.has(name));
            if (orderedActive.length === DIFFICULTIES.length) {
                return 'All difficulties';
            }
            return orderedActive.join(', ');
        }

        function initializeFromParam(difficultyParam) {
            activeDifficulties = new Set(DIFFICULTIES);
            if (!difficultyParam || difficultyParam === 'All difficulties') {
                return;
            }

            const requested = String(difficultyParam)
                .split(',')
                .map(part => normalizeDifficultyName(part))
                .filter(Boolean);

            if (requested.length > 0) {
                activeDifficulties = new Set(requested);
            }
        }

        function render(container) {
            if (!container) return;

            const isSingleActive = activeDifficulties.size === 1;
            const badgesHtml = DIFFICULTIES.map(name => {
                const isActive = activeDifficulties.has(name);
                const isDisabled = isSingleActive && isActive;
                const badgeClass = getDifficultyBadgeClass(name);

                return `<button type="button" class="difficulty-pill detail-difficulty-pill ${badgeClass}" data-difficulty="${escapeHtml(name)}" aria-pressed="${isActive ? 'true' : 'false'}" ${isDisabled ? 'disabled' : ''}>${escapeHtml(name)}</button>`;
            }).join('');

            container.innerHTML = `<div class="detail-difficulty-badges">${badgesHtml}</div>`;
        }

        function toggleDifficulty(difficultyName, container) {
            const normalized = normalizeDifficultyName(difficultyName);
            if (!normalized) return;

            const isActive = activeDifficulties.has(normalized);
            if (isActive && activeDifficulties.size === 1) {
                return;
            }

            if (isActive) {
                activeDifficulties.delete(normalized);
            } else {
                activeDifficulties.add(normalized);
            }

            render(container);
            if (typeof onChange === 'function') {
                onChange(new Set(activeDifficulties));
            }
        }

        function bind(container, onDifficultyChange) {
            if (!container) return;
            onChange = typeof onDifficultyChange === 'function' ? onDifficultyChange : null;

            container.addEventListener('click', (event) => {
                const target = event.target;
                if (!(target instanceof HTMLElement)) return;
                const badge = target.closest('button[data-difficulty]');
                if (!badge || badge.hasAttribute('disabled')) return;
                toggleDifficulty(badge.getAttribute('data-difficulty') || '', container);
            });
        }

        function isDifficultyActive(value) {
            const normalized = normalizeDifficultyName(value);
            if (!normalized) return false;
            return activeDifficulties.has(normalized);
        }

        function isAllActive() {
            return activeDifficulties.size === DIFFICULTIES.length;
        }

        return {
            bind,
            getActiveDifficulties,
            getActiveDifficultyLabel,
            initializeFromParam,
            isAllActive,
            isDifficultyActive,
            render,
            setActiveDifficulties
        };
    }

    window.R3EDetailDifficultyFilter = {
        create: createDetailDifficultyFilter,
        normalizeDifficultyName
    };
})();