// Tab switching functionality
const tabButtons = document.querySelectorAll('.tab-button');
const tabPanels = document.querySelectorAll('.tab-panel');

tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        const targetTab = button.dataset.tab;
        
        // Remove active class from all buttons and panels
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabPanels.forEach(panel => panel.classList.remove('active'));
        
        // Add active class to clicked button and corresponding panel
        button.classList.add('active');
        document.getElementById(targetTab).classList.add('active');
    });
});

// Driver search functionality
const driverSearch = document.getElementById('driver-search');
const resultsContainer = document.getElementById('results-container');

driverSearch.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
        const searchTerm = driverSearch.value.trim();
        
        if (!searchTerm) {
            return;
        }
        
        await searchDriver(searchTerm);
    }
});

async function searchDriver(driverName) {
    // Show loading state
    resultsContainer.innerHTML = '<div class="loading">Searching...</div>';
    
    try {
        const url = `http://localhost:8080/api/search?driver=${encodeURIComponent(driverName)}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Received data:', data);
        displayResults(data);
    } catch (error) {
        console.error('Search error:', error);
        displayError(error.message);
    }
}

function displayResults(data) {
    console.log('Data type:', typeof data);
    console.log('Is array:', Array.isArray(data));
    
    // Handle different response formats
    let results = data;
    
    // If data is an object with a results/data/items property, extract it
    if (data && typeof data === 'object' && !Array.isArray(data)) {
        console.log('Data keys:', Object.keys(data));
        
        if (data.results) results = data.results;
        else if (data.data) results = data.data;
        else if (data.items) results = data.items;
        else if (data.leaderboard) results = data.leaderboard;
        else if (data.entries) results = data.entries;
        else {
            // If it's a single object with properties, wrap it in an array
            results = [data];
        }
    }
    
    console.log('Results after processing:', results);
    console.log('Results is array:', Array.isArray(results));
    
    // Ensure results is an array
    if (!Array.isArray(results)) {
        displayError('Invalid response format. Expected an array of results.');
        console.error('Results is not an array:', results);
        return;
    }
    
    if (results.length === 0) {
        resultsContainer.innerHTML = '<div class="no-results">No results found</div>';
        return;
    }
    
    // Get all keys from the first object to create table headers
    let keys = Object.keys(results[0]);
    console.log('Original keys:', keys);
    
    // Filter out unwanted columns and handle Position/Total entries merge
    const excludeColumns = ['ClassID', 'ClassName', 'TrackID', 'TotalEntries', 'Class ID', 'Class Name', 'Track ID', 'Total Entries', 
                           'class_id', 'class_name', 'track_id', 'total_entries'];
    keys = keys.filter(key => !excludeColumns.includes(key));
    console.log('Filtered keys:', keys);
    
    // Custom column order: Car Class, Car, Track, Lap time, Position, Name, Country, Rank, Team
    const columnOrder = ['CarClass', 'Car Class', 'car_class', 'Class', 
                        'Car', 'car', 'CarName', 
                        'Track', 'track', 'TrackName', 'track_name',
                        'LapTime', 'Lap Time', 'lap_time', 'Time',
                        'Position', 'position', 'Pos',
                        'Name', 'name', 'DriverName', 'driver_name',
                        'Country', 'country',
                        'Rank', 'rank',
                        'Team', 'team'];
    
    keys.sort((a, b) => {
        let indexA = columnOrder.indexOf(a);
        let indexB = columnOrder.indexOf(b);
        
        // If not in the order list, put at the end
        if (indexA === -1) indexA = 999;
        if (indexB === -1) indexB = 999;
        
        return indexA - indexB;
    });
    
    console.log('Sorted keys:', keys);
    
    let tableHTML = '<table class="results-table"><thead><tr>';
    
    // Create headers
    keys.forEach(key => {
        tableHTML += `<th>${formatHeader(key)}</th>`;
    });
    
    tableHTML += '</tr></thead><tbody>';
    
    // Create rows
    results.forEach(item => {
        tableHTML += '<tr>';
        keys.forEach(key => {
            let value = item[key];
            
            // Special handling for Position column - merge with TotalEntries
            const isPositionKey = key === 'Position' || key === 'position' || key === 'Pos';
            if (isPositionKey) {
                const totalEntries = item.TotalEntries || item['Total Entries'] || item.total_entries || item.TotalRacers || item.total_racers;
                if (totalEntries) {
                    value = `${value} / ${totalEntries}`;
                    console.log(`Merged position: ${value}`);
                }
            }
            
            tableHTML += `<td>${formatValue(value)}</td>`;
        });
        tableHTML += '</tr>';
    });
    
    tableHTML += '</tbody></table>';
    resultsContainer.innerHTML = tableHTML;
}

function displayError(message) {
    resultsContainer.innerHTML = `
        <div class="error">
            <strong>Error:</strong> ${message}
            <br><br>
            <small>Make sure the backend server is running on http://localhost:8080</small>
        </div>
    `;
}

function formatHeader(key) {
    // Convert camelCase or snake_case to Title Case
    return key
        .replace(/([A-Z])/g, ' $1')
        .replace(/_/g, ' ')
        .replace(/^./, str => str.toUpperCase())
        .trim();
}

function formatValue(value) {
    if (value === null || value === undefined) {
        return '-';
    }
    return value;
}
