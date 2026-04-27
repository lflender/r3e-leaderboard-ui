// Car rating storage module
// Stores user ratings for cars in localStorage
// Ratings: 1–5 = stars, 6 = heart (favorite), 0 = unrated
const CarRatings = (() => {
  const STORAGE_KEY = 'r3e-car-ratings';

  function buildCarId(carOrId) {
    if (!carOrId) return '';
    if (typeof carOrId === 'string') return carOrId.trim();

    const carClass = String(carOrId.car_class || carOrId.class || '').trim();
    const carName = String(carOrId.car || '').trim();
    const year = String(carOrId.year || '').trim();
    const link = String(carOrId.link || '').trim();

    return [carClass, carName, year, link].join('||');
  }

  function isStructuredCarId(id) {
    if (!id || typeof id !== 'string') return false;
    const parts = id.split('||');
    if (parts.length !== 4) return false;
    return parts[0].trim().length > 0 && parts[1].trim().length > 0;
  }

  function load() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function save(data) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  function normalize(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {};

    return Object.entries(data).reduce((accumulator, [id, score]) => {
      const normalizedId = buildCarId(id);
      const normalizedScore = Number(score);
      if (
        isStructuredCarId(normalizedId) &&
        Number.isInteger(normalizedScore) &&
        normalizedScore >= 1 &&
        normalizedScore <= 6
      ) {
        accumulator[normalizedId] = normalizedScore;
      }
      return accumulator;
    }, {});
  }

  function isValidScore(value) {
    return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 6;
  }

  function getLegacyLinkFromStructuredId(id) {
    if (!isStructuredCarId(id)) return '';
    const parts = id.split('||');
    return String(parts[3] || '').trim();
  }

  // Add structured IDs from legacy link-based keys without deleting old keys.
  function migrateLegacyKeysAdditively() {
    const data = load();
    let changed = false;

    if (Array.isArray(window.CARS_DATA)) {
      window.CARS_DATA.forEach(cls => {
        (cls.cars || []).forEach(car => {
          const structuredId = buildCarId(car);
          if (!isStructuredCarId(structuredId)) return;
          if (isValidScore(data[structuredId])) return;

          const legacyLink = String(car.link || '').trim();
          const legacyScore = data[legacyLink];
          if (isValidScore(legacyScore)) {
            data[structuredId] = legacyScore;
            changed = true;
          }
        });
      });
    }

    if (changed) {
      save(data);
    }
  }

  // Returns 0 (unrated) or a score 1–6
  function get(carId) {
    const normalizedId = buildCarId(carId);
    if (!normalizedId) return 0;
    const data = load();
    const score = data[normalizedId];
    if (isValidScore(score)) return score;

    // Backward-compatible read for legacy link-only keys.
    const legacyLink = getLegacyLinkFromStructuredId(normalizedId);
    const legacyScore = legacyLink ? data[legacyLink] : undefined;
    return isValidScore(legacyScore) ? legacyScore : 0;
  }

  // score = 0 clears the rating
  function set(carId, score) {
    const normalizedId = buildCarId(carId);
    if (!normalizedId) return;
    const data = load();
    if (score === 0) {
      delete data[normalizedId];
    } else if (score >= 1 && score <= 6) {
      data[normalizedId] = score;
    }
    save(data);
  }

  // Returns all rated cars sorted by score descending
  function getAll() {
    const data = load();
    return Object.entries(data)
      .map(([id, score]) => ({ id, score }))
      .sort((a, b) => b.score - a.score);
  }

  function exportPayload() {
    return normalize(load());
  }

  function replaceAll(nextRatings) {
    const structuredOnly = normalize(nextRatings);

    // Accept legacy link-based imports by mapping them to structured IDs when possible.
    if (nextRatings && typeof nextRatings === 'object' && !Array.isArray(nextRatings) && Array.isArray(window.CARS_DATA)) {
      window.CARS_DATA.forEach(cls => {
        (cls.cars || []).forEach(car => {
          const structuredId = buildCarId(car);
          if (!isStructuredCarId(structuredId)) return;
          if (isValidScore(structuredOnly[structuredId])) return;

          const legacyLink = String(car.link || '').trim();
          const legacyScoreRaw = nextRatings[legacyLink];
          const legacyScore = Number(legacyScoreRaw);
          if (isValidScore(legacyScore)) {
            structuredOnly[structuredId] = legacyScore;
          }
        });
      });
    }

    save(structuredOnly);
  }

  function importPayload(payload) {
    const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid ratings file');
    }

    const ratings = parsed.ratings && typeof parsed.ratings === 'object'
      ? parsed.ratings
      : parsed;

    replaceAll(ratings);
    return getAll().length;
  }

  // Never perform destructive startup cleanup. Only additive migration is allowed.
  migrateLegacyKeysAdditively();

  return { get, set, getAll, buildCarId, exportPayload, importPayload, replaceAll, STORAGE_KEY };
})();

window.CarRatings = CarRatings;
