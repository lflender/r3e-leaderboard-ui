// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const trackParam = urlParams.get('track');
const classParam = urlParams.get('class');
const posParam = parseInt(urlParams.get('pos') || '');

// Ensure the pos param is applied only once (so pagination can be changed afterwards)
let posApplied = false;

// Pagination state
let currentPage = 1;
let itemsPerPage = 100;
let allResults = [];

// Fetch and display data
fetchLeaderboardDetails();

async function fetchLeaderboardDetails() {
    const resultsContainer = document.getElementById('detail-results-container');
    resultsContainer.innerHTML = '<div class="loading">Loading...</div>';
    
    try {
        // Construct local file path: cache/track_{trackId}/class_{classId}.json.gz
        const filePath = `cache/track_${trackParam}/class_${classParam}.json.gz`;
        console.log('Loading leaderboard data from:', filePath);
        console.log('Track ID:', trackParam, 'Class ID:', classParam);
        
        // Add cache-busting
        const timestamp = new Date().getTime();
        const response = await fetch(`${filePath}?v=${timestamp}`, {
            cache: 'no-store'
        });
        
        console.log('Fetch response:', response.status, response.statusText);
        
        if (!response.ok) {
            throw new Error(`Failed to load data: ${response.status} ${response.statusText}. File path: ${filePath}`);
        }
        
        console.log('Response OK, decompressing...');
        
        // Check if DecompressionStream is available
        if (typeof DecompressionStream === 'undefined') {
            throw new Error('DecompressionStream is not supported in this browser. Please use a modern browser (Chrome 80+, Firefox 113+, Safari 16.4+)');
        }
        
        // Decompress the gzipped response
        const decompressedStream = response.body.pipeThrough(new DecompressionStream('gzip'));
        const decompressedResponse = new Response(decompressedStream);
        const text = await decompressedResponse.text();
        
        console.log('Decompressed text length:', text.length, 'characters');
        console.log('First 100 characters:', text.substring(0, 100));
        
        console.log('Parsing JSON...');
        const data = JSON.parse(text);
        
        console.log('Data type:', typeof data, 'Is array:', Array.isArray(data));
        console.log('Data keys:', Object.keys(data));
        console.log('Full data structure:', data);
        console.log('track_info:', data.track_info);
        
        // Check if track_info contains the leaderboard
        if (data.track_info && typeof data.track_info === 'object') {
            console.log('track_info keys:', Object.keys(data.track_info));
        }
        
        // Extract leaderboard entries from the data structure
        let leaderboardData = null;
        
        // First check common leaderboard keys
        const possibleKeys = ['leaderboard', 'entries', 'results', 'data', 'Leaderboard', 'Entries', 'Results'];
        for (const key of possibleKeys) {
            if (data[key] && Array.isArray(data[key])) {
                leaderboardData = data[key];
                console.log(`Found leaderboard in data.${key}:`, leaderboardData.length, 'entries');
                break;
            }
        }
        
        // If not found, check inside track_info
        if (!leaderboardData && data.track_info) {
            for (const key of possibleKeys) {
                if (data.track_info[key] && Array.isArray(data.track_info[key])) {
                    leaderboardData = data.track_info[key];
                    console.log(`Found leaderboard in track_info.${key}:`, leaderboardData.length, 'entries');
                    break;
                }
            }
        }
        
        // If still not found, search all keys for any array
        if (!leaderboardData) {
            for (const key of Object.keys(data)) {
                if (Array.isArray(data[key]) && data[key].length > 0) {
                    leaderboardData = data[key];
                    console.log(`Found array in data.${key}:`, leaderboardData.length, 'entries');
                    break;
                }
            }
        }
        
        // Last resort: check nested objects
        if (!leaderboardData) {
            for (const key of Object.keys(data)) {
                if (data[key] && typeof data[key] === 'object' && !Array.isArray(data[key])) {
                    for (const nestedKey of Object.keys(data[key])) {
                        if (Array.isArray(data[key][nestedKey]) && data[key][nestedKey].length > 0) {
                            leaderboardData = data[key][nestedKey];
                            console.log(`Found array in data.${key}.${nestedKey}:`, leaderboardData.length, 'entries');
                            break;
                        }
                    }
                    if (leaderboardData) break;
                }
            }
        }
        
        if (!leaderboardData || !Array.isArray(leaderboardData)) {
            console.error('Could not find leaderboard array in data structure');
            throw new Error('Leaderboard data not found in the expected format');
        }
        
        console.log('Using leaderboard data with', leaderboardData.length, 'entries');
        console.log('First entry sample:', leaderboardData[0]);
        console.log('car_class structure:', leaderboardData[0]?.car_class);
        
        // Transform the data to match expected format
        // The data structure is: { car_class: { car: {Name: "..."}, class: {Name: "..."} }, driver: {Name: "..."}, ... }
        const totalEntries = leaderboardData.length;
        // Compute a default class name from track_info or the first entry to use as fallback
        const defaultClassName = data.track_info?.ClassName || data.track_info?.class_name || null;
        const firstClassName = leaderboardData[0]?.car_class?.class?.Name || leaderboardData[0]?.car_class?.class?.name || null;
        const transformedData = leaderboardData.map((entry, index) => {
            let carClass = entry.car_class?.class?.Name || entry.car_class?.class?.name || entry.car_class?.Name || entry.car_class?.name || entry.CarClass || '';
            if (!carClass) carClass = firstClassName || defaultClassName || '';
            const carName = entry.car_class?.car?.Name || entry.car_class?.car?.name || entry.vehicle?.Name || entry.vehicle?.name || entry.car?.Name || entry.car?.name || entry.Car || '';
            
            return {
                Position: entry.class_position !== undefined ? entry.class_position + 1 : (entry.index !== undefined ? entry.index + 1 : index + 1),
                Name: entry.driver?.Name || entry.driver?.name || entry.Name || 'Unknown',
                Country: entry.country?.Name || entry.country?.name || entry.Country || '',
                CarClass: carClass,
                Car: carName,
                LapTime: entry.laptime || entry.lap_time || entry.LapTime || entry.time || '',
                Rank: entry.rank?.Name || entry.rank?.name || entry.Rank || '',
                Team: entry.team?.Name || entry.team?.name || entry.Team || '',
                Difficulty: entry.driving_model || entry.difficulty || entry.Difficulty || '',
                Track: data.track_info?.Name || data.track_name || '',
                TotalEntries: totalEntries
            };
        });
        
        console.log('Transformed data sample:', transformedData[0]);
        
        // Pass the full data object to setDetailTitles so it can access track_info
        setDetailTitles(data, trackParam, classParam);
        allResults = transformedData;
        currentPage = 1;
        displayResults(transformedData);
    } catch (error) {
        console.error('Error loading leaderboard:', error);
        console.error('Error stack:', error.stack);
        displayError(error.message);
    }
}

// Try to get track and class names from the first result if available
function setDetailTitles(data, trackParam, classParam) {
    let trackName = trackParam || '';
    let layoutName = '';
    let carClassName = '';
    
    // First, try to get info from track_info if it exists
    if (data.track_info && typeof data.track_info === 'object') {
        const trackInfo = data.track_info;
        const fullTrack = trackInfo.Name || trackInfo.name || trackInfo.Track || trackInfo.track || '';
        if (fullTrack) {
            // Split on dash (hyphen, en dash, em dash)
            const match = fullTrack.match(/^(.*?)(?:\s*[-–—]\s*)(.+)$/);
            if (match) {
                trackName = match[1].trim();
                layoutName = match[2].trim();
            } else {
                trackName = fullTrack;
            }
        }
        carClassName = trackInfo.ClassName || trackInfo.class_name || trackInfo.CarClass || trackInfo.car_class || '';
    }
    
    // If not found in track_info, try to extract from results array
    if (!trackName || trackName === trackParam || !carClassName) {
        let results = data;
        if (data && typeof data === 'object' && !Array.isArray(data)) {
            if (data.results) results = data.results;
            else if (data.data) results = data.data;
            else if (data.items) results = data.items;
            else if (data.leaderboard) results = data.leaderboard;
            else if (data.entries) results = data.entries;
            else if (data.track_info && Array.isArray(data.track_info.Data)) results = data.track_info.Data;
        }
        
        if (Array.isArray(results) && results.length > 0) {
            const first = results[0];
            const fullTrack = first.Track || first.track || trackName;
            if (fullTrack && typeof fullTrack === 'string') {
                // Split on dash (hyphen, en dash, em dash)
                const match = fullTrack.match(/^(.*?)(?:\s*[-–—]\s*)(.+)$/);
                if (match) {
                    trackName = match[1].trim();
                    layoutName = match[2].trim();
                } else {
                    trackName = fullTrack;
                }
            }
            if (!carClassName) {
                carClassName = first?.car_class?.class?.Name || first?.car_class?.class?.name || first.CarClass || first['Car Class'] || first.car_class || first.Class || '';
            }
        }
    }
    // As final fallback, use classParam if still missing
    if (!carClassName) carClassName = classParam || '';
    
    document.getElementById('detail-track').innerHTML = `<span class="detail-label">Track:</span> ${escapeHtml(trackName)}`;
    if (layoutName) {
        let layoutElem = document.getElementById('detail-layout');
        if (!layoutElem) {
            layoutElem = document.createElement('div');
            layoutElem.id = 'detail-layout';
            document.getElementById('detail-track').after(layoutElem);
        }
        layoutElem.innerHTML = `<span class="detail-label">Layout:</span> ${escapeHtml(layoutName)}`;
    } else {
        let layoutElem = document.getElementById('detail-layout');
        if (layoutElem) layoutElem.remove();
    }
    document.getElementById('detail-class').innerHTML = `<span class="detail-label">Class:</span> ${escapeHtml(carClassName)}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function displayResults(data) {
    const resultsContainer = document.getElementById('detail-results-container');
    
    // Handle different response formats
    let results = data;
    
    if (data && typeof data === 'object' && !Array.isArray(data)) {
        if (data.results) results = data.results;
        else if (data.data) results = data.data;
        else if (data.items) results = data.items;
        else if (data.leaderboard) results = data.leaderboard;
        else if (data.entries) results = data.entries;
        else results = [data];
    }
    // Sort by numeric position ascending if possible
    results = results.slice(); // copy
    results.sort((a, b) => {
        const posA = parseInt(a.Position || a.position || a.Pos || 0);
        const posB = parseInt(b.Position || b.position || b.Pos || 0);
        return posA - posB;
    });
    
    if (!Array.isArray(results) || results.length === 0) {
        resultsContainer.innerHTML = '<div class="no-results">No results found</div>';
        return;
    }
    
    // Calculate pagination
    const totalResults = results.length;
    const totalPages = Math.ceil(totalResults / itemsPerPage);

    // If a posParam was passed, compute the page and set currentPage accordingly (only once)
    if (!posApplied && posParam && !Number.isNaN(posParam)) {
        const targetIndex = Math.max(0, posParam - 1);
        const targetPage = Math.floor(targetIndex / itemsPerPage) + 1;
        currentPage = Math.min(Math.max(1, targetPage), totalPages);
        posApplied = true;
    }

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalResults);
    const paginatedResults = results.slice(startIndex, endIndex);
    
    console.log(`Showing ${startIndex + 1}-${endIndex} of ${totalResults}`);
    
    // Create table
    let tableHTML = '<table class="results-table"><thead><tr>';
    
    // Headers for detail view (title shows Track and Class) - DO NOT ADD MORE COLUMNS
    const headers = ['Position', 'Driver Name', 'Lap Time', 'Car', 'Difficulty'];
    headers.forEach(header => {
        tableHTML += `<th>${header}</th>`;
    });
    
    tableHTML += '</tr></thead><tbody>';
    
    // Create rows
    paginatedResults.forEach(item => {
        const rowTrackId = item.track_id || item.TrackID || item['Track ID'] || trackParam || '';
        const rowClassId = item.class_id || item.ClassID || item['Class ID'] || item.CarClass || item['Car Class'] || classParam || '';
        tableHTML += `<tr data-trackid="${escapeHtml(String(rowTrackId))}" data-classid="${escapeHtml(String(rowClassId))}">`;
        
        // Position
        const position = item.Position || item.position || item.Pos || '-';
        const totalEntries = item.TotalEntries || item['Total Entries'] || item.total_entries || item.TotalRacers || item.total_racers;
        const posNum = String(position || '').trim();
        const totalNum = totalEntries ? String(totalEntries).trim() : '';
        // Compute color: green for 1, red for last, gradient in between
        let badgeColor = '';
        let pos = parseInt(posNum);
        let total = parseInt(totalNum);
        if (!isNaN(pos) && !isNaN(total) && total > 1) {
            if (pos === 1) {
                badgeColor = '#22c55e'; // bright green
            } else if (pos === total) {
                badgeColor = '#ef4444'; // bright red
            } else {
                // Interpolate between green and red
                // 0 = green, 1 = red
                let t = (pos - 1) / (total - 1);
                // Green: 34,197,94  Red: 239,68,68
                let r = Math.round(34 + (239-34)*t);
                let g = Math.round(197 + (68-197)*t);
                let b = Math.round(94 + (68-94)*t);
                badgeColor = `rgb(${r},${g},${b})`;
            }
        } else {
            badgeColor = 'rgba(59,130,246,0.18)'; // fallback
        }
        if (totalNum) {
            tableHTML += `<td class="pos-cell"><span class="pos-number" style="background:${badgeColor}">${escapeHtml(posNum)}</span><span class="pos-sep">/</span><span class="pos-total">${escapeHtml(totalNum)}</span></td>`;
        } else {
            tableHTML += `<td class="pos-cell"><span class="pos-number" style="background:${badgeColor}">${escapeHtml(posNum)}</span></td>`;
        }
        
        // Driver Name — if the row is not highlisted, make the name a link to main Leaderboards page with driver search
        const name = item.Name || item.name || item.DriverName || item.driver_name || '-';
        // Determine highlisted flag from possible fields (backend may use different names)
        const highlisted = item.highlisted || item.Highlisted || item.highList || item.high_list || item.is_highlisted || item.isHighlisted || item.high_list_flag || false;
        if (!highlisted) {
            const encoded = encodeURIComponent(String(name));
            tableHTML += `<td><a class="detail-driver-link" href="index.html?driver=${encoded}">${escapeHtml(String(name))}</a></td>`;
        } else {
            tableHTML += `<td>${escapeHtml(String(name))}</td>`;
        }
        
        // Lap Time - show delta inline with gray styling
        const lapTime = item.LapTime || item['Lap Time'] || item.lap_time || item.Time || '-';
        const parts = String(lapTime).split(/,\s*/);
        const main = escapeHtml(parts[0] || '');
        const delta = escapeHtml(parts.slice(1).join(', '));
        if (delta) {
            tableHTML += `<td class="no-wrap">${main} <span class="time-delta-inline">${delta}</span></td>`;
        } else {
            tableHTML += `<td class="no-wrap">${main}</td>`;
        }
        
        // Car
        const car = item.Car || item.car || item.CarName || item.car_name || '-';
        tableHTML += `<td>${escapeHtml(String(car))}</td>`;
        
        // Difficulty
        const difficulty = item.Difficulty || item.difficulty || '-';
        tableHTML += `<td>${difficulty}</td>`;
        
        tableHTML += '</tr>';
    });
    
    tableHTML += '</tbody></table>';
    
    // Add pagination controls only if there's more than 1 page
    let paginationHTML = '';
    
    if (totalPages > 1) {
        paginationHTML = '<div class="pagination">';
        paginationHTML += `<div class="pagination-info">Showing ${startIndex + 1}-${endIndex} of ${totalResults} results</div>`;
        paginationHTML += '<div class="pagination-buttons">';
        
        // Previous button
        if (currentPage > 1) {
            paginationHTML += `<button onclick="goToPage(${currentPage - 1})" class="page-btn">‹ Previous</button>`;
        }
        
        // Page numbers
        const maxPagesToShow = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
        let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
        
        if (endPage - startPage < maxPagesToShow - 1) {
            startPage = Math.max(1, endPage - maxPagesToShow + 1);
        }
        
        if (startPage > 1) {
            paginationHTML += `<button onclick="goToPage(1)" class="page-btn">1</button>`;
            if (startPage > 2) {
                paginationHTML += '<span class="page-ellipsis">...</span>';
            }
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const activeClass = i === currentPage ? 'active' : '';
            paginationHTML += `<button onclick="goToPage(${i})" class="page-btn ${activeClass}">${i}</button>`;
        }
        
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                paginationHTML += '<span class="page-ellipsis">...</span>';
            }
            paginationHTML += `<button onclick="goToPage(${totalPages})" class="page-btn">${totalPages}</button>`;
        }
        
        // Next button
        if (currentPage < totalPages) {
            paginationHTML += `<button onclick="goToPage(${currentPage + 1})" class="page-btn">Next ›</button>`;
        }
        
        paginationHTML += '</div></div>';
    }
    
    // Render pagination both above and below the table for easier navigation
    resultsContainer.innerHTML = paginationHTML + tableHTML + paginationHTML;

    // If a posParam was provided, highlight the matching row in the current page
    if (posParam && !Number.isNaN(posParam)) {
        // Run after a tiny delay so the DOM is settled
        setTimeout(() => {
            const rows = document.querySelectorAll('#detail-results-container table.results-table tbody tr');
            rows.forEach(r => r.classList.remove('highlight-row'));
            for (const r of rows) {
                const td = r.querySelector('td');
                if (!td) continue;
                const posText = td.textContent || '';
                const num = parseInt((posText.match(/\d+/) || [''])[0]);
                if (num === posParam) {
                    r.classList.add('highlight-row');
                    // Make the highlighted row clickable: open external leaderboard with track and class
                    const trackId = r.dataset.trackid || trackParam || '';
                    const classId = r.dataset.classid || classParam || '';
                    if (trackId) {
                        const openExternal = () => {
                            const carClass = classId ? `class-${classId}` : '';
                            let url = `https://game.raceroom.com/leaderboard/?track=${encodeURIComponent(trackId)}`;
                            if (carClass) url += `&car_class=${encodeURIComponent(carClass)}`;
                            window.open(url, '_blank');
                        };
                        r.style.cursor = 'pointer';
                        if (!r.dataset.externalClickAdded) {
                            r.addEventListener('click', openExternal);
                            r.dataset.externalClickAdded = '1';
                        }
                    }
                    r.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    break;
                }
            }
        }, 50);
    }
}

function displayError(message) {
    const resultsContainer = document.getElementById('detail-results-container');
    resultsContainer.innerHTML = `
        <div class="error">
            <strong>Error:</strong> ${message}
            <br><br>
            <small>Make sure the backend server is running on http://localhost:8080</small>
        </div>
    `;
}

function goToPage(page) {
    currentPage = page;
    displayResults(allResults);
    // Scroll to top of results
    document.getElementById('detail-results-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
