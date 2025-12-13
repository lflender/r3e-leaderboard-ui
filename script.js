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
    
    // Group results by driver name
    const groupedByDriver = {};
    results.forEach(item => {
        const driverName = item.Name || item.name || item.DriverName || item.driver_name || 'Unknown';
        if (!groupedByDriver[driverName]) {
            groupedByDriver[driverName] = [];
        }
        groupedByDriver[driverName].push(item);
    });
    
    // Sort each group by time difference (the +XX.XXXs part)
    Object.keys(groupedByDriver).forEach(driverName => {
        groupedByDriver[driverName].sort((a, b) => {
            const timeA = a.LapTime || a['Lap Time'] || a.lap_time || a.Time || '';
            const timeB = b.LapTime || b['Lap Time'] || b.lap_time || b.Time || '';
            
            // Extract time difference (e.g., "+01.887s" from "1m 23.414s, +01.887s")
            const diffA = timeA.match(/\+(\d+\.\d+)s/);
            const diffB = timeB.match(/\+(\d+\.\d+)s/);
            
            if (diffA && diffB) {
                return parseFloat(diffA[1]) - parseFloat(diffB[1]);
            }
            
            // Fallback to string comparison if no difference found
            return timeA.localeCompare(timeB);
        });
    });
    
    // Get all keys from the first object to create table headers
    let keys = Object.keys(results[0]);
    console.log('Original keys:', keys);
    
    // Filter out unwanted columns - now including Name, Country, Rank, Team (they'll be in group headers)
    const excludeColumns = ['ClassID', 'ClassName', 'TrackID', 'TotalEntries', 'Class ID', 'Class Name', 'Track ID', 'Total Entries', 
                           'class_id', 'class_name', 'track_id', 'total_entries',
                           'Name', 'name', 'DriverName', 'driver_name',
                           'Country', 'country',
                           'Rank', 'rank',
                           'Team', 'team'];
    keys = keys.filter(key => !excludeColumns.includes(key));
    console.log('Filtered keys:', keys);
    
    // Custom column order: Car Class, Car, Track, Lap time, Position
    const columnOrder = ['CarClass', 'Car Class', 'car_class', 'Class', 
                        'Car', 'car', 'CarName', 
                        'Track', 'track', 'TrackName', 'track_name',
                        'LapTime', 'Lap Time', 'lap_time', 'Time',
                        'Position', 'position', 'Pos'];
    
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
    
    // Create grouped rows with driver headers - sort driver names alphabetically
    const sortedDriverNames = Object.keys(groupedByDriver).sort((a, b) => a.localeCompare(b));
    
    sortedDriverNames.forEach(driverName => {
        const driverResults = groupedByDriver[driverName];
        const firstEntry = driverResults[0];
        
        // Get driver info from first entry
        const country = firstEntry.Country || firstEntry.country || '-';
        const rank = firstEntry.Rank || firstEntry.rank || '-';
        const team = firstEntry.Team || firstEntry.team || '-';
        
        // Create driver header row
        const groupId = `group-${driverName.replace(/\s+/g, '-')}`;
        tableHTML += `
            <tr class="driver-group-header" onclick="toggleGroup('${groupId}')">
                <td colspan="${keys.length}">
                    <span class="toggle-icon">▼</span>
                    <strong>${driverName}</strong>
                    <span class="driver-meta">🌍 ${country} | ⭐ Rank ${rank} | 🏁 Team ${team}</span>
                </td>
            </tr>`;
        
        // Create data rows for this driver
        driverResults.forEach(item => {
            tableHTML += `<tr class="driver-data-row ${groupId}">`;
            keys.forEach(key => {
                let value = item[key];
                
                // Special handling for Position column - merge with TotalEntries
                const isPositionKey = key === 'Position' || key === 'position' || key === 'Pos';
                if (isPositionKey) {
                    const totalEntries = item.TotalEntries || item['Total Entries'] || item.total_entries || item.TotalRacers || item.total_racers;
                    if (totalEntries) {
                        value = `${value} / ${totalEntries}`;
                    }
                }
                
                tableHTML += `<td>${formatValue(value)}</td>`;
            });
            tableHTML += '</tr>';
        });
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

function toggleGroup(groupId) {
    const rows = document.querySelectorAll(`.${groupId}`);
    const header = event.target.closest('.driver-group-header');
    const icon = header.querySelector('.toggle-icon');
    
    rows.forEach(row => {
        if (row.style.display === 'none') {
            row.style.display = '';
            icon.textContent = '▼';
        } else {
            row.style.display = 'none';
            icon.textContent = '▶';
        }
    });
}
