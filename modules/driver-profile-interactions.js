/**
 * Driver Profile Chart Interaction Module
 * Handles all cross-chart highlighting between pie charts, performance dots,
 * entries-distribution bars, and stat breakdowns on the driver profile page.
 */
const DriverProfileInteractions = (() => {
    const POP_DISTANCE = 8;

    function showSliceLabels(chartEl, slices) {
        PieChart.showSliceLabels(chartEl, slices);
    }

    function clearSliceLabels() {
        PieChart.clearSliceLabels();
    }

    /**
     * Pop out a slice via transform translate along its midAngle.
     */
    function popSlice(slice) {
        const midAngle = parseFloat(slice.getAttribute('data-mid-angle'));
        if (!isNaN(midAngle)) {
            const tx = Math.cos(midAngle) * POP_DISTANCE;
            const ty = Math.sin(midAngle) * POP_DISTANCE;
            slice.style.transform = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px)`;
        }
    }

    /**
     * Apply active/dimmed states to slices based on a predicate.
     */
    function highlightSlices(slices, matchFn) {
        slices.forEach(slice => {
            if (matchFn(slice)) {
                slice.classList.add('pie-slice--active');
                popSlice(slice);
            } else {
                slice.classList.add('pie-slice--dimmed');
                slice.style.transform = '';
            }
        });
    }

    /**
     * Apply active/dimmed states to legend items based on a predicate.
     */
    function highlightLegend(items, matchFn) {
        let firstActive = null;
        items.forEach(el => {
            if (matchFn(el)) {
                el.classList.add('pie-legend-item--active');
                if (!firstActive) firstActive = el;
            } else {
                el.classList.add('pie-legend-item--dimmed');
            }
        });
        // Scroll the first active legend item into view within its scroll container
        if (firstActive) {
            scrollIntoViewSmooth(firstActive);
        }
    }

    /**
     * Scroll an element into its scrollable parent's viewport with smooth animation.
     * A new scrollTo call inherently cancels any in-flight smooth scroll.
     */
    function scrollIntoViewSmooth(el) {
        const parent = el.closest('.pie-legend') || el.closest('.stat-breakdown-list');
        if (!parent) return;
        const parentRect = parent.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        if (elRect.top >= parentRect.top && elRect.bottom <= parentRect.bottom) return;
        const offset = el.offsetTop - parent.offsetTop - 4;
        parent.scrollTo({ top: offset, behavior: 'smooth' });
    }

    /**
     * Clear all active/dimmed states from slices.
     */
    function clearSlices(slices) {
        slices.forEach(slice => {
            slice.classList.remove('pie-slice--active', 'pie-slice--dimmed');
            slice.style.transform = '';
        });
    }

    /**
     * Clear all active/dimmed states from legend items.
     */
    function clearLegend(items) {
        items.forEach(el => {
            el.classList.remove('pie-legend-item--active', 'pie-legend-item--dimmed');
        });
    }

    /**
     * Highlight stat breakdown items matching a predicate and scroll each container's first match into view.
     */
    function highlightBreakdownItems(matchFn) {
        const scrolled = new Set();
        document.querySelectorAll('.driver-stat-breakdown .pie-legend-item').forEach(bd => {
            if (matchFn(bd)) {
                bd.classList.add('pie-legend-item--active');
                bd.classList.remove('pie-legend-item--dimmed');
                const parent = bd.closest('.stat-breakdown-list');
                if (parent && !scrolled.has(parent)) {
                    scrolled.add(parent);
                    scrollIntoViewSmooth(bd);
                }
            } else {
                bd.classList.add('pie-legend-item--dimmed');
            }
        });
    }

    /**
     * Wire bidirectional highlighting between Car Classes, Cars, and Tracks charts.
     * @param {Array} entries - Raw driver leaderboard entries
     */
    function wireCarClassChartInteraction(entries) {
        const classChart = document.getElementById('chart-car-class');
        const carChart = document.getElementById('chart-car');
        const trackChart = document.getElementById('chart-track');
        if (!classChart || !carChart) return;

        const carToClass = (window.DriverProfileData && DriverProfileData.getCarToClassMap)
            ? DriverProfileData.getCarToClassMap(entries)
            : new Map();

        const classLegendItems = classChart.querySelectorAll('.pie-legend-item');
        const carLegendItems = carChart.querySelectorAll('.pie-legend-item');
        const carSlices = carChart.querySelectorAll('.pie-slice');
        const classSlices = classChart.querySelectorAll('.pie-slice');
        const trackLegendItems = trackChart ? trackChart.querySelectorAll('.pie-legend-item') : [];
        const trackSlices = trackChart ? trackChart.querySelectorAll('.pie-slice') : [];

        // Annotate car elements with their class
        carLegendItems.forEach(el => {
            const label = (el.querySelector('.pie-legend-label') || {}).textContent || '';
            const cls = carToClass.get(label.trim()) || '';
            if (cls) el.setAttribute('data-class-label', cls);
        });
        carSlices.forEach(el => {
            const label = el.getAttribute('data-label') || '';
            const cls = carToClass.get(label.trim()) || '';
            if (cls) el.setAttribute('data-class-label', cls);
        });

        // Build relationship maps from entries
        const trackToClasses = new Map();
        const classToTracks = new Map();
        const carToTracks = new Map();
        const trackToCars = new Map();
        if (entries && entries.length > 0) {
            entries.forEach(entry => {
                const cls = entry.car_class || entry.CarClass || entry.Class || '';
                const car = entry.Car || entry.car || entry.CarName || entry.car_name || '';
                const track = (window.R3EUtils && typeof window.R3EUtils.resolveTrackLabelForItem === 'function')
                    ? window.R3EUtils.resolveTrackLabelForItem(entry)
                    : (entry.Track || entry.track || entry.TrackName || entry.track_name || '');
                if (cls && track) {
                    if (!trackToClasses.has(track)) trackToClasses.set(track, new Set());
                    trackToClasses.get(track).add(cls);
                    if (!classToTracks.has(cls)) classToTracks.set(cls, new Set());
                    classToTracks.get(cls).add(track);
                }
                if (car && track) {
                    if (!carToTracks.has(car)) carToTracks.set(car, new Set());
                    carToTracks.get(car).add(track);
                    if (!trackToCars.has(track)) trackToCars.set(track, new Set());
                    trackToCars.get(track).add(car);
                }
            });
        }

        // Annotate track elements with their classes
        trackLegendItems.forEach(el => {
            const label = ((el.querySelector('.pie-legend-label') || {}).textContent || '').trim();
            const classes = trackToClasses.get(label);
            if (classes) el.setAttribute('data-class-labels', Array.from(classes).join('|'));
        });
        trackSlices.forEach(el => {
            const label = (el.getAttribute('data-label') || '').trim();
            const classes = trackToClasses.get(label);
            if (classes) el.setAttribute('data-class-labels', Array.from(classes).join('|'));
        });

        // --- Highlight functions ---

        function highlightCarsByClass(classLabel, { fromClassChart = false } = {}) {
            highlightSlices(classSlices, s => (s.getAttribute('data-label') || '') === classLabel);
            highlightLegend(classLegendItems, el => {
                const lbl = ((el.querySelector('.pie-legend-label') || {}).textContent || '').trim();
                return lbl === classLabel;
            });
            highlightLegend(carLegendItems, el => el.getAttribute('data-class-label') === classLabel);
            highlightSlices(carSlices, s => s.getAttribute('data-class-label') === classLabel);
            highlightLegend(trackLegendItems, el => {
                const classes = (el.getAttribute('data-class-labels') || '').split('|');
                return classes.includes(classLabel);
            });
            highlightSlices(trackSlices, s => {
                const classes = (s.getAttribute('data-class-labels') || '').split('|');
                return classes.includes(classLabel);
            });
            if (!fromClassChart) showSliceLabels(classChart, classSlices);
            showSliceLabels(carChart, carSlices);
            if (trackChart) showSliceLabels(trackChart, trackSlices);
        }

        function clearCarHighlights() {
            clearSliceLabels();
            clearSlices(classSlices);
            clearLegend(classLegendItems);
            clearLegend(carLegendItems);
            clearSlices(carSlices);
            clearLegend(trackLegendItems);
            clearSlices(trackSlices);
        }

        function highlightClassByCar(cls, carLabel, { fromCarChart = false } = {}) {
            highlightLegend(classLegendItems, el => {
                const lbl = ((el.querySelector('.pie-legend-label') || {}).textContent || '').trim();
                return lbl === cls;
            });
            highlightSlices(classSlices, s => (s.getAttribute('data-label') || '') === cls);

            const tracks = carLabel ? carToTracks.get(carLabel) : null;
            highlightLegend(trackLegendItems, el => {
                const lbl = ((el.querySelector('.pie-legend-label') || {}).textContent || '').trim();
                return !!(tracks && tracks.has(lbl));
            });
            highlightSlices(trackSlices, s => {
                const lbl = (s.getAttribute('data-label') || '').trim();
                return !!(tracks && tracks.has(lbl));
            });

            // Highlight class breakdowns
            highlightBreakdownItems(bd => bd.getAttribute('data-class-label') === cls);

            showSliceLabels(classChart, classSlices);
            if (trackChart) showSliceLabels(trackChart, trackSlices);
            if (!fromCarChart) showSliceLabels(carChart, carSlices);
        }

        function clearClassHighlights() {
            clearSliceLabels();
            clearLegend(classLegendItems);
            clearSlices(classSlices);
            clearLegend(trackLegendItems);
            clearSlices(trackSlices);
            document.querySelectorAll('.driver-stat-breakdown .pie-legend-item').forEach(bd => {
                bd.classList.remove('pie-legend-item--active', 'pie-legend-item--dimmed');
            });
        }

        function highlightByTrack(trackLabel, { fromTrackChart = false } = {}) {
            const classes = trackToClasses.get(trackLabel);
            if (!classes) return;
            highlightLegend(classLegendItems, el => {
                const lbl = ((el.querySelector('.pie-legend-label') || {}).textContent || '').trim();
                return classes.has(lbl);
            });
            highlightSlices(classSlices, s => {
                const lbl = (s.getAttribute('data-label') || '').trim();
                return classes.has(lbl);
            });
            const cars = trackToCars.get(trackLabel);
            highlightLegend(carLegendItems, el => {
                const lbl = ((el.querySelector('.pie-legend-label') || {}).textContent || '').trim();
                return !!(cars && cars.has(lbl));
            });
            highlightSlices(carSlices, s => {
                const lbl = (s.getAttribute('data-label') || '').trim();
                return !!(cars && cars.has(lbl));
            });
            // Highlight class breakdowns
            highlightBreakdownItems(bd => classes.has(bd.getAttribute('data-class-label') || ''));
            showSliceLabels(classChart, classSlices);
            showSliceLabels(carChart, carSlices);
            if (!fromTrackChart) showSliceLabels(trackChart, trackSlices);
        }

        function clearTrackHighlights() {
            clearClassHighlights();
            clearCarHighlights();
        }

        // --- Event wiring ---

        // Class chart legend + slices → highlight matching cars
        classLegendItems.forEach(el => {
            const classLabel = ((el.querySelector('.pie-legend-label') || {}).textContent || '').trim();
            if (!classLabel) return;
            el.addEventListener('mouseenter', (e) => highlightCarsByClass(classLabel, { fromClassChart: e.isTrusted }));
            el.addEventListener('mouseleave', clearCarHighlights);
        });
        classSlices.forEach(el => {
            const classLabel = (el.getAttribute('data-label') || '').trim();
            if (!classLabel) return;
            el.addEventListener('mouseenter', () => highlightCarsByClass(classLabel, { fromClassChart: true }));
            el.addEventListener('mouseleave', clearCarHighlights);
        });

        // Car chart legend + slices → highlight matching class + tracks
        carLegendItems.forEach(el => {
            const cls = el.getAttribute('data-class-label') || '';
            const carLabel = ((el.querySelector('.pie-legend-label') || {}).textContent || '').trim();
            if (!cls) return;
            el.addEventListener('mouseenter', () => highlightClassByCar(cls, carLabel, { fromCarChart: true }));
            el.addEventListener('mouseleave', clearClassHighlights);
        });
        carSlices.forEach(el => {
            const cls = el.getAttribute('data-class-label') || '';
            const carLabel = (el.getAttribute('data-label') || '').trim();
            if (!cls) return;
            el.addEventListener('mouseenter', () => highlightClassByCar(cls, carLabel, { fromCarChart: true }));
            el.addEventListener('mouseleave', clearClassHighlights);
        });

        // Track chart → highlight matching classes, cars, and breakdowns
        if (trackChart) {
            trackLegendItems.forEach(el => {
                const label = ((el.querySelector('.pie-legend-label') || {}).textContent || '').trim();
                if (!label) return;
                el.addEventListener('mouseenter', () => highlightByTrack(label, { fromTrackChart: true }));
                el.addEventListener('mouseleave', clearTrackHighlights);
            });
            trackSlices.forEach(el => {
                const label = (el.getAttribute('data-label') || '').trim();
                if (!label) return;
                el.addEventListener('mouseenter', () => highlightByTrack(label, { fromTrackChart: true }));
                el.addEventListener('mouseleave', clearTrackHighlights);
            });
        }

        // Highlight cards (Most Used Car / Track) → dispatch events on matching pie legend items
        // so all existing cross-highlighting chains (perf dots, entries-dist bars, etc.) fire.
        const carHighlight = document.querySelector('.highlight-card-car');
        if (carHighlight && carChart) {
            const carName = (carHighlight.getAttribute('data-car-label') || '').trim();
            let matchedLegend = null;
            carLegendItems.forEach(el => {
                const lbl = ((el.querySelector('.pie-legend-label') || {}).textContent || '').trim();
                if (lbl === carName) matchedLegend = el;
            });
            if (matchedLegend) {
                carHighlight.addEventListener('mouseenter', () => {
                    matchedLegend.dispatchEvent(new Event('mouseenter'));
                    showSliceLabels(carChart, carSlices);
                });
                carHighlight.addEventListener('mouseleave', () => matchedLegend.dispatchEvent(new Event('mouseleave')));
            }
        }
        const trackHighlight = document.querySelector('.highlight-card-track');
        if (trackHighlight && trackChart) {
            const trackLabel = (trackHighlight.getAttribute('data-track-label') || '').trim();
            let matchedLegend = null;
            trackLegendItems.forEach(el => {
                const lbl = ((el.querySelector('.pie-legend-label') || {}).textContent || '').trim();
                if (lbl === trackLabel) matchedLegend = el;
            });
            if (matchedLegend) {
                trackHighlight.addEventListener('mouseenter', () => {
                    matchedLegend.dispatchEvent(new Event('mouseenter'));
                    showSliceLabels(trackChart, trackSlices);
                });
                trackHighlight.addEventListener('mouseleave', () => matchedLegend.dispatchEvent(new Event('mouseleave')));
            }
        }
    }

    /**
     * Wire pie chart hover → performance graph dot cross-highlighting.
     */
    function wirePieChartPerfHighlighting() {
        const perfChart = document.querySelector('.perf-dist-chart');
        if (!perfChart) return;

        const perfPoints = Array.from(perfChart.querySelectorAll('.perf-dist-point'));
        if (perfPoints.length === 0) return;

        let highlightedPoints = [];

        function highlightPoints(matchFn) {
            clearPoints();
            highlightedPoints = perfPoints.filter(matchFn);
            highlightedPoints.forEach(p => p.classList.add('perf-dist-point--active'));
        }

        function clearPoints() {
            highlightedPoints.forEach(p => p.classList.remove('perf-dist-point--active'));
            highlightedPoints = [];
        }

        function wireChart(chartId, matchFn) {
            const chart = document.getElementById(chartId);
            if (!chart) return;

            chart.querySelectorAll('.pie-slice').forEach(el => {
                const label = (el.getAttribute('data-label') || '').trim();
                if (!label) return;
                el.addEventListener('mouseenter', () => highlightPoints(p => matchFn(p, label)));
                el.addEventListener('mouseleave', clearPoints);
            });

            chart.querySelectorAll('.pie-legend-item').forEach(el => {
                const labelEl = el.querySelector('.pie-legend-label');
                const label = (labelEl ? labelEl.textContent : '').trim();
                if (!label) return;
                el.addEventListener('mouseenter', () => highlightPoints(p => matchFn(p, label)));
                el.addEventListener('mouseleave', clearPoints);
            });
        }

        wireChart('chart-car-class', (point, label) =>
            point.getAttribute('data-class') === label
        );

        wireChart('chart-car', (point, label) => {
            const info = point.getAttribute('data-info') || '';
            const car = info.split(' \u2013 ')[0];
            return car === label;
        });

        wireChart('chart-track', (point, label) => {
            const info = point.getAttribute('data-info') || '';
            const parts = info.split(' \u2013 ');
            return parts.length > 1 && parts[1] === label;
        });
    }

    /**
     * Wire hover on pie charts, perf dots, and stat class breakdowns
     * to cross-highlight matching bars in the Entries Distribution Graph.
     * @param {Array} entries - Raw driver leaderboard entries
     * @param {HTMLElement} container - The distributions container element
     */
    function wireEntriesDistCrossHighlighting(entries, container) {
        if (!entries || entries.length === 0) return;
        if (!window.EntriesChart) return;
        if (!container) return;

        const svg = container.querySelector('.entries-dist-chart svg');
        if (!svg) return;

        const bars = Array.from(svg.querySelectorAll('.entries-dist-bar'));
        if (bars.length === 0) return;

        const barByDate = new Map();
        bars.forEach(bar => {
            const d = bar.getAttribute('data-date');
            if (d) barByDate.set(d, bar);
        });

        const classDates = new Map();
        const carDates = new Map();
        const trackDates = new Map();

        entries.forEach(entry => {
            const dt = EntriesChart.parseEntryDate(entry);
            if (!dt) return;
            const dateKey = EntriesChart.getLocalDateKey(dt);
            if (!dateKey) return;

            const cls = entry.car_class || entry.CarClass || entry.Class || '';
            const car = entry.Car || entry.car || entry.CarName || entry.car_name || '';
            const track = (window.R3EUtils && typeof window.R3EUtils.resolveTrackLabelForItem === 'function')
                ? window.R3EUtils.resolveTrackLabelForItem(entry)
                : (entry.Track || entry.track || entry.TrackName || entry.track_name || '');

            if (cls) {
                if (!classDates.has(cls)) classDates.set(cls, new Set());
                classDates.get(cls).add(dateKey);
            }
            if (car) {
                if (!carDates.has(car)) carDates.set(car, new Set());
                carDates.get(car).add(dateKey);
            }
            if (track) {
                if (!trackDates.has(track)) trackDates.set(track, new Set());
                trackDates.get(track).add(dateKey);
            }
        });

        let highlightedBars = [];

        function highlightBars(dates) {
            clearBars();
            if (!dates) return;
            dates.forEach(d => {
                const bar = barByDate.get(d);
                if (bar) {
                    bar.classList.add('entries-dist-bar--active');
                    highlightedBars.push(bar);
                }
            });
        }

        function clearBars() {
            highlightedBars.forEach(b => b.classList.remove('entries-dist-bar--active'));
            highlightedBars = [];
        }

        function wirePieChart(chartId, dateMap) {
            const chart = document.getElementById(chartId);
            if (!chart) return;

            chart.querySelectorAll('.pie-slice').forEach(el => {
                const label = (el.getAttribute('data-label') || '').trim();
                if (!label) return;
                el.addEventListener('mouseenter', () => highlightBars(dateMap.get(label)));
                el.addEventListener('mouseleave', clearBars);
            });

            chart.querySelectorAll('.pie-legend-item').forEach(el => {
                const labelEl = el.querySelector('.pie-legend-label');
                const label = (labelEl ? labelEl.textContent : '').trim();
                if (!label) return;
                el.addEventListener('mouseenter', () => highlightBars(dateMap.get(label)));
                el.addEventListener('mouseleave', clearBars);
            });
        }

        wirePieChart('chart-car-class', classDates);
        wirePieChart('chart-car', carDates);
        wirePieChart('chart-track', trackDates);

        // Performance dots → entries-dist bars
        const perfChart = container.querySelector('.perf-dist-chart');
        if (perfChart) {
            perfChart.addEventListener('mousemove', () => {
                const activePoint = perfChart.querySelector('.perf-dist-point--active');
                if (activePoint) {
                    const date = activePoint.getAttribute('data-date');
                    if (date) highlightBars(new Set([date]));
                } else {
                    clearBars();
                }
            });
            perfChart.addEventListener('mouseleave', clearBars);
        }

        // Stats class breakdown items → entries-dist bars
        document.querySelectorAll('.driver-stat-breakdown .pie-legend-item').forEach(el => {
            const cls = el.getAttribute('data-class-label') || '';
            if (!cls) return;
            el.addEventListener('mouseenter', () => highlightBars(classDates.get(cls)));
            el.addEventListener('mouseleave', clearBars);
        });
    }

    /**
     * Wire bidirectional hover between stat breakdowns and the Car Classes pie chart.
     */
    function wireBreakdownChartInteraction() {
        const chartContainer = document.getElementById('chart-car-class');
        if (!chartContainer) return;

        const chartLegendItems = chartContainer.querySelectorAll('.pie-legend-item');
        const chartSlices = chartContainer.querySelectorAll('.pie-slice');
        const allBreakdownItems = document.querySelectorAll('.driver-stat-breakdown .pie-legend-item');

        const labelToChartLegend = new Map();
        chartLegendItems.forEach(el => {
            const label = (el.querySelector('.pie-legend-label') || {}).textContent || '';
            if (label) labelToChartLegend.set(label.trim(), el);
        });

        allBreakdownItems.forEach(el => {
            const label = el.getAttribute('data-class-label');
            const matchingLegend = labelToChartLegend.get(label);

            el.addEventListener('mouseenter', () => {
                allBreakdownItems.forEach(bd => {
                    if (bd === el) {
                        bd.classList.add('pie-legend-item--active');
                        bd.classList.remove('pie-legend-item--dimmed');
                    } else {
                        bd.classList.add('pie-legend-item--dimmed');
                        bd.classList.remove('pie-legend-item--active');
                    }
                });
                if (matchingLegend) matchingLegend.dispatchEvent(new Event('mouseenter'));
            });
            el.addEventListener('mouseleave', () => {
                allBreakdownItems.forEach(bd => {
                    bd.classList.remove('pie-legend-item--active', 'pie-legend-item--dimmed');
                });
                if (matchingLegend) matchingLegend.dispatchEvent(new Event('mouseleave'));
            });
        });

        chartLegendItems.forEach(el => {
            const label = ((el.querySelector('.pie-legend-label') || {}).textContent || '').trim();
            if (!label) return;
            el.addEventListener('mouseenter', () => {
                highlightBreakdownItems(bd => bd.getAttribute('data-class-label') === label);
            });
            el.addEventListener('mouseleave', () => {
                allBreakdownItems.forEach(bd => bd.classList.remove('pie-legend-item--active', 'pie-legend-item--dimmed'));
            });
        });

        chartSlices.forEach(el => {
            const label = el.getAttribute('data-label');
            if (!label) return;
            el.addEventListener('mouseenter', () => {
                highlightBreakdownItems(bd => bd.getAttribute('data-class-label') === label);
            });
            el.addEventListener('mouseleave', () => {
                allBreakdownItems.forEach(bd => bd.classList.remove('pie-legend-item--active', 'pie-legend-item--dimmed'));
            });
        });
    }

    /**
     * Wire hover on entries-dist bars and perf-dist points → cross-highlight
     * matching pie slices, legend items, and stat breakdown items.
     * @param {Array} entries - Raw driver leaderboard entries
     * @param {HTMLElement} container - The distributions container element
     */
    function wireDistPerfToPieHighlighting(entries, container) {
        if (!entries || entries.length === 0) return;
        if (!container) return;
        if (!window.EntriesChart) return;

        // Build date → {classes, cars, tracks} lookup
        const dateToClasses = new Map();
        const dateToCars = new Map();
        const dateToTracks = new Map();
        entries.forEach(entry => {
            const dt = EntriesChart.parseEntryDate(entry);
            if (!dt) return;
            const dateKey = EntriesChart.getLocalDateKey(dt);
            if (!dateKey) return;

            const cls = entry.car_class || entry.CarClass || entry.Class || '';
            const car = entry.Car || entry.car || entry.CarName || entry.car_name || '';
            const track = (window.R3EUtils && typeof window.R3EUtils.resolveTrackLabelForItem === 'function')
                ? window.R3EUtils.resolveTrackLabelForItem(entry)
                : (entry.Track || entry.track || entry.TrackName || entry.track_name || '');

            if (cls) {
                if (!dateToClasses.has(dateKey)) dateToClasses.set(dateKey, new Set());
                dateToClasses.get(dateKey).add(cls);
            }
            if (car) {
                if (!dateToCars.has(dateKey)) dateToCars.set(dateKey, new Set());
                dateToCars.get(dateKey).add(car);
            }
            if (track) {
                if (!dateToTracks.has(dateKey)) dateToTracks.set(dateKey, new Set());
                dateToTracks.get(dateKey).add(track);
            }
        });

        const classChart = document.getElementById('chart-car-class');
        const carChart = document.getElementById('chart-car');
        const trackChart = document.getElementById('chart-track');

        const classSlices = classChart ? classChart.querySelectorAll('.pie-slice') : [];
        const carSlices = carChart ? carChart.querySelectorAll('.pie-slice') : [];
        const trackSlices = trackChart ? trackChart.querySelectorAll('.pie-slice') : [];
        const classLegend = classChart ? classChart.querySelectorAll('.pie-legend-item') : [];
        const carLegend = carChart ? carChart.querySelectorAll('.pie-legend-item') : [];
        const trackLegend = trackChart ? trackChart.querySelectorAll('.pie-legend-item') : [];

        function highlightByDate(dateKey) {
            if (!dateKey) return;
            const classes = dateToClasses.get(dateKey);
            const cars = dateToCars.get(dateKey);
            const tracks = dateToTracks.get(dateKey);

            if (classes) {
                highlightSlices(classSlices, s => classes.has((s.getAttribute('data-label') || '').trim()));
                highlightLegend(classLegend, el => {
                    const lbl = ((el.querySelector('.pie-legend-label') || {}).textContent || '').trim();
                    return classes.has(lbl);
                });
                // Breakdown items
                highlightBreakdownItems(bd => classes.has(bd.getAttribute('data-class-label') || ''));
            }
            if (cars) {
                highlightSlices(carSlices, s => cars.has((s.getAttribute('data-label') || '').trim()));
                highlightLegend(carLegend, el => {
                    const lbl = ((el.querySelector('.pie-legend-label') || {}).textContent || '').trim();
                    return cars.has(lbl);
                });
            }
            if (tracks) {
                highlightSlices(trackSlices, s => tracks.has((s.getAttribute('data-label') || '').trim()));
                highlightLegend(trackLegend, el => {
                    const lbl = ((el.querySelector('.pie-legend-label') || {}).textContent || '').trim();
                    return tracks.has(lbl);
                });
            }

            if (classChart) showSliceLabels(classChart, classSlices);
            if (carChart) showSliceLabels(carChart, carSlices);
            if (trackChart) showSliceLabels(trackChart, trackSlices);
        }

        function clearAll() {
            clearSliceLabels();
            clearSlices(classSlices);
            clearLegend(classLegend);
            clearSlices(carSlices);
            clearLegend(carLegend);
            clearSlices(trackSlices);
            clearLegend(trackLegend);
            document.querySelectorAll('.driver-stat-breakdown .pie-legend-item').forEach(bd => {
                bd.classList.remove('pie-legend-item--active', 'pie-legend-item--dimmed');
            });
        }

        // Entries dist bars → pie highlighting
        const svg = container.querySelector('.entries-dist-chart:not(.perf-dist-chart) svg');
        if (svg) {
            const bars = Array.from(svg.querySelectorAll('.entries-dist-bar'));
            const contentBars = bars.filter(b => b.getAttribute('data-count') !== '0');

            let lastActiveDate = null;

            svg.addEventListener('mousemove', (e) => {
                const rect = svg.getBoundingClientRect();
                const svgWidth = rect.width;
                if (svgWidth === 0) return;
                const viewBox = svg.viewBox.baseVal;
                const mouseXRatio = (e.clientX - rect.left) / svgWidth;
                const svgX = mouseXRatio * viewBox.width;

                let nearest = null;
                let minDist = Infinity;
                const searchBars = contentBars.length > 0 ? contentBars : bars;
                searchBars.forEach(bar => {
                    const bx = parseFloat(bar.getAttribute('x')) + 0.45;
                    const dist = Math.abs(bx - svgX);
                    if (dist < minDist) { minDist = dist; nearest = bar; }
                });

                if (!nearest) { clearAll(); lastActiveDate = null; return; }
                const dateKey = nearest.getAttribute('data-date');
                if (dateKey !== lastActiveDate) {
                    clearAll();
                    lastActiveDate = dateKey;
                    highlightByDate(dateKey);
                }
            });

            svg.addEventListener('mouseleave', () => {
                clearAll();
                lastActiveDate = null;
            });
        }

        // Perf dist points → pie highlighting (single entry per point)
        const perfChart = container.querySelector('.perf-dist-chart');
        if (perfChart) {
            const points = Array.from(perfChart.querySelectorAll('.perf-dist-point'));
            if (points.length > 0) {
                let lastActivePoint = null;

                function highlightByPoint(point) {
                    const cls = point.getAttribute('data-class') || '';
                    const info = point.getAttribute('data-info') || '';
                    const parts = info.split(' \u2013 ');
                    const car = parts[0] || '';
                    const track = parts.length > 1 ? parts[1] : '';

                    if (cls) {
                        highlightSlices(classSlices, s => (s.getAttribute('data-label') || '').trim() === cls);
                        highlightLegend(classLegend, el => {
                            const lbl = ((el.querySelector('.pie-legend-label') || {}).textContent || '').trim();
                            return lbl === cls;
                        });
                        highlightBreakdownItems(bd => bd.getAttribute('data-class-label') === cls);
                    }
                    if (car) {
                        highlightSlices(carSlices, s => (s.getAttribute('data-label') || '').trim() === car);
                        highlightLegend(carLegend, el => {
                            const lbl = ((el.querySelector('.pie-legend-label') || {}).textContent || '').trim();
                            return lbl === car;
                        });
                    }
                    if (track) {
                        highlightSlices(trackSlices, s => (s.getAttribute('data-label') || '').trim() === track);
                        highlightLegend(trackLegend, el => {
                            const lbl = ((el.querySelector('.pie-legend-label') || {}).textContent || '').trim();
                            return lbl === track;
                        });
                    }

                    if (classChart) showSliceLabels(classChart, classSlices);
                    if (carChart) showSliceLabels(carChart, carSlices);
                    if (trackChart) showSliceLabels(trackChart, trackSlices);
                }

                perfChart.addEventListener('mousemove', (e) => {
                    const rect = perfChart.getBoundingClientRect();
                    const chartWidth = rect.width;
                    if (chartWidth === 0) return;
                    const mouseXPct = ((e.clientX - rect.left) / chartWidth) * 100;

                    let nearest = null;
                    let minDist = Infinity;
                    points.forEach(p => {
                        const leftPct = parseFloat(p.style.left);
                        const dist = Math.abs(leftPct - mouseXPct);
                        if (dist < minDist) { minDist = dist; nearest = p; }
                    });

                    const threshold = Math.max(2, 100 / points.length);
                    if (!nearest || minDist > threshold) {
                        clearAll();
                        lastActivePoint = null;
                        return;
                    }

                    if (nearest !== lastActivePoint) {
                        clearAll();
                        lastActivePoint = nearest;
                        highlightByPoint(nearest);
                    }
                });

                perfChart.addEventListener('mouseleave', () => {
                    clearAll();
                    lastActivePoint = null;
                });
            }
        }
    }

    return {
        wireCarClassChartInteraction,
        wirePieChartPerfHighlighting,
        wireEntriesDistCrossHighlighting,
        wireBreakdownChartInteraction,
        wireDistPerfToPieHighlighting,
        // Exported for testing
        showSliceLabels,
        clearSliceLabels,
        highlightSlices,
        highlightLegend,
        clearSlices,
        clearLegend
    };
})();

if (typeof window !== 'undefined') window.DriverProfileInteractions = DriverProfileInteractions;
if (typeof module !== 'undefined') module.exports = DriverProfileInteractions;
