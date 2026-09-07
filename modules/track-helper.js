/**
 * Track label utility helpers shared across pages.
 */

let cachedTrackDataRef = null;
let cachedTrackLabelMap = new Map();

function splitTrackAndLayout(fullTrack) {
    const safeTrack = String(fullTrack || '').trim();
    if (!safeTrack) {
        return { trackName: '', layoutName: '' };
    }

    const match = safeTrack.match(/^(.+)(?:\s+[-–—]\s+)(.+)$/);
    if (match) {
        return {
            trackName: match[1].trim(),
            layoutName: match[2].trim()
        };
    }

    return { trackName: safeTrack, layoutName: '' };
}

function normalizeTrackBaseLabel(trackName) {
    if (/^Adria International Raceway (?:2003|2021)$/i.test(trackName)) {
        return 'Adria International Raceway';
    }

    return trackName;
}

function getTrackBaseLabel(fullTrack) {
    const safeTrack = String(fullTrack || '').trim();
    if (!safeTrack) {
        return '';
    }

    const { trackName } = splitTrackAndLayout(safeTrack);
    return normalizeTrackBaseLabel(trackName || safeTrack);
}

function getTrackIdsForFilterValue(filterValue, layoutId = '') {
    const rawValue = String(filterValue ?? '').trim();
    if (!rawValue) {
        return [];
    }

    const tracks = Array.isArray(window.TRACKS_DATA) ? window.TRACKS_DATA : [];
    const selectedTrack = tracks.find(track => String(track?.id) === rawValue);
    if (!selectedTrack) {
        return [rawValue];
    }

    const selectedBaseLabel = getTrackBaseLabel(selectedTrack.label || selectedTrack.name || '');
    if (!selectedBaseLabel) {
        return [String(selectedTrack.id)];
    }

    const ids = tracks
        .filter(track => getTrackBaseLabel(track?.label || track?.name || '') === selectedBaseLabel)
        .map(track => String(track.id));

    if (layoutId && ids.includes(String(layoutId))) {
        return [String(layoutId)];
    }

    return ids.length > 0 ? ids : [String(selectedTrack.id)];
}

function getTrackLayoutOptionsForFilterValue(filterValue) {
    const rawValue = String(filterValue ?? '').trim();
    if (!rawValue) {
        return [];
    }

    const tracks = Array.isArray(window.TRACKS_DATA) ? window.TRACKS_DATA : [];
    const selectedTrack = tracks.find(track => String(track?.id) === rawValue);
    if (!selectedTrack) {
        return [];
    }

    const selectedBaseLabel = getTrackBaseLabel(selectedTrack.label || selectedTrack.name || '');
    return tracks
        .filter(track => getTrackBaseLabel(track?.label || track?.name || '') === selectedBaseLabel)
        .map(track => {
            const fullLabel = String(track?.label || track?.name || track?.id || '');
            const { layoutName } = splitTrackAndLayout(fullLabel);
            return {
                value: String(track.id),
                label: layoutName || fullLabel
            };
        });
}

function getTrackLabelMap() {
    const tracks = Array.isArray(window.TRACKS_DATA) ? window.TRACKS_DATA : [];
    if (tracks !== cachedTrackDataRef) {
        cachedTrackDataRef = tracks;
        cachedTrackLabelMap = new Map();
        tracks.forEach(track => {
            if (!track || track.id === undefined || track.id === null) return;
            cachedTrackLabelMap.set(String(track.id), String(track.label || track.name || track.id));
        });
    }
    return cachedTrackLabelMap;
}

function resolveTrackLabel(trackId, fallback = '') {
    if (trackId === undefined || trackId === null || trackId === '') {
        return fallback ? String(fallback) : '';
    }

    const label = getTrackLabelMap().get(String(trackId));
    if (label) {
        return label;
    }

    return fallback ? String(fallback) : String(trackId);
}

function resolveTrackLabelForItem(item, fallback = '') {
    const trackId = item?.track_id || item?.TrackID || item?.trackId || item?.['Track ID'] || '';
    const fallbackLabel = fallback || item?.track_name || item?.TrackName || item?.track || item?.Track || '';
    return resolveTrackLabel(trackId, fallbackLabel);
}

window.R3ETrackUtils = {
    splitTrackAndLayout,
    getTrackBaseLabel,
    getTrackIdsForFilterValue,
    getTrackLayoutOptionsForFilterValue,
    getTrackLabelMap,
    resolveTrackLabel,
    resolveTrackLabelForItem
};