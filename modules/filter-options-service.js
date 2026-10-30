/**
 * Filter Options Service
 * Builds dropdown filter option lists from static data (cars, tracks).
 * Pure data derivation — no network I/O, no DataService state dependency.
 */

(function () {
    'use strict';

    let cachedWheelMapCarsData = null;
    let cachedWheelMap = null;

    function getEntryClassName(entry) {
        const rawName = entry?.car_class || entry?.CarClass || entry?.['Car Class'] ||
            entry?.class_name || entry?.ClassName || entry?.class || entry?.Class;
        const name = typeof rawName === 'object'
            ? rawName.class?.Name || rawName.class?.name || rawName.Name || rawName.name || ''
            : rawName;
        if (name && !/^\d+$/.test(String(name).trim())) return String(name).trim();

        const classId = entry?.class_id ?? entry?.ClassID ?? entry?.classId ?? entry?.['Class ID'] ?? name;
        return classId ? String(window.getCarClassName?.(classId) || classId) : '';
    }

    function getEntryClassId(entry) {
        const classId = entry?.class_id ?? entry?.ClassID ?? entry?.classId ?? entry?.['Class ID'];
        if (classId !== undefined && classId !== null && String(classId).trim()) return String(classId).trim();

        const className = getEntryClassName(entry);
        return String(window.getCarClassId?.(className) || (/^\d+$/.test(className) ? className : ''));
    }

    function getWheelMap() {
        const carsData = Array.isArray(window.CARS_DATA) ? window.CARS_DATA : [];
        if (cachedWheelMapCarsData === carsData && cachedWheelMap) return cachedWheelMap;

        const wheelMap = new Map();
        carsData.forEach(classEntry => {
            (Array.isArray(classEntry.cars) ? classEntry.cars : []).forEach(car => {
                const className = car.car_class || classEntry.class || classEntry.car_class || classEntry.CarClass || '';
                const classId = window.getCarClassId?.(className);
                const wheel = String(car.wheel_cat || '').trim().toLowerCase();
                if (!wheel) return;

                const keys = [classId, String(className).trim().toLowerCase()].filter(Boolean);
                keys.forEach(key => {
                    if (!wheelMap.has(String(key))) wheelMap.set(String(key), wheel);
                });
            });
        });

        cachedWheelMapCarsData = carsData;
        cachedWheelMap = wheelMap;
        return wheelMap;
    }

    /**
     * Populates class filter from cars data, filtered to only classes with leaderboard data.
     * @returns {Array<{value: string, label: string, logoUrl: string}>} Class options
     */
    function getClassOptionsFromCarsData() {
        if (!window.CARS_DATA || !Array.isArray(window.CARS_DATA)) {
            return [];
        }

        const seen = new Set();
        const options = [];

        window.CARS_DATA.forEach(entry => {
            const cls = entry.class || entry.car_class || entry.CarClass || '';
            if (!cls || seen.has(cls)) return;

            // Only include classes that exist in CAR_CLASSES_DATA (have leaderboard entries)
            if (window.getCarClassId && !window.getCarClassId(cls)) {
                return; // Skip classes without leaderboard data (e.g., Safety Car)
            }

            seen.add(cls);
            const classId = window.getCarClassId ? window.getCarClassId(cls) : null;
            const logoUrl = window.R3EUtils?.resolveCarClassLogo?.(cls, classId) || '';
            options.push({ value: cls, label: cls, logoUrl });
        });

        return options.sort((a, b) => a.label.localeCompare(b.label));
    }

    function matchesClassFilter(entry, filterValue) {
        const value = String(filterValue || '').trim();
        if (!value) return true;

        const classId = getEntryClassId(entry);
        const className = getEntryClassName(entry).toLowerCase();
        if (value.startsWith('superclass:')) {
            const superclass = value.slice('superclass:'.length);
            return (Array.isArray(window.CARS_DATA) ? window.CARS_DATA : []).some(classEntry => {
                if (classEntry.superclass !== superclass) return false;
                const name = classEntry.class || classEntry.car_class || classEntry.CarClass || '';
                const id = window.getCarClassId?.(name);
                return (id && String(id) === classId) || String(name).trim().toLowerCase() === className;
            });
        }

        const filterClassId = window.getCarClassId?.(value) || (/^\d+$/.test(value) ? value : '');
        if (classId && filterClassId) return classId === String(filterClassId);
        return className === value.toLowerCase();
    }

    function matchesWheelFilter(entry, wheelFilter) {
        if (!wheelFilter) return true;

        const className = getEntryClassName(entry);
        const classId = getEntryClassId(entry);
        const wheelMap = getWheelMap();
        const wheel = wheelMap.get(classId) || wheelMap.get(className.toLowerCase()) || '';
        if (wheelFilter === 'round_and_roundflat') {
            return wheel === 'round' || wheel === 'round flat' || wheel === 'round (flat)';
        }
        return wheel === wheelFilter;
    }

    /**
     * Get track options for dropdown filters, with logo URLs resolved from track-images data.
     * Single source of truth for all track filter dropdowns across the site.
     * @returns {Array<{value: string, label: string, logoUrl: string}>} Track options
     */
    function getTrackOptions() {
        const tracks = Array.isArray(window.TRACKS_DATA) ? window.TRACKS_DATA : [];
        const seen = new Set();
        const uniqueTracks = [];

        tracks.forEach(track => {
            const rawLabel = track?.label || track?.name || '';
            const baseLabel = window.R3ETrackUtils?.getTrackBaseLabel?.(rawLabel) || '';

            if (!baseLabel || seen.has(baseLabel.toLowerCase())) {
                return;
            }

            seen.add(baseLabel.toLowerCase());
            uniqueTracks.push({
                id: track?.id,
                label: baseLabel,
                fullLabel: rawLabel
            });
        });

        return [{ value: '', label: 'All tracks' }].concat(
            uniqueTracks.map(track => {
                const resultLabel = String(track.label || '');
                const logoUrl = (window.R3ETrackImages && typeof window.R3ETrackImages.resolveTrackLogoByLabel === 'function')
                    ? window.R3ETrackImages.resolveTrackLogoByLabel(track.fullLabel || resultLabel) || ''
                    : '';
                return { value: String(track.id), label: resultLabel, logoUrl };
            })
        );
    }

    /**
     * Get unique superclass options with classes that belong to each.
     * @returns {Array<{value: string, label: string, logos: string[], classes: string[]}>}
     */
    function getSuperclassOptions() {
        if (!window.CARS_DATA || !Array.isArray(window.CARS_DATA)) {
            return [];
        }

        const superclassMap = new Map();

        window.CARS_DATA.forEach(entry => {
            const superclass = entry.superclass;
            const cls = entry.class || entry.car_class || entry.CarClass || '';

            if (superclass && cls) {
                if (!superclassMap.has(superclass)) {
                    superclassMap.set(superclass, new Set());
                }
                superclassMap.get(superclass).add(cls);
            }
        });

        const options = [];
        superclassMap.forEach((classes, superclass) => {
            // Collect unique logo URLs for all classes in this superclass
            const seenUrls = new Set();
            const logos = [];
            classes.forEach(cls => {
                const logoUrl = window.R3EUtils?.resolveCarClassLogoByName?.(cls) || '';
                if (logoUrl && !seenUrls.has(logoUrl)) {
                    seenUrls.add(logoUrl);
                    logos.push(logoUrl);
                }
            });

            options.push({
                value: `superclass:${superclass}`,
                label: superclass,
                logos,
                classes: Array.from(classes)
            });
        });

        return options.sort((a, b) => a.label.localeCompare(b.label));
    }

    /**
     * Build category filter options for a specific set of class IDs.
     * Groups the IDs by superclass and builds dropdown entries with class logos.
     * @param {string[]} classIds - Array of class IDs (e.g. ["1703","12770","4680"])
     * @returns {Array<{value: string, label: string, logos: string[], classNames: Array<{classId: string, className: string}>}>}
     */
    function getCategoryOptionsForClassIds(classIds) {
        if (!Array.isArray(classIds) || classIds.length < 2) return [];

        // Group class IDs by superclass
        const categoryMap = new Map();
        classIds.forEach(classId => {
            const className = window.getCarClassName ? window.getCarClassName(classId) : classId;
            let superclass = null;

            if (window.CARS_DATA && Array.isArray(window.CARS_DATA)) {
                const carEntry = window.CARS_DATA.find(entry => {
                    const cls = entry.class || entry.car_class || entry.CarClass || '';
                    return String(cls).trim().toLowerCase() === String(className).trim().toLowerCase();
                });
                superclass = carEntry?.superclass || null;
            }

            if (!superclass) superclass = className;

            if (!categoryMap.has(superclass)) {
                categoryMap.set(superclass, []);
            }
            categoryMap.get(superclass).push({ classId, className });
        });

        // Only produce entries if there are 2+ distinct categories
        if (categoryMap.size < 2) return [];

        const options = [];

        categoryMap.forEach((classes, superclass) => {
            // Collect unique logo URLs
            const seenUrls = new Set();
            const logos = [];
            classes.forEach(({ className, classId }) => {
                const logoUrl = window.R3EUtils?.resolveCarClassLogo?.(className, classId) || '';
                if (logoUrl && !seenUrls.has(logoUrl)) {
                    seenUrls.add(logoUrl);
                    logos.push(logoUrl);
                }
            });

            options.push({
                value: `CATEGORY:${superclass}`,
                label: superclass,
                logos,
                classNames: classes
            });
        });

        return options;
    }

    window.FilterOptionsService = {
        getClassOptionsFromCarsData,
        matchesClassFilter,
        matchesWheelFilter,
        getTrackOptions,
        getSuperclassOptions,
        getCategoryOptionsForClassIds
    };
})();
