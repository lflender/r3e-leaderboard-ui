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

window.R3ECarUtils = {
    splitCarName,
    resolveBrandLogoPath,
    detectYearSuffix,
    detectDTMSuffix,
    findCarCombinations,
    findCombinationForCar,
    isLastInCarGroup,
    matchesCarFilterValue
};