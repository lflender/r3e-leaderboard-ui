/**
 * Track label utility helpers shared across pages.
 */

let cachedTrackDataRef = null;
let cachedTrackLabelMap = new Map();

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
    getTrackLabelMap,
    resolveTrackLabel,
    resolveTrackLabelForItem
};