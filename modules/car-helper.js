/**
 * Car-specific utility helpers shared across pages.
 */

const CAR_BRANDS = [
    'Mercedes-Benz', 'Mercedes-AMG', 'Alfa Romeo', 'Lynk & Co', 'RUF',
    'Mercedes', 'AMG-Mercedes', 'BMW', 'Audi', 'Porsche', 'Volkswagen', 'Opel', 'NSU',
    'Ferrari', 'Lamborghini', 'Pagani', 'Maserati',
    'McLaren', 'Bentley', 'Lotus', 'Radical', 'Aston Martin', 'Jaguar',
    'Chevrolet', 'Ford', 'Cadillac', 'Saleen', 'Callaway',
    'Nissan', 'Honda', 'Mazda', 'Toyota', 'Lexus', 'Subaru',
    'Hyundai', 'Kia',
    'Renault', 'Peugeot', 'Citroën', 'Citroen', 'Volvo', 'SEAT', 'CUPRA', 'LADA', 'Lada',
    'KTM', 'Gumpert',
    'Koenigsegg', 'Praga', 'Tatuus', 'Aquila', 'Canhard', 'Cougar', 'Crosslé', 'Crossle',
    'DMD', 'Fabcar', 'Mistral', 'RaceRoom', 'Formula', 'Carlsson', 'Zakspeed',
    'Abt-Audi', 'S.C.', 'P4-5'
];

const CAR_SPECIAL_CASES = {
    'E36 V8 JUDD': { brand: 'Georg Plasa', model: 'BMW E36 V8' },
    '134 Judd V8': { brand: 'Georg Plasa', model: 'BMW 134 V8' },
    'Carlsson SLK 340 JUDD': { brand: 'Carlsson', model: 'Mercedes SLK 340' },
    'BMW Alpina B6 GT3': { brand: 'BMW Alpina', model: 'B6 GT3' }
};

const MODEL_LOGO_OVERRIDES = [
    { pattern: 'corvette', logoKey: 'corvette' }
];

const BRAND_LOGO_OVERRIDES = {
    'alfa romeo': 'alfaromeo',
    'abt-audi': 'audi',
    'bmw alpina': 'alpina',
    'callaway': 'chevrolet',
    'citroen': 'citroen',
    'crossle': 'crossle',
    'georg plasa': 'georg-plasa',
    'lynk & co': 'lynk-co',
    'mclaren-mercedes': 'mclaren',
    'amg-mercedes': 'mercedes',
    'mercedes-amg': 'mercedes',
    'mercedes-benz': 'mercedes',
    'p4-5': 'p45'
};

const AVAILABLE_BRAND_LOGO_KEYS = new Set([
    'alfaromeo', 'alpina', 'alpine', 'aquila', 'audi', 'bentley', 'bmw', 'cadillac',
    'carlsson', 'chevrolet', 'citroen', 'corvette', 'crossle', 'cupra', 'fabcar', 'ferrari', 'ford',
    'georg-plasa', 'gumpert', 'honda', 'hyundai', 'judd', 'koenigsegg', 'ktm', 'lada', 'lamborghini', 'lotus',
    'lrt', 'lynk-co', 'mazda', 'mclaren', 'mercedes', 'nissan', 'nsu', 'opel', 'p45', 'pagani',
    'peugeot', 'porsche', 'praga', 'raceroom', 'radical', 'renault', 'ruf', 'saleen',
    'seat', 'tatuus', 'volkswagen', 'volvo', 'zakspeed'
]);

function normalizeBrandForLogoLookup(brand) {
    return String(brand || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
}

function resolveBrandLogoPath(carNameOrBrand) {
    const source = String(carNameOrBrand || '').trim();
    if (!source) return 'images/brands/logo-raceroom.png';

    const sourceLower = source.toLowerCase();
    for (const { pattern, logoKey } of MODEL_LOGO_OVERRIDES) {
        if (sourceLower.includes(pattern)) return `images/brands/logo-${logoKey}.png`;
    }

    const split = splitCarName(source);
    const baseBrand = split.brand || source;
    const normalizedBrand = normalizeBrandForLogoLookup(baseBrand);
    if (!normalizedBrand) return 'images/brands/logo-raceroom.png';

    const requestedFileKey = BRAND_LOGO_OVERRIDES[normalizedBrand]
        || normalizedBrand.replace(/[^a-z0-9&]+/g, '');

    const fileKey = AVAILABLE_BRAND_LOGO_KEYS.has(requestedFileKey)
        ? requestedFileKey
        : 'raceroom';

    return `images/brands/logo-${fileKey}.png`;
}

function splitCarName(carName) {
    if (!carName) return { brand: '', model: '' };

    const name = String(carName).trim();
    if (CAR_SPECIAL_CASES[name]) {
        return CAR_SPECIAL_CASES[name];
    }

    // Normalize known DTM-prefixed Mercedes naming so brand/logo resolve correctly.
    const dtmMercedesAmgMatch = name.match(/^DTM\s+Mercedes\s+AMG\s+(.+)$/i);
    if (dtmMercedesAmgMatch) {
        return {
            brand: 'Mercedes-AMG',
            model: String(dtmMercedesAmgMatch[1] || '').trim()
        };
    }

    for (const brand of CAR_BRANDS) {
        if (name.startsWith(brand + ' ') || name === brand) {
            const model = name.slice(brand.length).trim();
            return { brand, model };
        }
    }

    const spaceIndex = name.indexOf(' ');
    if (spaceIndex > 0) {
        return {
            brand: name.slice(0, spaceIndex),
            model: name.slice(spaceIndex + 1)
        };
    }

    return { brand: name, model: '' };
}

function detectYearSuffix(carName) {
    const yearMatch = String(carName || '').match(/^(.+?)\s+(\d{4})$/);
    if (yearMatch) {
        return {
            baseName: yearMatch[1].trim(),
            year: yearMatch[2]
        };
    }
    return null;
}

function detectDTMSuffix(carName) {
    const normalized = String(carName || '');
    if (normalized.endsWith(' DTM')) {
        return {
            baseName: normalized.substring(0, normalized.length - 4)
        };
    }
    return null;
}

function findDTMCombinations(cars) {
    const combinations = [];
    const processed = new Set();

    cars.forEach(car => {
        const dtmInfo = detectDTMSuffix(car);
        if (dtmInfo && cars.includes(dtmInfo.baseName) && !processed.has(dtmInfo.baseName)) {
            combinations.push({
                value: `COMBINED_DTM:${dtmInfo.baseName}`,
                label: `Combined: ${dtmInfo.baseName} + DTM`
            });
            processed.add(dtmInfo.baseName);
        }
    });

    return combinations;
}

function findYearCombinations(cars) {
    const combinations = [];
    const processed = new Set();
    const baseNameMap = new Map();

    cars.forEach(car => {
        const yearInfo = detectYearSuffix(car);
        if (yearInfo) {
            if (!baseNameMap.has(yearInfo.baseName)) {
                baseNameMap.set(yearInfo.baseName, []);
            }
            baseNameMap.get(yearInfo.baseName).push(car);
        }
    });

    baseNameMap.forEach((variants, baseName) => {
        const hasBaseModel = cars.includes(baseName);
        if ((variants.length >= 2 || (variants.length >= 1 && hasBaseModel)) && !processed.has(baseName)) {
            combinations.push({
                value: `COMBINED_YEAR:${baseName}`,
                label: `Combined: ${baseName}`
            });
            processed.add(baseName);
        }
    });

    return combinations;
}

function findCarCombinations(cars) {
    return [...findDTMCombinations(cars), ...findYearCombinations(cars)];
}

function findCombinationForCar(car, combinations) {
    const dtmInfo = detectDTMSuffix(car);
    if (dtmInfo) {
        const combo = combinations.find(c => c.value === `COMBINED_DTM:${dtmInfo.baseName}`);
        if (combo) return combo;
    }

    const yearInfo = detectYearSuffix(car);
    if (yearInfo) {
        const combo = combinations.find(c => c.value === `COMBINED_YEAR:${yearInfo.baseName}`);
        if (combo) return combo;
    }

    const yearCombo = combinations.find(c => c.value === `COMBINED_YEAR:${car}`);
    if (yearCombo) return yearCombo;

    return null;
}

function isLastInCarGroup(car, allCars, currentIndex) {
    const yearInfo = detectYearSuffix(car);
    const baseName = yearInfo ? yearInfo.baseName : car;

    for (let i = currentIndex + 1; i < allCars.length; i++) {
        const nextYearInfo = detectYearSuffix(allCars[i]);
        if (nextYearInfo && nextYearInfo.baseName === baseName) {
            return false;
        }
    }

    return true;
}

function matchesCarFilterValue(carName, selectedCarFilter) {
    const selected = String(selectedCarFilter || '');
    const car = String(carName || '');
    if (!selected || selected === 'All cars') return true;

    if (selected.startsWith('COMBINED_DTM:')) {
        const baseName = selected.substring(13);
        return car === baseName || car === `${baseName} DTM`;
    }

    if (selected.startsWith('COMBINED_YEAR:')) {
        const baseName = selected.substring(14);
        if (car === baseName) return true;
        const yearInfo = detectYearSuffix(car);
        return !!(yearInfo && yearInfo.baseName === baseName);
    }

    return car === selected;
}

/* ── badge helpers (shared by Cars page + Challenge Picker) ── */

const escHtml = (text) => R3EUtils.escapeHtml(text);

function wheelBadge(cat) {
    const v = (cat || '').toLowerCase().trim();
    if (!v) return '<span class="car-badge unknown">—</span>';
    if (v === 'gt') return '<span class="car-badge gt">GT</span>';
    if (v === 'round') return '<span class="car-badge round">Round</span>';
    if (v === 'round flat' || v === 'round (flat)' || v === 'round(flat)') return '<span class="car-badge round-flat" title="Round flat">Round flat</span>';
    return `<span class="car-badge unknown">${escHtml(cat)}</span>`;
}

function transBadge(cat) {
    const v = (cat || '').toLowerCase().trim();
    if (!v) return '<span class="car-badge trans unknown">—</span>';
    if (v === 'paddles') return '<span class="car-badge trans">Paddles</span>';
    if (v === 'sequential') return '<span class="car-badge trans sequential">Sequential</span>';
    if (v === 'h' || v === 'other') return '<span class="car-badge trans h">H</span>';
    return `<span class="car-badge trans unknown">${escHtml(cat)}</span>`;
}

function driveBadge(drive) {
    const v = (drive || '').toUpperCase().trim();
    if (!v) return '<span class="car-badge drive unknown">—</span>';
    if (v === 'RWD') return '<span class="car-badge drive rwd">RWD</span>';
    if (v === 'FWD') return '<span class="car-badge drive fwd">FWD</span>';
    if (v === '4WD' || v === 'AWD') return '<span class="car-badge drive awd">4WD</span>';
    return `<span class="car-badge drive unknown">${escHtml(drive)}</span>`;
}

/* ── rating widget (delegated to rating-widget.js) ── */

function buildRatingHtml(carId, currentRating, variant) {
    return (window.CarRatingWidget && CarRatingWidget.buildHtml)
        ? CarRatingWidget.buildHtml(carId, currentRating, variant) : '';
}

function attachRatingHandlers(rootEl) {
    if (window.CarRatingWidget && CarRatingWidget.attachHandlers) {
        CarRatingWidget.attachHandlers(rootEl);
    }
}

/* ── year badge color (1969=yellow → 2025=green) ────────── */

var YEAR_COLOR_MIN = 1969;
var YEAR_COLOR_MAX = 2025;

function yearBadgeColor(year) {
    var y = parseInt(year);
    if (isNaN(y)) return 'var(--color-badge-unknown-bg)';
    var t = Math.min(Math.max((y - YEAR_COLOR_MIN) / (YEAR_COLOR_MAX - YEAR_COLOR_MIN), 0), 1);
    var r = Math.round((1 - t) * 255 + t * 0);
    var g = Math.round((1 - t) * 214 + t * 200);
    var b = Math.round((1 - t) * 0 + t * 83);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
}

/* ── shared car-name display HTML ──────────────────────── */

function renderCarDisplayHtml(rawCarName, options) {
    options = options || {};
    var esc = (typeof R3EUtils !== 'undefined' && R3EUtils.escapeHtml) ? R3EUtils.escapeHtml : function (t) { return String(t || ''); };
    var flagHtml = options.flagHtml || '';
    var metaHtml = options.metaHtml || '';
    var cn = options.className || 'cars-page-car-name';
    var safeName = String(rawCarName || '');
    var split = splitCarName(safeName);
    var brand = String(split.brand || '').trim();
    var model = String(split.model || '').trim();
    var escBrand = esc(brand);
    var escModel = esc(model);
    var escName = esc(safeName);
    var brandLogoUrl = resolveBrandLogoPath(safeName);
    var brandLogoClass = brandLogoUrl.includes('logo-raceroom.png')
        ? 'table-brand-logo table-brand-logo-raceroom'
        : 'table-brand-logo';
    var brandLogoHtml = brandLogoUrl
        ? '<span class="table-brand-logo-slot cars-page-car-logo-slot"><img class="' + brandLogoClass + '" src="' + esc(brandLogoUrl) + '" alt="' + (escBrand || 'Car brand') + ' logo" loading="lazy" decoding="async" data-center-logo="true" /></span>'
        : '';

    if (!brand) {
        return '<span class="' + cn + '">' + flagHtml + brandLogoHtml + '<span class="cars-page-car-text"><span class="car-brand">' + escName + '</span></span>' + metaHtml + '</span>';
    }

    return '<span class="' + cn + '">' + flagHtml + brandLogoHtml + '<span class="cars-page-car-text"><span class="car-brand">' + escBrand + '</span>' + (model ? ' <span class="car-model cars-page-car-model">' + escModel + '</span>' : '') + '</span>' + metaHtml + '</span>';
}

/* ── brand logo centering handler ─────────────────────── */

function attachBrandLogoHandlers(rootEl) {
    Array.from(rootEl.querySelectorAll('img[data-center-logo]')).forEach(function (img) {
        img.addEventListener('load', function () {
            var renderedWidth = this.getBoundingClientRect().width || this.width || 22;
            var slotWidth = (this.parentElement && this.parentElement.getBoundingClientRect().width) || 22;
            var offsetX = (slotWidth - renderedWidth) / 2;
            this.style.marginLeft = offsetX + 'px';
        });
        img.addEventListener('error', function () {
            if (this.parentElement) { this.parentElement.remove(); } else { this.remove(); }
        });
    });
}

/* ── car class logo resolution ─────────────────────────── */

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

window.R3ECarUtils = {
    splitCarName,
    resolveBrandLogoPath,
    detectYearSuffix,
    detectDTMSuffix,
    findCarCombinations,
    findCombinationForCar,
    isLastInCarGroup,
    matchesCarFilterValue,
    wheelBadge,
    transBadge,
    driveBadge,
    buildRatingHtml,
    attachRatingHandlers,
    yearBadgeColor,
    renderCarDisplayHtml,
    attachBrandLogoHandlers,
    resolveCarClassLogoByName,
    resolveCarClassLogoById,
    resolveCarClassLogo,
    resolveDailyRaceClassLogos,
    getDailyRaceClassLogosHtml
};