(function () {
  'use strict';

  let imageMapSource = null;
  let normalizedImageMap = new Map();

  function getStoreCarIdentity(link) {
    try {
      const segments = new URL(link).pathname.split('/').filter(Boolean);
      const carsIndex = segments.lastIndexOf('cars');
      if (carsIndex < 0 || segments.length <= carsIndex + 2) return '';
      const classSlug = segments[carsIndex + 1];
      const productSlug = segments.slice(carsIndex + 2).filter(segment => !/^\d+$/.test(segment)).pop();
      const normalize = segment => segment.toLowerCase().replace(/[^a-z0-9]/g, '');
      return classSlug && productSlug ? `${normalize(classSlug)}/${normalize(productSlug)}` : '';
    } catch (err) {
      return '';
    }
  }

  function getImageList(car, rawLink) {
    const imageMap = window.CAR_IMAGES_BY_LINK && typeof window.CAR_IMAGES_BY_LINK === 'object'
      ? window.CAR_IMAGES_BY_LINK : null;
    let images = imageMap && rawLink && Array.isArray(imageMap[rawLink]) ? imageMap[rawLink] : null;
    if (!images && imageMap && rawLink) {
      if (imageMapSource !== imageMap) {
        imageMapSource = imageMap;
        normalizedImageMap = new Map();
        Object.entries(imageMap).forEach(([link, list]) => {
          const identity = getStoreCarIdentity(link);
          if (!identity || !Array.isArray(list)) return;
          normalizedImageMap.set(identity, normalizedImageMap.has(identity) ? null : list);
        });
      }
      const identity = getStoreCarIdentity(rawLink);
      images = identity ? normalizedImageMap.get(identity) : null;
    }
    return images || (Array.isArray(car.image) ? car.image : (car.image ? [car.image] : []));
  }

  function formatDifficulty(difficulty) {
    return String(difficulty || '').trim().split(/\s+/).filter(Boolean)
      .map(word => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`).join(' ');
  }

  const valueClasses = {
    downforce: new Set(['low', 'medium', 'high']),
    difficulty: new Set(['very-easy', 'easy', 'moderate', 'hard', 'very-hard'])
  };

  function getValueClass(prefix, value) {
    const normalized = String(value || '').trim().toLowerCase().replace(/\s+/g, '-');
    return valueClasses[prefix]?.has(normalized) ? `carinfo-${prefix}--${normalized}` : '';
  }

  function render(car, options = {}) {
    const esc = R3EUtils.escapeHtml;
    const utils = R3ECarUtils;
    const rawLink = String(car.link || '').trim();
    const link = esc(rawLink);
    const images = getImageList(car, rawLink);
    const encodedImages = encodeURIComponent(JSON.stringify(images));
    const image = esc(images[0] || car.thumbnail || '');
    const flag = FlagHelper.countryToFlag(car.country || '');
    const flagHtml = flag ? `<span class="car-tile-flag-overlay">${flag}</span>` : '';
    const name = car.car || '';
    const nameHtml = utils.renderCarDisplayHtml(name, { className: 'cars-page-car-name cars-page-car-name-tile' });
    const isSafetyCar = (car.car_class || car.class || '').toLowerCase() === 'safety car';
    const warning = isSafetyCar ? '<span class="warning-icon" title="Not eligible to Leaderboards" aria-label="Warning" role="img">⚠️</span>' : '';
    const open = link ? `<a class="car-tile-link" href="${link}" target="_blank" rel="noopener">` : '<div class="car-tile-link">';
    const close = link ? '</a>' : '</div>';
    const description = car.description ? `<div class="car-tile-description">${esc(car.description)}</div>` : '';
    const year = `<span class="car-tile-year-overlay car-badge year-badge" data-year="${esc(car.year || '')}" style="background:${utils.yearBadgeColor(car.year)}">${esc(car.year || '')}</span>`;
    const weight = (car.weight || '—').replace(/kg\*$/, 'kg with driver');
    const ratingId = CarRatings.buildCarId(car);
    const rating = utils.buildRatingHtml(ratingId, CarRatings.get(ratingId), 'tile');
    const assists = [
      car.TC === 'true' ? '<span class="car-tile-assist-badge car-tile-assist--tc">TC</span>' : '',
      car.ABS === 'true' ? '<span class="car-tile-assist-badge car-tile-assist--abs">ABS</span>' : '',
      car.LC === 'true' ? '<span class="car-tile-assist-badge car-tile-assist--lc">Launch Control</span>' : ''
    ].filter(Boolean).join('');
    return `<article class="car-tile${options.className ? ' ' + options.className : ''}">` +
      `${open}<div class="car-tile-name">${options.namePrefix || ''}${nameHtml}${warning}</div>` +
      `${image ? `<div class="car-tile-image-wrap"><div class="car-tile-top-row">${flagHtml}${rating}</div><img class="car-tile-image car-rotating-image" data-image-list="${encodedImages}" src="${image}" alt="${esc(name)}" loading="lazy" decoding="async">${year}</div>` : ''}${close}` +
      `<div class="car-tile-meta"><span>${utils.wheelBadge(car.wheel_cat)}</span><span>${utils.transBadge(car.transmission_cat)}</span><span>${utils.driveBadge(car.drive)}</span>` +
      `${assists ? `<div class="car-tile-assists-row">${assists}</div>` : ''}` +
      `<div class="car-tile-specs">${esc(car.power || '—')} • ${esc(weight)} • ${esc(car.engine || '—')}</div>` +
      `<div class="car-tile-driving-specs"><div class="car-tile-driving-spec"><span>Downforce</span><strong class="carinfo-meta car-tile-value ${getValueClass('downforce', car.downforce)}">${esc(car.downforce || '—')}</strong></div>` +
      `<div class="car-tile-driving-spec"><span>Difficulty</span><strong class="carinfo-meta car-tile-value ${getValueClass('difficulty', car.difficulty)}">${esc(formatDifficulty(car.difficulty) || '—')}</strong></div></div>${description}</div></article>`;
  }

  window.CarTile = { render, getImageList, formatDifficulty, getValueClass };
})();
