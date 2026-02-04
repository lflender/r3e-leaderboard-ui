/**
 * Car Class ID to Name Mapping
 * Extracted from driver_index.json.gz production data
 * Maps R3E car class IDs to their display names for fast lookups
 * 
 * Total: 88 car classes
 */

window.CAR_CLASSES_DATA = {

    // ADAC GT Masters
    "2922": "ADAC GT Masters 2013",
    "3375": "ADAC GT Masters 2014",
    "4516": "ADAC GT Masters 2015",
    "7278": "ADAC GT Masters 2018",
    "7767": "ADAC GT Masters 2020",
    "11566": "ADAC GT Masters 2021",

    // Audi Cup
    "4680": "Audi Sport TT Cup 2015",
    "5726": "Audi Sport TT Cup 2016",
    "5234": "Audi TT RS cup",

    // BMW Cup
    "2378": "Procar",
    "6344": "BMW M235i Racing Cup",
    "10909": "BMW M2 Cup",
    
    // Crosslé
    "10899": "Crosslé 90F",
    "11844": "Crosslé 9S",

    // DTM
    "3499": "DTM 1992",
    "7075": "DTM 1995",
    "13264": "DTM 2002",
    "7167": "DTM 2003",
    "7168": "C-Klasse DTM 2005",
    "1921": "DTM 2013",
    "3086": "DTM 2014",
    "4260": "DTM 2015",
    "5262": "DTM 2016",
    "9205": "DTM 2020",
    "10396": "DTM 2021",
    "12196": "DTM 2023",
    "12770": "DTM 2024",
    "13136": "DTM 2025",

    // Formula
    "5383": "FR US Cup",
    "5824": "FR X-17 Cup",
    "10050": "FR X-22 Cup",
    "7214": "FR X-90 Cup",
    "4597": "FR2 Cup",
    "5652": "FR3 Cup",
    "253": "FRJ Cup",
    "4867": "Tatuus F4 Cup",
    
    // GT Classes
    "8248": "GT2",
    "8600": "GTE",
    "1713": "GTO Classics",
    "1687": "GTR 1",
    "1703": "GTR 3",
    "1704": "GTR 2",
    "5825": "GTR 4",
    
    // Touring cars
    "1706": "German Nationals",
    "10977": "Mazda MX-5 Cup",
    "1717": "Silhouette Series",
    "1710": "Super Touring",
    "8660": "Touring Cars Cup",
    "1922": "WTCC 2013",
    "3905": "WTCC 2014",
    "4517": "WTCC 2015",
    "6036": "WTCC 2016",
    "6309": "WTCC 2017",
    "7009": "WTCR 2018",
    "7844": "WTCR 2019",
    "9233": "WTCR 2020",
    "10344": "WTCR 2021",
    "11317": "WTCR 2022",
    
    // Prototypes
    "1714": "P1",
    "1923": "P2",
    "12003": "Mazda Dpi",
    "13129": "Hypercars",
    
    // Porsche
    "6648": "Cayman GT4 Trophy by Manthey-Racing",
    "11564": "Porsche 944 Turbo Cup",
    "7287": "Porsche 964 Cup",
    "6345": "Porsche 991.2 GT3 Cup",
    "12302": "Porsche 992 GT3 Cup",
    "7982": "Porsche Carrera Cup Deutschland 2019",
    "12015": "Porsche Carrera Cup Deutschland 2023",
    "12969": "Porsche Carrera Cup North America 2024",
    "8165": "Porsche Carrera Cup Scandinavia",
    
    // Race cars
    "255": "Aquila CR1 Cup",
    "11990": "KTM GTX",
    "5385": "KTM X-Bow RR Cup",
    "11055": "Praga R1",
    "7110": "Zonda R Cup",

    // Various
    "1711": "Drift",
    "1685": "Hillclimb Icons",
    "4813": "NSU TTS Cup",
    "9989": "Truck Racing",
    
    // Electric
    "7765": "Volkswagen ID. R",
    "8682": "CUPRA Leon e-Racer",
    "10266": "Ford Mustang Mach E",
    
    // Historic
    "8483": "Group 2",
    "7304": "Group 4",
    "1708": "Group 5",
    "4121": "Group C",
    "1712": "Touring Classics"
};

// Build reverse lookup (name -> ID) once at load time
window.CAR_CLASSES_NAME_TO_ID = {};
(function() {
    for (const [id, name] of Object.entries(window.CAR_CLASSES_DATA)) {
        const key = String(name).trim().toLowerCase();
        window.CAR_CLASSES_NAME_TO_ID[key] = id;
    }
})();

/**
 * Get car class name by ID (synchronous, fast lookup)
 * @param {string|number} classId - The car class ID
 * @returns {string} The car class name or the ID if not found
 */
window.getCarClassName = function(classId) {
    if (!classId) return '';
    const id = String(classId);
    return window.CAR_CLASSES_DATA[id] || id;
};

/**
 * Get car class ID by name (synchronous, fast lookup)
 * @param {string} className - The car class name
 * @returns {string|null} The car class ID or null if not found
 */
window.getCarClassId = function(className) {
    if (!className) return null;
    const key = String(className).trim().toLowerCase();
    return window.CAR_CLASSES_NAME_TO_ID[key] || null;
};
