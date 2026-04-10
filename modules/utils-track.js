/**
 * Track label and class-logo utility helpers shared across pages.
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

let cachedCarsDataRef = null;
let cachedClassLogoByName = new Map();
let cachedClassLogoById = new Map();

function rebuildCarClassLogoMaps() {
    const carsData = Array.isArray(window.CARS_DATA) ? window.CARS_DATA : [];
    cachedClassLogoByName = new Map();
    cachedClassLogoById = new Map();

    for (const classEntry of carsData) {
        const className = String(classEntry.class || classEntry.car_class || '').trim().toLowerCase();
        const logoUrl = String(classEntry.logo || '').trim();
        if (!className || !logoUrl || cachedClassLogoByName.has(className)) {
            continue;
        }
        cachedClassLogoByName.set(className, logoUrl);
    }

    if (window.CAR_CLASSES_DATA && typeof window.CAR_CLASSES_DATA === 'object') {
        for (const [classId, className] of Object.entries(window.CAR_CLASSES_DATA)) {
            const normalizedClassName = String(className || '').trim().toLowerCase();
            const logoUrl = cachedClassLogoByName.get(normalizedClassName);
            if (logoUrl) {
                cachedClassLogoById.set(String(classId), logoUrl);
            }
        }
    }

    cachedCarsDataRef = carsData;
}

function ensureCarClassLogoMaps() {
    const carsData = Array.isArray(window.CARS_DATA) ? window.CARS_DATA : [];
    if (carsData !== cachedCarsDataRef) {
        rebuildCarClassLogoMaps();
    }
}

function resolveCarClassLogoByName(className) {
    if (!className) return '';
    ensureCarClassLogoMaps();
    return cachedClassLogoByName.get(String(className).trim().toLowerCase()) || '';
}

function resolveCarClassLogoById(classId) {
    if (!classId) return '';
    ensureCarClassLogoMaps();
    return cachedClassLogoById.get(String(classId)) || '';
}

function resolveCarClassLogo(className, classId) {
    const logoFromName = resolveCarClassLogoByName(className);
    if (logoFromName) {
        return logoFromName;
    }
    return resolveCarClassLogoById(classId);
}

function resolveDailyRaceClassLogos(race, resolveClassNameById, raceClassName) {
    if (!race) return [];

    const resolveName = typeof resolveClassNameById === 'function'
        ? resolveClassNameById
        : (classId) => String(classId || '');

    const categoryClassIds = Array.isArray(race.category_class_ids) ? race.category_class_ids : [];
    if (categoryClassIds.length > 0) {
        const logoItems = [];
        const seenIds = new Set();

        for (const rawId of categoryClassIds) {
            const classId = String(rawId || '').trim();
            if (!classId || seenIds.has(classId)) {
                continue;
            }
            seenIds.add(classId);

            const logoUrl = resolveCarClassLogoById(classId);
            if (!logoUrl) {
                continue;
            }

            logoItems.push({
                classId,
                className: resolveName(classId),
                logoUrl
            });
        }

        if (logoItems.length > 0) {
            return logoItems;
        }
    }

    const classId = String(race.car_class_id || '').trim();
    const className = String(raceClassName || race.car_class || '').trim();
    const logoUrl = resolveCarClassLogo(className, classId);

    if (!logoUrl) {
        return [];
    }

    return [{ classId, className, logoUrl }];
}

function getDailyRaceClassLogosHtml(race, resolveClassNameById, raceClassName) {
    const logos = resolveDailyRaceClassLogos(race, resolveClassNameById, raceClassName);
    if (logos.length === 0) {
        return '';
    }

    const escape = window.R3EUtils && typeof window.R3EUtils.escapeHtml === 'function'
        ? window.R3EUtils.escapeHtml
        : (value) => String(value ?? '');

    let logosHtml = `<div class="daily-race-class-logos daily-race-class-logos--count-${Math.min(logos.length, 6)}">`;
    for (const logo of logos) {
        const altText = logo.className ? `${logo.className} class logo` : 'Car class logo';
        logosHtml += `<img class="daily-race-class-logo" src="${escape(logo.logoUrl)}" alt="${escape(altText)}" loading="lazy" decoding="async">`;
    }
    logosHtml += '</div>';

    return logosHtml;
}

window.R3ETrackUtils = {
    getTrackLabelMap,
    resolveTrackLabel,
    resolveTrackLabelForItem,
    resolveCarClassLogoByName,
    resolveCarClassLogoById,
    resolveCarClassLogo,
    resolveDailyRaceClassLogos,
    getDailyRaceClassLogosHtml
};