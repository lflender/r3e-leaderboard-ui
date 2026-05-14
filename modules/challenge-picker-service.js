/**
 * Challenge Picker Service
 *
 * Pure data-picking logic with no DOM dependency.
 * Reads from window.CARS_DATA, window.CAR_CLASSES_DATA, window.TRACKS_DATA,
 * and delegates logo resolution to R3ETrackUtils / R3ECarUtils / R3ETrackImages.
 *
 * randomFn injectable for testability (defaults to Math.random).
 */
(function () {
    'use strict';

    /* ── constants ────────────────────────────────────────── */

    const HISTORY_SIZE = 5;
    const EXCLUDED_CLASSES = ['Safety Car', 'Shopping Cart'];

    /* ── helpers ──────────────────────────────────────────── */

    function randomIndex(length, randomFn) {
        return Math.floor(randomFn() * length);
    }

    /**
     * Group flat TRACKS_DATA entries into a Map<trackBase, layout[]>
     * where trackBase is the part before " - " (or the full label if no separator).
     */
    function groupTracksByBase(tracksData) {
        const grouped = new Map();
        for (const entry of tracksData) {
            const label = entry.label || '';
            const sepIdx = label.indexOf(' - ');
            const base = sepIdx !== -1 ? label.substring(0, sepIdx).trim() : label.trim();
            if (!base) continue;
            if (!grouped.has(base)) {
                grouped.set(base, []);
            }
            grouped.get(base).push(entry);
        }
        return grouped;
    }

    /* ── history ─────────────────────────────────────────── */

    /**
     * Ring-buffer history that tracks the last N picked keys per category.
     * Keys are simple strings derived from pick results.
     */
    function createHistory(size) {
        const buffers = {};
        return {
            has(category, key) {
                return Array.isArray(buffers[category]) && buffers[category].includes(key);
            },
            add(category, key) {
                if (!buffers[category]) buffers[category] = [];
                buffers[category].push(key);
                if (buffers[category].length > size) {
                    buffers[category].shift();
                }
            },
            clear(category) {
                if (category) {
                    delete buffers[category];
                } else {
                    for (const k of Object.keys(buffers)) delete buffers[k];
                }
            },
            keys(category) {
                return buffers[category] ? [...buffers[category]] : [];
            }
        };
    }

    const history = createHistory(HISTORY_SIZE);

    /**
     * Filter an array, removing items whose key is in history.
     * When all items would be excluded but there are at least 2,
     * exclude only the most recent entry to avoid back-to-back repeats.
     * Falls back to the original array only for single-item lists.
     */
    function excludeRecent(items, category, keyFn) {
        const filtered = items.filter(item => !history.has(category, keyFn(item)));
        if (filtered.length > 0) return filtered;
        if (items.length <= 1) return items;
        // All items in history — at least avoid the most recent pick
        const recent = history.keys(category);
        const lastKey = recent.length > 0 ? recent[recent.length - 1] : null;
        if (lastKey === null) return items;
        const noRepeat = items.filter(item => keyFn(item) !== lastKey);
        return noRepeat.length > 0 ? noRepeat : items;
    }

    /* ── car filtering ───────────────────────────────────── */

    /**
     * Year era definitions for the era filter.
     * Each era has a predicate that tests a car's year string.
     */
    const YEAR_ERAS = {
        modern:  (y) => y >= 2016,
        recent:  (y) => y >= 2000 && y <= 2015,
        oldies:  (y) => y >= 1969 && y < 2000
    };

    function parseYear(yearStr) {
        const n = parseInt(String(yearStr || ''), 10);
        return Number.isFinite(n) ? n : NaN;
    }

    function matchesWheel(car, wheelFilter) {
        if (!wheelFilter) return true;
        const w = (car.wheel_cat || '').toLowerCase().trim();
        if (wheelFilter === 'round_and_roundflat') {
            return w === 'round' || w === 'round flat' || w === 'round (flat)';
        }
        return w === wheelFilter;
    }

    function matchesTrans(car, transFilter) {
        if (!transFilter) return true;
        const t = (car.transmission_cat || '').toLowerCase().trim();
        const effective = t || 'paddles';
        return effective === transFilter;
    }

    function matchesEra(car, eraFilter) {
        if (!eraFilter) return true;
        const predicate = YEAR_ERAS[eraFilter];
        if (!predicate) return true;
        const year = parseYear(car.year);
        if (isNaN(year)) return eraFilter === 'modern';
        return predicate(year);
    }

    function matchesRating(car, ratingFilter) {
        if (!ratingFilter) return true;
        if (typeof CarRatings === 'undefined') return false;
        const carId = CarRatings.buildCarId(car);
        const carRating = CarRatings.get(carId);
        if (ratingFilter === '0') return carRating === 0;
        if (ratingFilter === '6') return carRating === 6;
        return carRating >= parseInt(ratingFilter);
    }

    /**
     * Filter CARS_DATA by the given filters, returning a new array
     * with only matching classes/cars.
     * Each class entry keeps only cars that match all filters.
     * Classes with no matching cars are removed.
     *
     * @param {Array} carsData - window.CARS_DATA
     * @param {{ era?: string, wheel?: string, trans?: string, rating?: string }} filters
     * @returns {Array} filtered copy of carsData
     */
    function filterCarsData(carsData, filters) {
        if (!Array.isArray(carsData)) return [];

        // Always exclude non-racing classes
        const base = carsData.filter(entry => !EXCLUDED_CLASSES.includes(entry.class || ''));

        if (!filters || (!filters.era && !filters.wheel && !filters.trans && !filters.rating)) return base;

        const result = [];
        for (const classEntry of base) {
            const cars = Array.isArray(classEntry.cars) ? classEntry.cars : [];
            const filtered = cars.filter(car =>
                matchesWheel(car, filters.wheel) &&
                matchesTrans(car, filters.trans) &&
                matchesEra(car, filters.era) &&
                matchesRating(car, filters.rating)
            );
            if (filtered.length > 0) {
                result.push({ ...classEntry, cars: filtered });
            }
        }
        return result;
    }

    /* ── car picking ─────────────────────────────────────── */

    /**
     * Build the history key function for class-level exclusion.
     * When groupByCategory is true, classes sharing the same superclass
     * map to the same key, so picking one excludes the whole category.
     */
    function classKeyFn(groupByCat) {
        return groupByCat
            ? (e => e.superclass || e.class || '')
            : (e => e.class || '');
    }

    /**
     * Pick a random car class, excluding recently picked classes.
     * @param {object} [options] - { groupByCategory: boolean }
     * Returns { className, classLogo } or null when no data.
     */
    function pickClass(carsData, resolveClassLogo, randomFn, options) {
        if (!Array.isArray(carsData) || carsData.length === 0) return null;
        const groupByCat = options && options.groupByCategory;
        const candidates = excludeRecent(carsData, 'class', classKeyFn(groupByCat));
        const entry = candidates[randomIndex(candidates.length, randomFn)];
        const className = entry.class || '';
        const historyKey = groupByCat ? (entry.superclass || className) : className;
        history.add('class', historyKey);
        return {
            className,
            classLogo: resolveClassLogo(className)
        };
    }

    /**
     * Pick a random class, then a random car within that class.
     * Excludes recently picked cars. When groupByCategory is true,
     * also excludes all classes from recently picked categories.
     * @param {object} [options] - { groupByCategory: boolean }
     * Returns { className, classLogo, carName, brandLogo, thumbnail } or null.
     */
    function pickCar(carsData, resolveClassLogo, resolveBrandLogo, randomFn, options) {
        if (!Array.isArray(carsData) || carsData.length === 0) return null;
        const groupByCat = options && options.groupByCategory;

        // When groupByCategory, first narrow classes by category history
        const availableData = groupByCat
            ? excludeRecent(carsData, 'class', classKeyFn(true))
            : carsData;

        // Flatten to pick from all cars, excluding recent
        const allCars = [];
        for (const classEntry of availableData) {
            const className = classEntry.class || '';
            const superclass = classEntry.superclass || '';
            const logo = classEntry.logo || '';
            for (const car of (Array.isArray(classEntry.cars) ? classEntry.cars : [])) {
                allCars.push({ className, superclass, logo, car });
            }
        }
        if (allCars.length === 0) {
            // No cars at all — fall back to class pick
            const fallbackData = groupByCat
                ? excludeRecent(carsData, 'car', classKeyFn(true))
                : carsData;
            const candidates = excludeRecent(fallbackData, 'car', e => e.class || '');
            const classEntry = candidates[randomIndex(candidates.length, randomFn)];
            const className = classEntry.class || '';
            history.add('car', className);
            if (groupByCat) {
                history.add('class', classEntry.superclass || className);
            }
            return {
                className,
                classLogo: resolveClassLogo(className),
                superclass: classEntry.superclass || '',
                carName: null,
                brandLogo: '',
                thumbnail: ''
            };
        }
        const candidates = excludeRecent(allCars, 'car', c => c.car.car || '');
        const pick = candidates[randomIndex(candidates.length, randomFn)];
        const carName = pick.car.car || '';
        history.add('car', carName);
        if (groupByCat) {
            history.add('class', pick.superclass || pick.className);
        }
        return {
            className: pick.className,
            classLogo: resolveClassLogo(pick.className),
            superclass: pick.superclass || '',
            carName,
            brandLogo: resolveBrandLogo(carName),
            thumbnail: pick.car.thumbnail || '',
            carData: pick.car
        };
    }

    /* ── track picking ───────────────────────────────────── */

    /**
     * Pick a random track (base track, not layout).
     * Each base track has equal probability regardless of layout count.
     * Excludes recently picked tracks.
     * Returns { trackBase, trackLogo } or null.
     */
    function pickTrack(tracksData, resolveTrackLogo, randomFn) {
        if (!Array.isArray(tracksData) || tracksData.length === 0) return null;
        const grouped = groupTracksByBase(tracksData);
        const allBases = Array.from(grouped.keys());
        if (allBases.length === 0) return null;
        const bases = excludeRecent(allBases, 'track', b => b);
        const base = bases[randomIndex(bases.length, randomFn)];
        const layouts = grouped.get(base);
        const logoLabel = layouts[0]?.label || base;
        history.add('track', base);
        return {
            trackBase: base,
            trackLogo: resolveTrackLogo(logoLabel)
        };
    }

    /**
     * Pick a random track, then a random layout within it.
     * Each base track has equal probability (then uniform within layouts).
     * Excludes recently picked layouts (by full label).
     * Returns { trackBase, trackLogo, layoutLabel, layoutId } or null.
     */
    function pickLayout(tracksData, resolveTrackLogo, randomFn) {
        if (!Array.isArray(tracksData) || tracksData.length === 0) return null;
        const grouped = groupTracksByBase(tracksData);
        const allBases = Array.from(grouped.keys());
        if (allBases.length === 0) return null;
        const bases = excludeRecent(allBases, 'layout', b => b);
        const base = bases[randomIndex(bases.length, randomFn)];
        const layouts = grouped.get(base);
        const layout = layouts[randomIndex(layouts.length, randomFn)];
        const label = layout.label || '';
        const sepIdx = label.indexOf(' - ');
        const layoutSuffix = sepIdx !== -1 ? label.substring(sepIdx + 3).trim() : '';
        history.add('layout', base);
        return {
            trackBase: base,
            trackLogo: resolveTrackLogo(label),
            layoutLabel: layoutSuffix || label,
            layoutId: layout.id
        };
    }

    /**
     * Pick a random car within a specific class.
     * Used when refining a class-only result to a specific car.
     * Returns { className, classLogo, carName, brandLogo, thumbnail, carData } or null.
     */
    function pickCarInClass(carsData, className, resolveClassLogo, resolveBrandLogo, randomFn) {
        if (!Array.isArray(carsData) || !className) return null;
        const classEntry = carsData.find(e => (e.class || '') === className);
        if (!classEntry) return null;
        const cars = Array.isArray(classEntry.cars) ? classEntry.cars : [];
        if (cars.length === 0) return null;
        const car = cars[randomIndex(cars.length, randomFn)];
        const carName = car.car || '';
        return {
            className,
            classLogo: resolveClassLogo(className),
            carName,
            brandLogo: resolveBrandLogo(carName),
            thumbnail: car.thumbnail || '',
            carData: car
        };
    }

    /**
     * Pick a random layout within a specific base track.
     * Used when refining a track-only result to a specific layout.
     * Returns { trackBase, trackLogo, layoutLabel, layoutId } or null.
     */
    function pickLayoutInTrack(tracksData, trackBase, resolveTrackLogo, randomFn) {
        if (!Array.isArray(tracksData) || !trackBase) return null;
        const grouped = groupTracksByBase(tracksData);
        const layouts = grouped.get(trackBase);
        if (!layouts || layouts.length === 0) return null;
        const layout = layouts[randomIndex(layouts.length, randomFn)];
        const label = layout.label || '';
        const sepIdx = label.indexOf(' - ');
        const layoutSuffix = sepIdx !== -1 ? label.substring(sepIdx + 3).trim() : '';
        return {
            trackBase,
            trackLogo: resolveTrackLogo(label),
            layoutLabel: layoutSuffix || label,
            layoutId: layout.id
        };
    }

    /* ── public API ──────────────────────────────────────── */

    window.ChallengePickerService = {
        pickClass,
        pickCar,
        pickCarInClass,
        pickTrack,
        pickLayout,
        pickLayoutInTrack,
        groupTracksByBase,
        filterCarsData,
        YEAR_ERAS,
        history
    };
})();
