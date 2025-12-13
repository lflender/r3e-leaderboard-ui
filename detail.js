// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const trackParam = urlParams.get('track');
const classParam = urlParams.get('class');

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
    let carClassName = classParam || '';
    if (Array.isArray(results) && results.length > 0) {
        const first = results[0];
        trackName = first.Track || first.track || trackName;
        carClassName = first.CarClass || first['Car Class'] || first.car_class || first.Class || carClassName;
    }
    document.getElementById('detail-track').textContent = `Track: ${trackName}`;
    document.getElementById('detail-class').textContent = `Class: ${carClassName}`;
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
        const positionDisplay = totalEntries ? `${position} / ${totalEntries}` : position;
        tableHTML += `<td>${positionDisplay}</td>`;
        
        // Driver Name
        const name = item.Name || item.name || item.DriverName || item.driver_name || '-';
        tableHTML += `<td>${name}</td>`;
        
        // Lap Time
        const lapTime = item.LapTime || item['Lap Time'] || item.lap_time || item.Time || '-';
        tableHTML += `<td>${lapTime}</td>`;
        
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
