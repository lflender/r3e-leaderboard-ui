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
    'E36 V8 JUDD': { brand: 'Judd', model: 'E36 V8' },
    '134 Judd V8': { brand: 'Judd', model: '134 V8' }
};

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
    detectYearSuffix,
    detectDTMSuffix,
    findCarCombinations,
    findCombinationForCar,
    isLastInCarGroup,
    matchesCarFilterValue
};