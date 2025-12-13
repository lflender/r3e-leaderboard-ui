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
        // Construct API URL - adjust this to match your backend endpoint
        const url = `http://localhost:8080/api/leaderboard?track=${encodeURIComponent(trackParam)}&class=${encodeURIComponent(classParam)}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        setDetailTitles(data, trackParam, classParam);
        allResults = data;
        currentPage = 1;
        displayResults(data);
    } catch (error) {
        displayError(error.message);
    }
}

// Try to get track and class names from the first result if available
function setDetailTitles(data, trackParam, classParam) {
    let results = data;
    if (data && typeof data === 'object' && !Array.isArray(data)) {
        if (data.results) results = data.results;
        else if (data.data) results = data.data;
        else if (data.items) results = data.items;
        else if (data.leaderboard) results = data.leaderboard;
        else if (data.entries) results = data.entries;
        else results = [data];
    }
    let trackName = trackParam || '';
    let layoutName = '';
    let carClassName = classParam || '';
    if (Array.isArray(results) && results.length > 0) {
        const first = results[0];
        let fullTrack = first.Track || first.track || trackName;
        // Split on dash (hyphen, en dash, em dash)
        let match = fullTrack.match(/^(.*?)(?:\s*[-–—]\s*)(.+)$/);
        if (match) {
            trackName = match[1].trim();
            layoutName = match[2].trim();
        } else {
            trackName = fullTrack;
        }
        carClassName = first.CarClass || first['Car Class'] || first.car_class || first.Class || carClassName;
    }
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
    
    // Headers for detail view
    const headers = ['Position', 'Driver Name', 'Lap Time', 'Car', 'Difficulty'];
    headers.forEach(header => {
        tableHTML += `<th>${header}</th>`;
    });
    
    tableHTML += '</tr></thead><tbody>';
    
    // Create rows
    paginatedResults.forEach(item => {
        tableHTML += '<tr>';
        
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
        
        // Driver Name
        const name = item.Name || item.name || item.DriverName || item.driver_name || '-';
        tableHTML += `<td>${name}</td>`;
        
        // Lap Time - show delta inline but keep it on one line
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
        tableHTML += `<td>${car}</td>`;
        
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
    
    resultsContainer.innerHTML = tableHTML + paginationHTML;

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
