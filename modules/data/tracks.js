// Tracks list extracted from modules/pages/leaderboards.js for reuse
// Similar style to modules/data/cars.js
// Optional aliases are searchable in track filters without changing the displayed label.
window.TRACKS_DATA = [
  { id: 13352, label: 'Adria International Raceway 2003 - Full Circuit' },
  { id: 13425, label: 'Adria International Raceway 2021 - Full Circuit' },
  { id: 12938, label: 'Alemannenring - Full Circuit' },
  { id: 5301, label: 'Anderstorp Motorbana - Grand Prix' },
  { id: 6164, label: 'Anderstorp Motorbana - South' },
  { id: 7112, label: 'Autodrom Most - Grand Prix' },
  { id: 1671, label: 'Autodromo di Monza - Grand Prix' },
  { id: 1672, label: 'Autodromo di Monza - Junior' },
  { id: 2024, label: 'Autódromo Fernanda Pires da Silva - Grand Prix', aliases: ['Estoril'] },
  { id: 12318, label: 'Autódromo Fernanda Pires da Silva - Tanque', aliases: ['Estoril'] },
  { id: 1784, label: 'Autodromo Internacional do Algarve - Chicane', aliases: ['Portimao'] },
  { id: 1778, label: 'Autodromo Internacional do Algarve - Grand Prix', aliases: ['Portimao'] },
  { id: 1783, label: 'Autodromo Internacional do Algarve - Moto', aliases: ['Portimao'] },
  { id: 1785, label: 'Autodromo Internacional do Algarve - Short', aliases: ['Portimao'] },
  { id: 1850, label: 'Autodromo Internazionale Enzo e Dino Ferrari - Grand Prix', aliases: ['Imola'] },
  { id: 10463, label: 'Autódromo José Carlos Pace - Grand Prix', aliases: ['Interlagos'] },
  { id: 13339, label: 'Autodromo Vallelunga Piero Taruffi - Chicane' },
  { id: 13340, label: 'Autodromo Vallelunga Piero Taruffi - Classic' },
  { id: 13187, label: 'Autodromo Vallelunga Piero Taruffi - International' },
  { id: 13338, label: 'Autodromo Vallelunga Piero Taruffi - Short' },
  { id: 2064, label: 'Automotodróm Slovakia Ring - Grand Prix' },
  { id: 12500, label: 'AVUS - 1994' },
  { id: 12420, label: 'AVUS - 1998' },
  { id: 7819, label: 'Bilster Berg - Gesamtstrecke' },
  { id: 8069, label: 'Bilster Berg - Gesamtstrecke Schikane' },
  { id: 8070, label: 'Bilster Berg - Ostschleife' },
  { id: 8071, label: 'Bilster Berg - Ostschleife Schikane' },
  { id: 8095, label: 'Bilster Berg - Westschleife' },
  { id: 9473, label: 'Brands Hatch - Grand Prix' },
  { id: 2520, label: 'Brands Hatch - Indy' },
  { id: 4944, label: 'Chang International Circuit - D Circuit' },
  { id: 4253, label: 'Chang International Circuit - Full Circuit' },
  { id: 11908, label: 'Circuit de Charade - Classic Racing School' },
  { id: 10904, label: 'Circuit de Charade - Grand Prix' },
  { id: 11905, label: 'Circuit de Pau-Ville - Grand Prix' },
  { id: 13368, label: 'Circuit de Spa-Francorchamps - Classic' },
  { id: 13369, label: 'Circuit de Spa-Francorchamps - Combined' },
  { id: 13256, label: 'Circuit de Spa-Francorchamps - Grand Prix' },
  { id: 13467, label: 'Circuit de Spa-Francorchamps - Moto' },
  { id: 13428, label: 'Circuit de Spa-Francorchamps 1995 - Grand Prix' },
  { id: 13652, label: 'Circuit de Spa-Francorchamps 1995 - Endurance' },
  { id: 10392, label: 'Circuit Paul Armagnac - Caupenne Circuit', aliases: ['Nogaro'] },
  { id: 10258, label: 'Circuit Paul Armagnac - Club Circuit', aliases: ['Nogaro'] },
  { id: 9659, label: 'Circuit Paul Armagnac - Grand Prix Circuit', aliases: ['Nogaro'] },
  { id: 12573, label: 'Circuit Paul Armagnac - Moto Circuit', aliases: ['Nogaro'] },
  { id: 11909, label: 'Circuit Paul Ricard - Solution 1A' },
  { id: 4246, label: 'Circuit Paul Ricard - Solution 1A-V2' },
  { id: 4247, label: 'Circuit Paul Ricard - Solution 1C-V2' },
  { id: 4248, label: 'Circuit Paul Ricard - Solution 2A short' },
  { id: 2867, label: 'Circuit Paul Ricard - Solution 3C' },
  { id: 10782, label: 'Circuit Zandvoort - Grand Prix' },
  { id: 11090, label: 'Circuit Zandvoort - Short' },
  { id: 1679, label: 'Circuit Zandvoort 2019 - Club' },
  { id: 1678, label: 'Circuit Zandvoort 2019 - Grand Prix' },
  { id: 1680, label: 'Circuit Zandvoort 2019 - National' },
  { id: 1684, label: 'Circuit Zolder - Grand Prix' },
  { id: 5298, label: 'Creditas Autodrom Brno - Grand Prix' },
  { id: 9796, label: 'Creditas Autodrom Brno - Grand Prix (Short Pit Entry)' },
  { id: 8367, label: 'Daytona International Speedway - Road Course' },
  { id: 8655, label: 'Daytona International Speedway - Road Course Motorcycle (2006)' },
  { id: 8648, label: 'Daytona International Speedway - Speedway (Not Supported)' },
  { id: 9055, label: 'DEKRA Lausitzring - DTM Grand Prix Course' },
  { id: 2468, label: 'DEKRA Lausitzring - DTM Short Course' },
  { id: 10328, label: 'DEKRA Lausitzring - GP Course Oval T1' },
  { id: 6166, label: 'DEKRA Lausitzring - Grand Prix Course' },
  { id: 3291, label: 'DEKRA Lausitzring - Short Course' },
  { id: 10394, label: 'Donington Park - Grand Prix' },
  { id: 10725, label: 'Donington Park - National' },
  { id: 7976, label: 'Dubai Autodrome - Club Circuit' },
  { id: 6587, label: 'Dubai Autodrome - Grand Prix Circuit' },
  { id: 7978, label: 'Dubai Autodrome - International Circuit' },
  { id: 7977, label: 'Dubai Autodrome - National Circuit' },
  { id: 6140, label: 'Falkenberg Motorbana - Grand Prix' },
  { id: 12395, label: 'Fliegerhorst Diepholz - Full Circuit' },
  { id: 13432, label: 'Fliegerhorst Wunstorf - Full Circuit' },
  { id: 5925, label: 'Gelleråsen Arena - Grand Prix Circuit' },
  { id: 6138, label: 'Gelleråsen Arena - Short Circuit' },
  { id: 9360, label: 'Genting Highlands Highway - Circuit' },
  { id: 11859, label: 'Genting Highlands Highway - Dual Stage' },
  { id: 11861, label: 'Genting Highlands Highway - Short Stage' },
  { id: 9321, label: 'Genting Highlands Highway - Stage' },
  { id: 13632, label: 'Glasbachrennen - Full Run' },
  { id: 2123, label: 'Guia Circuit - Grand Prix', aliases: ['Macau'] },
  { id: 1693, label: 'Hockenheimring - Grand Prix' },
  { id: 1763, label: 'Hockenheimring - National' },
  { id: 1764, label: 'Hockenheimring - Short' },
  { id: 12112, label: 'Hockenheimring 2001 - Grand Prix' },
  { id: 12236, label: 'Hockenheimring 2001 - Short' },
  { id: 1866, label: 'Hungaroring - Grand Prix' },
  { id: 9957, label: 'Indianapolis Motor Speedway - Historic' },
  { id: 9958, label: 'Indianapolis Motor Speedway - Oval' },
  { id: 9943, label: 'Indianapolis Motor Speedway - Road Course' },
  { id: 1852, label: 'Indianapolis Motor Speedway 2012 - Grand Prix' },
  { id: 2014, label: 'Indianapolis Motor Speedway 2012 - Moto' },
  { id: 6137, label: 'Knutstorp Ring - GP' },
  { id: 1682, label: 'Lakeview Hillclimb - Full Run' },
  { id: 2181, label: 'Lakeview Hillclimb - Reverse' },
  { id: 6010, label: 'Mantorp Park - Long Circuit' },
  { id: 6167, label: 'Mantorp Park - Short Circuit' },
  { id: 1676, label: 'Mid Ohio Sports Car Course - Chicane' },
  { id: 1674, label: 'Mid Ohio Sports Car Course - Full' },
  { id: 1675, label: 'Mid Ohio Sports Car Course - Short' },
  { id: 3683, label: 'Moscow Raceway - FIM' },
  { id: 3383, label: 'Moscow Raceway - Full' },
  { id: 2473, label: 'Moscow Raceway - Sprint' },
  { id: 9043, label: 'Motorland Aragón - Fast Circuit' },
  { id: 8704, label: 'Motorland Aragón - Grand Prix' },
  { id: 9040, label: 'Motorland Aragón - Motorcycle Grand Prix' },
  { id: 9042, label: 'Motorland Aragón - Motorcycle National' },
  { id: 9041, label: 'Motorland Aragón - National' },
  { id: 9483, label: 'Motorland Aragón - WTCR' },
  { id: 12571, label: 'Motorsport Arena Oschersleben - Alternate' },
  { id: 12506, label: 'Motorsport Arena Oschersleben - Grand Prix' },
  { id: 12572, label: 'Motorsport Arena Oschersleben - Short' },
  { id: 1846, label: 'Mount Panorama Circuit - Mount Panorama', aliases: ['Bathurst'] },
  { id: 7273, label: 'Ningbo International Circuit - Full circuit' },
  { id: 8309, label: 'Ningbo International Circuit - Full circuit no chicane' },
  { id: 8310, label: 'Ningbo International Circuit - Intermediate circuit' },
  { id: 8311, label: 'Ningbo International Circuit - Intermediate circuit no chicane' },
  { id: 8314, label: 'Ningbo International Circuit - Short circuit' },
  { id: 2518, label: 'Norisring - Grand Prix' },
  { id: 1691, label: 'Nürburgring - Grand Prix' },
  { id: 2010, label: 'Nürburgring - Grand Prix Fast Chicane' },
  { id: 9847, label: 'Nürburgring - Müllenbachschleife' },
  { id: 3377, label: 'Nürburgring - Sprint' },
  { id: 2011, label: 'Nürburgring - Sprint Fast Chicane' },
  { id: 5095, label: 'Nürburgring Nordschleife - 24 Hours' },
  { id: 4975, label: 'Nürburgring Nordschleife - NLS' },
  { id: 2813, label: 'Nürburgring Nordschleife - Nordschleife' },
  { id: 5093, label: 'Nürburgring Nordschleife - Tourist' },
  { id: 1709, label: 'RaceRoom Hillclimb - Full Run' },
  { id: 2214, label: 'RaceRoom Hillclimb - Reverse' },
  { id: 266, label: 'RaceRoom Raceway - Bridge' },
  { id: 264, label: 'RaceRoom Raceway - Classic' },
  { id: 265, label: 'RaceRoom Raceway - Classic Sprint' },
  { id: 10414, label: 'RaceRoom Raceway - Drift Area' },
  { id: 263, label: 'RaceRoom Raceway - Grand Prix' },
  { id: 267, label: 'RaceRoom Raceway - National' },
  { id: 2556, label: 'Red Bull Ring Spielberg - Grand Prix Circuit' },
  { id: 11296, label: 'Red Bull Ring Spielberg - Moto' },
  { id: 5794, label: 'Red Bull Ring Spielberg - Südschleife National Circuit' },
  { id: 5276, label: 'Road America - Grand Prix' },
  { id: 3538, label: 'Sachsenring - Grand Prix' },
  { id: 2026, label: 'Salzburgring - Grand Prix' },
  { id: 6341, label: 'Sepang International Circuit - Grand Prix' },
  { id: 6578, label: 'Sepang International Circuit - North' },
  { id: 6579, label: 'Sepang International Circuit - South' },
  { id: 2027, label: 'Shanghai International Circuit - Grand Prix' },
  { id: 4041, label: 'Shanghai International Circuit - Intermediate (WTCC)' },
  { id: 4042, label: 'Shanghai International Circuit - West Long' },
  { id: 4039, label: 'Silverstone Circuit - Grand Prix' },
  { id: 5862, label: 'Silverstone Circuit - Historic Grand Prix' },
  { id: 5816, label: 'Silverstone Circuit - International' },
  { id: 5817, label: 'Silverstone Circuit - National' },
  { id: 12268, label: 'Silverstone Circuit 2001 - Grand Prix' },
  { id: 12390, label: 'Silverstone Circuit 2001 - International' },
  { id: 12389, label: 'Silverstone Circuit 2001 - National' },
  { id: 6055, label: 'Silverstone Stowe Circuit - Long' },
  { id: 6056, label: 'Silverstone Stowe Circuit - Short' },
  { id: 3913, label: 'Sonoma Raceway - IRL' },
  { id: 3912, label: 'Sonoma Raceway - Long' },
  { id: 2016, label: 'Sonoma Raceway - Sprint' },
  { id: 1854, label: 'Sonoma Raceway - WTCC' },
  { id: 2012, label: 'Suzuka International Racing Course - East Course' },
  { id: 1841, label: 'Suzuka International Racing Course - Grand Prix' },
  { id: 2013, label: 'Suzuka International Racing Course - West Course' },
  { id: 9985, label: 'TT Circuit Assen - Grand Prix' },
  { id: 10355, label: 'TT Circuit Assen - Motorcycle Course' },
  { id: 10351, label: 'TT Circuit Assen - North Course' },
  { id: 9839, label: 'Twin Forest - Duel' },
  { id: 7027, label: 'Twin Ring Motegi - East Course' },
  { id: 6658, label: 'Twin Ring Motegi - Road Course' },
  { id: 7026, label: 'Twin Ring Motegi - West Course' },
  { id: 9465, label: 'Vålerbanen - Full Circuit' },
  { id: 9344, label: 'Watkins Glen International - Grand Prix' },
  { id: 9324, label: 'Watkins Glen International - Grand Prix with Inner Loop' },
  { id: 9343, label: 'Watkins Glen International - Short Circuit' },
  { id: 9177, label: 'Watkins Glen International - Short with Inner loop' },
  { id: 1856, label: 'WeatherTech Raceway Laguna Seca - Grand Prix' },
  { id: 13533, label: 'WeatherTech Raceway Laguna Seca 1987 - Grand Prix' },
  { id: 8327, label: 'Zhejiang International Circuit - East circuit' },
  { id: 8075, label: 'Zhejiang International Circuit - Grand Prix' },
  { id: 3464, label: 'Zhuhai International Circuit - Grand Prix' }
];

// Track metadata shared by the listed layout IDs.
// url: RaceRoom store page for the track.
// description: Official description from the store page.
// Other fields reflect the store's displayed track details, when available.
window.TRACKS_META = Object.fromEntries([
  [[13352], {
    url: 'https://game.raceroomracing.com/store/tracks/adria-international-raceway/2003/13350',
    location: "Adria, Italy",
    trackType: "Permanent Circuit",
    opened: "2002–2020",
    racedHere: "World Sportscar Championship, DTM, Porsche Carrera Cup Deutschland, FIA GT Championship and 4 more",
    description: "Adria Raceway is a compact and technical circuit designed for close, high-intensity racing. The 2003 layout, as raced in DTM, emphasizes precision, braking control, and strong traction on corner exit. With its tight sequence of corners and short straights, Adria leaves little room for error and rewards drivers who can maintain rhythm under pressure. Passing opportunities are created through late braking and positioning rather than outright speed, making it a perfect venue for touring cars and competitive sprint racing. A demanding track where consistency and control are key, Adria 2003 delivers intense wheel-to-wheel action from start to finish."
  }],
  [[13425], {
    url: 'https://game.raceroomracing.com/store/tracks/adria-international-raceway/2021/13424',
    location: "Adria, Italy",
    trackType: "Permanent Circuit",
    opened: "2021",
    racedHere: "FIA European Truck Racing Championship, WTCR, Italian GT Championship",
    description: "Adria Raceway in its 2021 configuration offers a reworked interpretation of this compact Italian circuit, featuring revised corner sequences, updated surfaces, and expanded safety zones. Raced in the FIA WTCR, this layout adds numerous hairpins and has a fun last sector feeling close to street racing. The track challenges drivers with a mix of medium-speed corners, tight chicanes, and precise braking zones, rewarding smooth inputs and clean racing lines. Rarely represented in sim racing, Adria 2021 provides a distinctive driving experience that combines technical knowledge with rhythm."
  }],
  [[12500, 12420], {
    url: 'https://game.raceroomracing.com/store/tracks/avus/avus/12419',
    location: "Berlin, Germany",
    trackType: "Street Circuit · historic",
    opened: "1994–1998",
    description: "Experience the sheer speed and historical significance of AVUS, one of the most iconic circuits in motorsport history. Located in Berlin, AVUS is famous for its long straights and banked turns, where top speeds were pushed to the limits. The 1994 layout captures the track’s classic essence, while the 1998 layout showcases the evolution of this high-speed venue. Both versions offer a unique challenge, requiring precision and bravery as you navigate the fast straights and tight corners. Step back in time and feel the thrill of racing on a track that epitomizes the raw power and danger of motorsport's golden era."
  }],
  [[12938], {
    url: 'https://game.raceroomracing.com/store/tracks/alemannenring/alemannenring/12936',
    location: "Singen, Germany",
    trackType: "Street Circuit · historic",
    opened: "1991–1995",
    racedHere: "DTM, Porsche Carrera Cup Deutschland",
    description: "Once a staple on the German touring car calendar, the Alemannenring is a high-speed street circuit that winds through the heart of Singen, in the south of Germany. With long straights, heavy braking zones, and a unique rhythm of flowing corners, it provided the stage for some of the most dramatic races of the Super Touring era. Lovingly brought back to life in RaceRoom, this historic venue offers a challenging and atmospheric racing experience like no other."
  }],
  [[5301, 6164], {
    url: 'https://game.raceroomracing.com/store/tracks/anderstorp-motorbana/anderstorp-motorbana/5300',
    location: "Anderstorp, Sweden",
    trackType: "Permanent Circuit",
    opened: "1998",
    racedHere: "ETCC, STCC, FIA GT Championship, Porsche Carrera Cup Scandinavia and 2 more",
    description: "Anderstorp is a long standing marker in Swedish racing history, this is where the greats of Formula One battled in the glory days and where speed kings of Scandinavia were crowned for decades. The track combines a very long straight with cambered sweepers and tight hairpin turns. it demands a good setup of the car and precise lines from the driver to master. The tight final corner combination is always an invitation for last lap heroics, at Anderstorp your win is not certain until the very final meter."
  }],
  [[7112], {
    url: 'https://game.raceroomracing.com/store/tracks/autodrom-most/autodrom-most/7111',
    location: "Most, Czech Republic, Czechia",
    trackType: "Permanent Circuit",
    opened: "2005",
    racedHere: "Interserie, FIA European Truck Racing Championship, ADAC GT Masters, ADAC TCR Deutschland and 4 more",
    description: "This 4.2 km long circuit located in the northwest of the Czech Republic was built in 1983 and has since then regularly hosted many motorcycle, truck and car racing events. In 2018 it became part of the ADAC GT Masters calendar, proving to be an excellent motorsport venue and a real challenge for the drivers, with its high speed sections nicely embedded in the environment and a distinct lack of artificial run-off areas"
  }],
  [[1846], {
    url: 'https://game.raceroomracing.com/store/tracks/mount-panorama-circuit/mount-panorama-circuit/1845',
    location: "Bathurst, New South Wales, Australia",
    trackType: "Permanent Circuit",
    opened: "1987",
    racedHere: "Bathurst 1000, WTCC, Australian GT Championship, Bathurst 12 Hour and 2 more",
    description: "Bathurst is a motor racing track located in Bathurst, Australia. It is the home of the Bathurst 12 Hour motor race, held each February, and the Bathurst 1000 motor race, held each October. The track is 6.213 km long. When not used for racing this is a public road."
  }],
  [[7819, 8069, 8070, 8071, 8095], {
    url: 'https://game.raceroomracing.com/store/tracks/bilster-berg/bilster-berg/7818',
    location: "Nieheim, Germany",
    trackType: "Trackday",
    opened: "2013",
    description: "19 turns over 4.2 kilometers and an impressive amount of elevation changes of up to 26 percent, with no fewer than 44 crests and dips. These numbers are just a brief summary of the data that makes BILSTER BERG so special for any automobile enthusiast. Opened in 2013, this track is dedicated to tests and presentation events. It lies in the middle of the Teutoburger Forest in the beautiful North Rhine-Westphalia and is considered to be one of Europe's most demanding circuits among motorsport professionals."
  }],
  [[9473, 2520], {
    url: 'https://game.raceroomracing.com/store/tracks/brands-hatch-circuit/grand-prix/9472',
    location: "Fawkham, Kent, United Kingdom",
    trackType: "Permanent Circuit",
    opened: "2003",
    racedHere: "World Sportscar Championship, ETCC, DRM, BTCC and 7 more",
    description: "The iconic Grand Prix loop was added to Brands Hatch in 1960, doubling the length of the original Indy layout and adding an extra dimension to an already challenging circuit. Always a drivers’ favourite, its international renown was built on Formula 1 World Championship and World Sportscar thrillers. It’s high on every championship’s wishlist, and in more recent times has hosted DTM, World Touring Cars and pretty much every major GT series."
  }],
  [[5298, 9796], {
    url: 'https://game.raceroomracing.com/store/tracks/creditas-autodrom-brno/creditas-autodrom-brno/5297',
    location: "Brno, Czech Republic, Czechia",
    trackType: "Permanent Circuit",
    opened: "1987",
    racedHere: "ETCC, Porsche 944 Turbo Cup, WTCC, DTM and 9 more",
    description: "Brno Circuit in Czech Republic has a long history in motorsport. Originally made up of public roads it later was transformed into a permanent road course. Over the years it hosted many international racing series such as FIA GT, DTM, WTCC and MotoGP. The circuit is embedded beautifully in a forest environment and is characterized by challenging long-flowing corners and elevation changes."
  }],
  [[4944, 4253], {
    url: 'https://game.raceroomracing.com/store/tracks/chang-international-circuit/chang-international-circuit/4252',
    location: "Buriram, Thailand",
    trackType: "Permanent Circuit",
    opened: "2014",
    racedHere: "Super GT, Asian Le Mans Series, GT Asia Series, TCR and 2 more",
    description: "Buriram is the latest exciting race track to burst on to the busy Far East racing scene. Since opening its doors in 2014, this brand new FIA Grade 1 rated facility has already hosted many national and international series, such as the Japanese Super GT, Asian Le Mans Series as well as the WTCC. The 4.5 km long track features a good mix of interesting corner combinations and a long straight providing a good overtaking opportunity. It also provides a tropical jungle scenery in the horizon, not a thing you often see from a race car."
  }],
  [[11908, 10904], {
    url: 'https://game.raceroomracing.com/store/tracks/circuit-de-charade/circuit-de-charade/10903',
    location: "Saint-Gènes-Champanelle, France",
    trackType: "Permanent Circuit",
    opened: "1989",
    racedHere: "Classic Racing School",
    description: "The Circuit de Charade is a challenging and exciting racetrack located in the Auvergne region of central France. With its fast, sweeping turns and steep elevation changes, it offers a thrilling driving experience for both amateur and professional racers. The circuit features a mix of high-speed straights and technical sections, making it a true test of a driver's skill and courage. Surrounded by beautiful scenery, the track is a popular destination for racing enthusiasts from all over the world. Whether you're a seasoned pro or a beginner looking to push your limits, the Circuit de Charade is sure to provide an unforgettable driving experience."
  }],
  [[11905], {
    url: 'https://game.raceroomracing.com/store/tracks/circuit-de-pau-ville/circuit-de-pau-ville/11904',
    location: "Pau, France",
    trackType: "Street Circuit",
    opened: "1935",
    racedHere: "British GT Championship, WTCC, GT4 European Series, FFSA GT Championship and 3 more",
    description: "This street circuit, nestled in the heart of Pau in southwest France, offers a unique blend of history, challenge, and excitement. It features narrow streets lined with barriers, where precision is paramount and every millimeter counts. With its combination of high-speed straights and technical twists, the Circuit de Pau-Ville demands both skill and strategy, providing an exhilarating test for drivers of all levels. Whether you're a seasoned pro or a newcomer to the world of racing, this track promises an unforgettable experience."
  }],
  [[13368, 13369, 13256, 13467], {
    url: 'https://game.raceroomracing.com/store/tracks/circuit-de-spa-francorchamps/modern/13255',
    location: "Francorchamps, Belgium",
    trackType: "Permanent Circuit",
    opened: "2022",
    racedHere: "24H Series, British GT Championship, DTM, DTM Trophy and 17 more",
    description: "One of motorsport’s most iconic circuits, Spa-Francorchamps is defined by its high speed, dramatic elevation changes, and flowing layout. From the challenge of Eau Rouge and Raidillon to long straights and technical sectors, Spa rewards commitment, precision, and confidence in every corner."
  }],
  [[13428, 13652], {
    url: 'https://game.raceroomracing.com/store/tracks/circuit-de-spa-francorchamps/1995/13427',
    location: "Francorchamps, Belgium",
    trackType: "Permanent Circuit · historic",
    opened: "1995–2003",
    racedHere: "World Challenge for Endurance Drivers, DRM, World Sportscar Championship, ETCC and 7 more",
    description: "Spa-Francorchamps as it was raced from 1995 to 2003: 6.968 km, 19 turns and the original Bus Stop chicane. The Bus Stop was reprofiled in 2004, then moved towards Blanchimont in 2007 to make room for a new pit lane and a longer start-finish straight. This is the track before those changes. Eau Rouge, Raidillon, Pouhon and Blanchimont are where you know them, with just over 100 m of height difference around the lap. The change comes at the end of the lap: through Blanchimont, hard on the brakes for the old Bus Stop, then a short run past the old pits to La Source. Grand Prix and Endurance layouts are included, and the Endurance layout takes grids of up to 99 cars."
  }],
  [[10782, 11090], {
    url: 'https://game.raceroomracing.com/store/tracks/circuit-zandvoort/modern/10781',
    location: "Zandvoort, The Netherlands, Netherlands",
    trackType: "Permanent Circuit",
    opened: "2020",
    racedHere: "European GT Championship, ETCC, DRM, BMW M1 Procar Championship and 12 more",
    description: "Located near the sandy dunes of Zandvoort in the Netherlands this 4.2 km long track is a favorite of many drivers, due to its fast corners and undulating nature, making it quite a rollercoaster ride. The circuit was updated in 2020 to bring it up to modern standards, adding banking to turn 14 (Arie Luyendijkbocht) and turn 3 (Hugenholtzbocht), but the track retains its old-school feel and unique characteristics that make it so special."
  }],
  [[1679, 1678, 1680], {
    url: 'https://game.raceroomracing.com/store/tracks/circuit-zandvoort/2019/1677',
    location: "Zandvoort, The Netherlands, Netherlands",
    trackType: "Permanent Circuit",
    opened: "1999–2019",
    racedHere: "DRM, Porsche Carrera Cup Deutschland, STW, DTM and 13 more",
    description: "Circuit Zandvoort is an old school race track located in the Netherlands, directly in the dunes near the coast line. The 4.3 km long track offers fast and sweeping corners as well as tight hairpins that provide excellent overtaking opportunities. It’s a real challenge and the drivers love it."
  }],
  [[1684], {
    url: 'https://game.raceroomracing.com/store/tracks/circuit-zolder/circuit-zolder/1683',
    location: "Heusden-Zolder, Belgium",
    trackType: "Permanent Circuit",
    opened: "2002",
    racedHere: "DRM, ETCC, BMW M1 Procar Championship, Deutsche Rennsport Trophäe and 20 more",
    description: "Located in Belgium, this undulating and highly entertaining track has been the scene for high level motor racing since its opening in 1963. Fast flowing corners and well implemented chicanes provide ample overtaking opportunities."
  }],
  [[9055, 2468, 10328, 6166, 3291], {
    url: 'https://game.raceroomracing.com/store/tracks/dekra-lausitzring/dekra-lausitzring/2467',
    location: "Klettwitz, Germany",
    trackType: "Permanent Circuit",
    opened: "2000",
    racedHere: "DTM, ADAC GT Masters",
    description: "Flat and with high levels of grip, the Lausitzring dares you to go too fast too soon. But to set a good lap, you need to be smooth and avoid errors in the infield section. Go easy on the high kerbs in the first hairpin or your lap will suffer."
  }],
  [[8367, 8655, 8648], {
    url: 'https://game.raceroomracing.com/store/tracks/daytona-international-speedway/daytona-international-speedway/8366',
    location: "Daytona Beach, FL, United States",
    trackType: "Road Course",
    opened: "1985",
    racedHere: "IMSA GT Championship, World Sportscar Championship, World Challenge for Endurance Drivers, 24 Hours of Daytona and 3 more",
    description: "Where once car enthusiasts were racing on the sandy beach surface, in 1959 a new facility opened that would become Daytona International Speedway aka the \"World Center of Racing\". The track is located in Daytona Beach, Florida, United States and is the home of the DAYTONA 500 and the Rolex 24 At DAYTONA. The NASCAR Tri-Oval layout is 4.0 km long and features a 31° banking in the turns. The Road Course layout, used for Sports Car races, includes the infield, has 12 turns and is 5.7 km long."
  }],
  [[10394, 10725], {
    url: 'https://game.raceroomracing.com/store/tracks/donington-park/donington-park/10393',
    location: "Leicestershire, Great Britain, United Kingdom",
    trackType: "Permanent Circuit",
    opened: "2010",
    racedHere: "ETCC, BTCC, World Sportscar Championship, DTM and 10 more",
    description: "Donington Park is one of the most internationally-renowned and historically significant circuits in the world. The 4 km long track is located near Castle Donington in the picturesque Leicestershire, England. Being Britain's first true road circuit to be built, the circuit has a rich history in motorsports, spanning from classic Grand Prix racing in the 1930s through to the modern era. The track continues to host major national and international events, including yearly visits of the BTCC, British GT/F3, World Superbikes and a historic festival. Drivers love the challenging layout defined by fast flowing corners like the \"Craner Curves\" and the \"Old Hairpin\" combined with good overtaking opportunities at \"The Esses\" and the \"Melbourne Hairpin\"."
  }],
  [[7976, 6587, 7978, 7977], {
    url: 'https://game.raceroomracing.com/store/tracks/dubai-autodrome/dubai-autodrome/6586',
    location: "Dubai, United Arab Emirates",
    trackType: "Permanent Circuit",
    opened: "2004",
    racedHere: "FIA GT Championship, 24H Series, FIA GT3 European Championship, TCR and 1 more",
    description: "The Dubai Autodrome was completed in 2004 and was the United Arab Emirates' first fully-integrated motorsport facility. The 5.4 km long FIA sanctioned track has played host to world class racing, including rounds of the FIA GT Championship, European Touring Car Championship, A1 GP, GP2 Asia, Porsche GT3 Cup Challenge ME and the Radical Middle East Cup, but is mostly known for the renowned Hankook 24H Dubai Endurance Race."
  }],
  [[2024, 12318], {
    url: 'https://game.raceroomracing.com/store/tracks/autodromo-fernanda-pires-da-silva/autodromo-fernanda-pires-da-silva/2018',
    location: "Alcabideche, Estoril, Portugal",
    trackType: "Permanent Circuit",
    opened: "2000",
    racedHere: "ETCC, World Sportscar Championship, Porsche Supercup, DTM and 8 more",
    description: "Once home to some of motorsport’s most celebrated events, Estoril's balanced mix of high-speed straights, flowing corners, and a signature Parabolica demands finesse and courage. Having hosted top-level racing, Estoril stands as an enduring test of skill, where precise car control and racecraft shine through. Prepare to embrace a track steeped in history and challenge, rewarding those who dare to push the limits."
  }],
  [[6140], {
    url: 'https://game.raceroomracing.com/store/tracks/falkenbergs-motorbana/falkenbergs-motorbana/6139',
    location: "Falkenberg, Sweden",
    trackType: "Permanent Circuit",
    opened: "2004",
    racedHere: "STCC, Porsche Carrera Cup Scandinavia, NXT Gen Cup",
    description: "Located near the coast, Falkenberg is a favorite with the spectators. It is Sweden's fastest track showcasing a layout that is quite different from other Scandinavian tracks. The main straight ends in a tight chicane, but after that long sweeping high speed corners link together to one long series of direction changes through the entire lap. This one demands a well balanced car and a driver with good understanding of weight transfer and racing lines."
  }],
  [[12395], {
    url: 'https://game.raceroomracing.com/store/tracks/fliegerhorst-diepholz/fliegerhorst-diepholz/12394',
    location: "Diepholz, Germany",
    trackType: "Permanent Circuit · historic",
    opened: "1968–1998",
    racedHere: "DRM, DTM, Porsche Supercup, Porsche Carrera Cup Deutschland and 1 more",
    description: "Step onto the tarmac of Fliegerhorst Diepholz, a unique and challenging airfield circuit that brought racing to the heart of Lower Saxony, Germany. Known for its flat, fast, and technical layout, Diepholz was a staple of the DTM calendar, where drivers had to master the combination of high-speed sections and tight, tricky corners. The airfield's open surroundings offer a distinctive driving experience, requiring precision and focus to conquer. Take on this legendary track and experience the thrill of racing at one of the most distinctive venues in motorsport history."
  }],
  [[13432], {
    url: 'https://game.raceroomracing.com/store/tracks/fliegerhorst-wunstorf/fliegerhorst-wunstorf/13431',
    location: "Hannover, Germany",
    trackType: "Permanent Circuit · historic",
    opened: "1964–1998",
    racedHere: "DRM, Deutsche Rennsport Trophäe, DTM, Interserie and 2 more",
    description: "Wunstorf is a Luftwaffe air base west of Hanover. From 1964 to 1998 a temporary circuit was laid out on the airfield. The DTM raced there from its first season in 1984 until 1993, alongside the Interserie and German Formula 3, and the STW came in the 1990s. RaceRoom has the 1982 to 1998 layout: 5.05 km, run anticlockwise. It is close to flat, with 8 m of height difference over the lap, and the straights are long enough that the Group 5 cars got a longer final drive just for this track. The Peugeot 406's 1998 STW liveries raced here that year."
  }],
  [[5925, 6138], {
    url: 'https://game.raceroomracing.com/store/tracks/gellerasen-arena/gellerasen-arena/5924',
    location: "Karlskoga, Sweden",
    trackType: "Permanent Circuit",
    opened: "2017",
    racedHere: "STCC, Porsche Carrera Cup Scandinavia, NXT Gen Cup",
    description: "Karlskoga Motorstadion, also known as Gelleråsen is the oldest permanent motorsport race track in Sweden. The layout is such that the whole track can be seen from all spectator areas. The track is quite flat and open consisting of medium speed corner combinations with a very long sweeping turn leading in to the start/finish straight. While this may make it look like an easy drive, it also means that racing is close and intense. The overtaking zones will be hotly contested, so car positioning could be instrumental in securing the win."
  }],
  [[9360, 11859, 11861, 9321], {
    url: 'https://game.raceroomracing.com/store/tracks/genting-highlands/genting-highlands/9320',
    location: "Genting, Malaysia",
    trackType: "Hillclimb",
    description: "A legendary climb through the lush landscapes of Malaysia! This 12.6 km hillclimb features over 1000 meters of vertical gain. For the first time in RaceRoom, this hillclimb track allows multiplayer racing, even with the ability to switch lanes! On top of that dual lanes layout, the track also comes with a short hillclimb layout (featuring the top half of the climb), a full single lane layout, as well as a looped circuit up to a roundabout. Genting Highlands will be perfect for time attack, racing as well as drifting."
  }],
  [[13632], {
    url: 'https://game.raceroomracing.com/store/tracks/glasbachrennen/glasbachrennen/13631',
    location: "Bad Liebenstein, Germany",
    trackType: "Hillclimb",
    opened: "1974",
    description: "The Glasbachrennen climbs the L1027 through the Thuringian Forest from Steinbach, near Bad Liebenstein. It was first run in 1974, in what was then East Germany, and is now a round of the FIA European Hill Climb Championship. The RaceRoom road is just over 5 km long, narrow, and climbs 223 m through the forest. It was built for the final of the 2026 FIA Esports European Hill Climb Cup. In multiplayer each driver runs alone against the clock, with the others shown as ghosts."
  }],
  [[1693, 1763, 1764], {
    url: 'https://game.raceroomracing.com/store/tracks/hockenheimring/modern/1692',
    location: "Hockenheim, Germany",
    trackType: "Permanent Circuit",
    opened: "2002",
    racedHere: "DTM, Porsche Carrera Cup Deutschland, Porsche Supercup, FIA GT Championship and 20 more",
    description: "Redesigned in 2001, the new Hockenheimring Baden-Württemberg traditionally stages the DTM season kick-off as well as the final round of the season. The track demands precision driving, especially through the corner combinations in the Motodrom stadium complex."
  }],
  [[12112, 12236], {
    url: 'https://game.raceroomracing.com/store/tracks/hockenheimring/2001/12111',
    location: "Hockenheim, Germany",
    trackType: "Permanent Circuit · historic",
    opened: "1992–2001",
    racedHere: "DRM, European GT Championship, World Sportscar Championship, BMW M1 Procar Championship and 9 more",
    description: "Relive the glory days of Hockenheimring with the Classic version of this legendary circuit, featuring both the Grand Prix and Short layouts. Famous for its long, flat-out sections through the dense forest and tight chicanes, the Hockenheimring Classic demands both speed and skill. The GP layout offers the full experience of this historic track, while the Short layout provides a more compact, intense challenge. Whether you're powering down the long straights or navigating the complex corners, the Hockenheimring Classic delivers an authentic taste of motorsport history, where legends were made and the brave triumphed."
  }],
  [[1866], {
    url: 'https://game.raceroomracing.com/store/tracks/hungaroring/hungaroring/1865',
    location: "Mogyorod, Budapest, Hungary",
    trackType: "Permanent Circuit",
    opened: "2003",
    racedHere: "DTM, Interserie, Porsche 944 Turbo Cup, Porsche Supercup and 17 more",
    description: "Located in a natural valley in the Hungarian countryside, this track is fantastic for both spectators and drivers. The 4 km's of tarmac is quite varied and presents ample overtaking opportunities. Side by side racing action is the norm here."
  }],
  [[1850], {
    url: 'https://game.raceroomracing.com/store/tracks/autodromo-internazionale-enzo-e-dino-ferrari/autodromo-internazionale-enzo-e-dino-ferrari/1849',
    location: "Imola, Italy",
    trackType: "Permanent Circuit",
    opened: "2008",
    racedHere: "European GT Championship, World Sportscar Championship, DRM, ETCC and 17 more",
    description: "Imola, also known as the \"Autodromo Internazionale Enzo e Dino Ferrari\" is a 4.9 km long road circuit located near Bologna, Italy. The FIA Grade 1 licensed circuit has been hosting races for over 50 years, including Formula One events held under the name of \"San Marino Grand Prix\". The track underwent several layout changes over its history to conform to modern safety standards. Famous corners such as the \"Tamburello\", the \"Tosa\" hairpin, \"Acque Minerali\" and \"Rivazza\" still provide a thrilling experience on this all-time classic track."
  }],
  [[1852, 2014], {
    url: 'https://game.raceroomracing.com/store/tracks/indianapolis-motor-speedway/2012/1851',
    location: "Speedway, Indiana, USA, United States",
    trackType: "Road Course",
    opened: "2008–2013",
    racedHere: "IMSA",
    description: "Tear up tarmac in the world's largest spectator sporting facility. The tight technical twists of the infield and the long drag race down the oval straight makes for a very diverse racing venue, and makes it vital to hit a balanced car setup."
  }],
  [[9957, 9958, 9943], {
    url: 'https://game.raceroomracing.com/store/tracks/indianapolis-motor-speedway/modern/9942',
    location: "Speedway, Indiana, USA, United States",
    trackType: "Road Course",
    opened: "2014",
    racedHere: "IMSA GT Championship, Porsche Supercup, IMSA, Mazda MX-5 Cup and 4 more",
    description: "Tear up tarmac in the world's largest spectator sporting facility. The tight technical twists of the infield and the long drag race down the oval straight makes for a very diverse racing venue, and makes it vital to hit a balanced car setup."
  }],
  [[10463], {
    url: 'https://game.raceroomracing.com/store/tracks/autodromo-jose-carlos-pace/autodromo-jose-carlos-pace/10462',
    location: "São Paulo, Brazil",
    trackType: "Permanent Circuit",
    opened: "1999",
    racedHere: "ITC, ELMS, FIA GT1 World Championship, WEC",
    description: "There are few circuits which channel the spirit of motorsport quite like Interlagos. Situated in the outskirts of São Paulo’s enormous urban sprawl, whose favelas lap right up to its boundary walls, it’s an almost mythical place, steeped in history and wrapped up with the soul of Brazil’s legendary champion Ayrton Senna. The modern circuit sits within the footprint of the awesome loops and reverses of the original 1940 layout; it’s a surprisingly short track, but one that crams in three very different sectors: the downhill sweeps and blasts through to the twists and off-camber hairpins of the middle sector and then the full-throttle attack back up the hill to the finish."
  }],
  [[6137], {
    url: 'https://game.raceroomracing.com/store/tracks/knutstorp-ring/knutstorp-ring/6136',
    location: "Kågeröd, Sweden",
    trackType: "Permanent Circuit",
    opened: "1980",
    racedHere: "STCC, Porsche Carrera Cup Scandinavia, NXT Gen Cup",
    description: "Ring Knutstorp in Sweden is almost a miniature version of the Nordschleife. It's compact, it's hilly and for many Scandinavian racing hopefulls it is the place where they had their first true test of cornering technique and raw driving skill. Keep the speed down and it is a fun rollercoaster ride, but as you gain speed it becomes a serious challenge. There is no time to relax, no place to catch your breath and no forgiving run-off areas. You are truly all-in when pushing the limits at this relatively unknown gem of a track."
  }],
  [[1682, 2181], {
    url: 'https://game.raceroomracing.com/store/tracks/lakeview-hillclimb/lakeview-hillclimb/1681',
    location: "Vaestra Gotaland, Sweden",
    trackType: "Hillclimb",
    description: "The Lakeview Hillclimb is a fictional hillclimb track influenced by Swedish nature. The 10.6 km long track takes you through the forest passing some beautiful lakes, giving you an authentic impression of the Swedish landscape."
  }],
  [[2123], {
    url: 'https://game.raceroomracing.com/store/tracks/guia-circuit/guia-circuit/2122',
    location: "Macau, Macao",
    trackType: "Street Circuit",
    opened: "1958",
    racedHere: "WTCC, GT Asia Series, FIA GT World Cup, Macau Guia Race and 2 more",
    description: "Few, if any other, circuits around the world can claim a 60-year history using virtually the same layout, but that is precisely what Macau's Guia circuit has achieved. Since 1954, drivers have threaded their way through its precarious twists and turns, its big altitude variations and a very long main straight, making this track one of the most complete and challenging of the world."
  }],
  [[6010, 6167], {
    url: 'https://game.raceroomracing.com/store/tracks/mantorp-park/mantorp-park/6009',
    location: "Sweden",
    trackType: "Permanent Circuit",
    opened: "1997",
    racedHere: "STCC, Porsche Carrera Cup Scandinavia, NXT Gen Cup",
    description: "Located in central Sweden, Mantorp Park opened the doors in 1962 and has remained a fun stop for many Scandinavian racing series since then. The track is short, twisty and intense and is known as a real rollercoaster for the drivers. Several turns are blind and demand both track knowledge and confidence to hit correct. Any mistake and a visit to the unforgiving armco is a near certainty, so don't start pushing the limits until you understand the lines."
  }],
  [[1676, 1674, 1675], {
    url: 'https://game.raceroomracing.com/store/tracks/mid-ohio-sports-car-course/mid-ohio-sports-car-course/1673',
    location: "Troy Township, Ohio, United States",
    trackType: "Road Course",
    opened: "1962",
    racedHere: "American Le Mans Series, Mazda MX-5 Cup, IMSA, GTWC America and 2 more",
    description: "Located in the American heartland, this track is a real rollercoaster ride with enough challenges for even the most experienced drivers. Blind crests and technical sections bring excitement and passing opportunities to the three layouts."
  }],
  [[1671, 1672], {
    url: 'https://game.raceroomracing.com/store/tracks/autodromo-di-monza/autodromo-di-monza/1670',
    location: "Monza, Milan Region, Italy",
    trackType: "Permanent Circuit",
    opened: "2000",
    racedHere: "European GT Championship, World Sportscar Championship, ETCC, BMW M1 Procar Championship and 23 more",
    description: "A serene drive through the park this is not, more of a mad dash through the woods broken up by emergency braking for the chicanes. It’s the fastest track on the F1 calendar and the Parabolica curve will test man and machine to the limit. "
  }],
  [[3683, 3383, 2473], {
    url: 'https://game.raceroomracing.com/store/tracks/moscow-raceway/moscow-raceway/2472',
    location: "Volokolamsk, Russia",
    trackType: "Permanent Circuit",
    opened: "2012",
    racedHere: "DTM, Russian Circuit Racing Series, WTCC",
    description: "Moscow Raceway is the first Russian circuit built to hold international motorsport events. The track layout is short and technical, but the long back straight is built for slipstreaming and late brake maneuvers. You will not go fast here until you get a feel for the blind corners."
  }],
  [[9043, 8704, 9040, 9042, 9041, 9483], {
    url: 'https://game.raceroomracing.com/store/tracks/motorland-aragon/motorland-aragon/8703',
    location: "Teruel, Spain",
    trackType: "Permanent Circuit",
    opened: "2009",
    racedHere: "PURE ETCR, ELMS, WTCR",
    description: "MotorLand Aragón is an international track located in Alcañiz (Spain). It was designed by Hermann Tilke and it has the highest homologations levels awarded by FIA and FIM. It is one of the consolidated rounds in international championships like MotoGP, WSBK and WTCR. Thanks to its different configurations it can be used for testing all kinds of vehicles, from market to high performance ones such as the Le Mans Series race cars."
  }],
  [[12571, 12506, 12572], {
    url: 'https://game.raceroomracing.com/store/tracks/motorsport-arena-oschersleben/motorsport-arena-oschersleben/12505',
    location: "Oschersleben, Magdeburg, Germany",
    trackType: "Permanent Circuit",
    opened: "2007",
    racedHere: "ADAC GT Masters, GT4 European Series, International GT Open, Porsche Carrera Cup Deutschland and 10 more",
    description: "Meticulously recreated using laser-scanning technology, this challenging German circuit is renowned for its technical layout that demands precision and skill. While the track features minimal elevation changes, it's high on excitement with its fast sections and tight, demanding corners that require an aggressive yet controlled approach. The flowing nature of the circuit leaves little room for error, offering a true test of your driving abilities. Every bump, curb, and surface variation has been captured with utmost accuracy, delivering an immersive racing experience that brings you as close as possible to the real track. Get ready to take on Oschersleben and feel the thrill of this iconic venue."
  }],
  [[7273, 8309, 8310, 8311, 8314], {
    url: 'https://game.raceroomracing.com/store/tracks/ningbo-international-circuit/ningbo-international-circuit/7272',
    location: "Ningbo, China",
    trackType: "Permanent Circuit",
    opened: "2017",
    racedHere: "TCR, WTCC, GTWC Asia, WTCR",
    description: "The Ningbo International Speedpark is a FIA and FIM Grade 2 certified road course located in Chunxiao near to the city of Ningbo, China. The 4.0 km long track was completed in 2017 and runs in an anti-clockwise direction."
  }],
  [[10392, 10258, 9659, 12573], {
    url: 'https://game.raceroomracing.com/store/tracks/circuit-paul-armagnac/circuit-paul-armagnac/9657',
    location: "Nogaro, France",
    trackType: "Permanent Circuit",
    opened: "1989",
    racedHere: "ETCC, FIA GT Championship, GT4 European Series, FIA GT3 European Championship and 5 more",
    description: "Circuit Paul Armagnac also known as Circuit de Nogaro is located in southwestern France near the Nogaro airport and opened its gates in 1960 as the first purpose-built race track in France. Many championships visit the circuit to this day and enjoy its unique and picturesque atmosphere."
  }],
  [[5095, 4975, 2813, 5093], {
    url: 'https://game.raceroomracing.com/store/tracks/nurburgring/nordschleife/2812',
    location: "Nürburg, Germany",
    trackType: "Permanent Circuit",
    opened: "1983",
    racedHere: "DRM, European GT Championship, World Sportscar Championship, ETCC and 16 more",
    description: "The Nürburgring Nordschleife is the longest, toughest and most terrifying track in racing today. The \"Green Hell\" as it is known, twists and turns through the German Eifel mountains, providing a unique set of challenges. 160 unique turns, 22.8 kilometers and straights allowing you to reach dizzying top speeds, all have been minutely modelled based on laserscan data. Details down to the grafitti on track is recreated, and we are proud to now invite you to race this mythical track with any of the wide variety of RaceRoom cars. Racing and winning on the Nordschleife has always been very special. Tricky corners, treacherous crests, steep gradients and the constant close guardrails demand great skill from the driver and great understanding of your racing car. There is no comparison to taking on the Green Hell."
  }],
  [[2518], {
    url: 'https://game.raceroomracing.com/store/tracks/norisring/norisring/2517',
    location: "Nürnberg, Germany",
    trackType: "Street Circuit",
    opened: "1972",
    racedHere: "DRM, European GT Championship, BMW M1 Procar Championship, Deutsche Rennsport Trophäe and 14 more",
    description: "This famed street circuit is compact, uncompromising and deceptively tricky to master despite the simple layout. The walls are always close and the frantic breaking for the first hairpin turn can make or break your race. It is a lot of fun!"
  }],
  [[1691, 2010, 9847, 3377, 2011], {
    url: 'https://game.raceroomracing.com/store/tracks/nurburgring/grand-prix/1690',
    location: "Eifel Mountains, Rhineland-Palatinate, Germany",
    trackType: "Permanent Circuit",
    opened: "2002",
    racedHere: "Porsche 944 Turbo Cup, WTCC, Porsche Carrera Cup Deutschland, STW and 28 more",
    description: "A first class racing track, located right next to the famous Nordschleife but offering a very different challenge. A hairpin first corner gets you started and then the challenges never stop until you hit the back straight. A good track for multiple overtaking chances during a lap."
  }],
  [[11909, 4246, 4247, 4248, 2867], {
    url: 'https://game.raceroomracing.com/store/tracks/circuit-paul-ricard/circuit-paul-ricard/2866',
    location: "France",
    trackType: "Permanent Circuit",
    opened: "2002",
    racedHere: "WTCC, FIA GT Championship, World Sportscar Championship, FIA GT3 European Championship and 17 more",
    description: "Paul Ricard is a fixed stop on the calendar of all major racing teams, this is where the limits are tested. The signature blue markings on the track act as massive run-off areas, allowing teams to run at 101% without having to empty their car for gravel when it goes wrong. This challenging and fun track is catering to races from formula cars to GT and touring cars, it is a busy place, and one that you can now finally get to experience in detail."
  }],
  [[1784, 1778, 1783, 1785], {
    url: 'https://game.raceroomracing.com/store/tracks/autodromo-internacional-do-algarve/autodromo-internacional-do-algarve/1771',
    location: "Portimao, Algarve Region, Portugal",
    trackType: "Permanent Circuit",
    opened: "2008",
    racedHere: "ELMS, FIA GT Championship, FIA GT3 European Championship, GT4 European Series and 14 more",
    description: "The Autódromo Internacional do Algarve, also referred to as Portimao Circuit, is a 4.692 km circuit located in Portugal. The circuit contains many up and downhill sections leading into slow corners providing great passing options."
  }],
  [[1709, 2214], {
    url: 'https://game.raceroomracing.com/store/tracks/raceroom-hillclimb/raceroom-hillclimb/1705',
    location: "The Alps, France",
    trackType: "Hillclimb",
    description: "The RR Hillclimb takes you on a mad dash up the dangerous switchback roads of the French Alps. Precision, focus and pure nerve is what you will need to be fast here. It is a long way to the top, but it is worth it."
  }],
  [[266, 264, 265, 10414, 263, 267], {
    url: 'https://game.raceroomracing.com/store/tracks/raceroom-raceway/raceroom-raceway/262',
    location: "The Alps, France",
    trackType: "Permanent Circuit",
    description: "RaceRoom Raceway is a 3.8 km long fictional track inspired by the French Alps. Main features of the track include elevation changes, two blind off-camber corners and a couple of very fast chicanes. It is a track that is easy to learn, but very hard to master."
  }],
  [[2556, 11296, 5794], {
    url: 'https://game.raceroomracing.com/store/tracks/red-bull-ring-spielberg/red-bull-ring-spielberg/2521',
    location: "Spielberg, Austria",
    trackType: "Permanent Circuit",
    opened: "2011",
    racedHere: "Porsche Supercup, FIA GT Championship, DTM, Porsche Carrera Cup Deutschland and 15 more",
    description: "A modern update on the legendary Österreichring, Red Bull Ring reviving the well-known corners and adding a few new twists to the set of challenges a complete lap offers. Tight corners and heavy braking means good overtaking opportunities."
  }],
  [[5276], {
    url: 'https://game.raceroomracing.com/store/tracks/road-america/road-america/5275',
    location: "America, United States",
    trackType: "Road Course",
    opened: "1955",
    racedHere: "Trans-Am, IMSA GT Championship, World Sportscar Championship, American Le Mans Series and 5 more",
    description: "Road America is a permanent road course located near Elkhart Lake in Wisconsin, USA. The 6.515 km long track has hosted races since the 1950s and has maintained its original layout since then. It features many elevation changes and long stretches of road where speeds above 300 km/h can be reached. The track is a regular part of the calendar in many different racing series such as the NASCAR Xfinity Series, WeatherTech SportsCar Championship, SCCA Pirelli World Challenge, ASRA, AMA Superbike series, IndyCar Series, and SCCA Pro Racing's Trans-Am Series."
  }],
  [[3538], {
    url: 'https://game.raceroomracing.com/store/tracks/sachsenring/sachsenring/3537',
    location: "Hohenstein-Ernstthal, Germany",
    trackType: "Permanent Circuit",
    opened: "2003",
    racedHere: "STW, Porsche Carrera Cup Deutschland, DTM, ADAC GT Masters and 7 more",
    description: "Racing at Sachsenring began in 1927 on a long street based course. When modern race cars made roaring through the village too dangerous, a dedicated circuit was established. Today’s Sachsenring is a 3.671 km long and features many exciting elevation changes over its 14 turns."
  }],
  [[2026], {
    url: 'https://game.raceroomracing.com/store/tracks/salzburgring/salzburgring/2020',
    location: "Salzburg, Austria",
    trackType: "Permanent Circuit",
    opened: "1998",
    racedHere: "World Sportscar Championship, ETCC, DRM, Deutsche Rennsport Trophäe and 9 more",
    description: "If roaring through alpine valleys with the throttle down while banging doors with rivals is your idea of a good time, you're going to love racing at Salzburgring! Host to touring car and motorcycle racing alike, this 4,241 km track is located in Austria east of its namesake, Salzburg."
  }],
  [[6341, 6578, 6579], {
    url: 'https://game.raceroomracing.com/store/tracks/sepang-international-circuit/sepang-international-circuit/6340',
    location: "Sepang, Malaysia",
    trackType: "Permanent Circuit",
    opened: "1999",
    racedHere: "Super GT, Asian Le Mans Series, GT Asia Series, TCR and 3 more",
    description: "This 5.54 km circuit located near Kuala Lumpur in Malaysia was opened in 1999, and since then has been host to many racing series such as F1 and MotoGP as well as Super GT, the Asian Le Mans Series, Blancpain GT Series Asia and TCR International. RaceRoom has once again partnered directly with Tilke GmbH to bring you the best possible level of accuracy of the layout and its surroundings. The track consists of long straights followed by tight and slow corners providing good overtaking opportunities as well as incredibly fast corner combinations and some very technical turns that will challenge your driving techniques."
  }],
  [[2027, 4041, 4042], {
    url: 'https://game.raceroomracing.com/store/tracks/shanghai-international-circuit/shanghai-international-circuit/2021',
    location: "Jiading District, Shanghai, China",
    trackType: "Permanent Circuit",
    opened: "2004",
    racedHere: "WEC, Asian Le Mans Series, GT Asia Series, TCR and 2 more",
    description: "This circuit is host to the Chinese Grand Prix round of the Formula One World Championship. In addition to Formula One racing, Shanghai has played host to MotoGP, V8 Supercar, and WTCC races since its opening in 2004. Designed by Hermann Tilke, this 16 Turn 4.451 km long track is one of the most beautiful and challenging venues in all of motorsport."
  }],
  [[4039, 5862, 5816, 5817], {
    url: 'https://game.raceroomracing.com/store/tracks/silverstone-circuit/modern/4038',
    location: "Northamptonshire, United Kingdom",
    trackType: "Permanent Circuit",
    opened: "2011",
    racedHere: "British GT Championship, ELMS, FIA GT3 European Championship, GT4 European Series and 11 more",
    description: "Silverstone is also know as \"The Home Of British Motor Racing\" and it is one of the most well known and loved circuits in the world. The track has a long and glorious history which was built upon in 2010 where it had a massive facelift both to the layout and the facilities around the track. The main highlight for the race drivers is the introduction of the new \"Arena\" layout, which has been designed to create better overtaking opportunities, while keeping the high speed corner combinations which make this track so unique. It is still a high speed circuit and it is still very demanding on both drivers and equipment, but now more than ever a wide range of skills are needed to take the podium here."
  }],
  [[12268, 12390, 12389], {
    url: 'https://game.raceroomracing.com/store/tracks/silverstone-circuit/2001/12267',
    location: "Northamptonshire, United Kingdom",
    trackType: "Permanent Circuit · historic",
    opened: "1997–2009",
    racedHere: "World Sportscar Championship, ETCC, BMW M1 Procar Championship, BTCC and 12 more",
    description: "Step back in time and experience Silverstone as it was before the modern era of track revisions. This classic configuration retains the legendary Abbey and Bridge turns as they were in the late 1990's. Every turn brims with character, demanding equal parts finesse and bravery. Encounter the essence of British motorsport heritage and rediscover why Silverstone’s original layout remains a cherished symbol of pure, high-speed competition."
  }],
  [[2064], {
    url: 'https://game.raceroom.com/store/tracks/all/slovakia-ring',
    location: "Orechová Potôň, Dunajská Streda District, Slovakia",
    trackType: "Permanent Circuit",
    opened: "2018",
    racedHere: "FIA GT3 European Championship, FIA GT1 World Championship, WTCC, ADAC GT Masters and 6 more",
    description: "Slovakia Ring is a 5.922 km circuit located in southwestern Slovakia. Completed in 2009, the course contains 14 turns and has hosted races for both ADAC GT Masters and World Touring Car Championships."
  }],
  [[3913, 3912, 2016, 1854], {
    url: 'https://game.raceroomracing.com/store/tracks/sonoma-raceway/sonoma-raceway/1853',
    location: "Sonoma Mountains, California, USA, United States",
    trackType: "Road Course",
    opened: "2012",
    racedHere: "WTCC, IMSA GT Championship, Trans-Am",
    description: "Sonoma Raceway is a road course nestled among the Sonoma Mountains on the Pacific Coast of the United States. This popular race venue has shattered the silence of Northern California's wine country for nearly five decades! The World Touring Car Championship raced here in 2012 and 2013, and notable American series like NASCAR, IndyCar, and the NHRA have included the track in their championship schedules. Sonoma Raceway features 12 turns and 49 meters of elevation change over its 4.05 km length, purchasing it will unlock four layouts for your RaceRoom lineup; WTCC ‘13, Sprint Cup (The Chute), IRL, and the full 4.05 km course."
  }],
  [[6055, 6056], {
    url: 'https://game.raceroomracing.com/store/tracks/silverstone-circuit/stowe-circuit/6053',
    location: "Northamptonshire, United Kingdom",
    trackType: "Permanent Circuit",
    opened: "1997",
    description: "The Stowe configuration is located on the infield of Silverstone. It's a short but quite demanding lap, ideal to test your new cars. Stowe is easy to memorize but hard to perfect, and due to the close quarter nature of the venue it provides for spectacular action. You'll be surprised how often you end up coming back here for just one more lap."
  }],
  [[2012, 1841, 2013], {
    url: 'https://game.raceroomracing.com/store/tracks/suzuka-international-racing-course/suzuka-international-racing-course/1840',
    location: "Suzuka, Mie Prefecture, Japan",
    trackType: "Permanent Circuit",
    opened: "2003",
    racedHere: "JSPC, JTC, World Sportscar Championship, JGTC and 7 more",
    description: "Suzuka has been an icon of racing in the Far East for decades and it is one of few circuits in the world with a \"figure 8\" layout, the back straight passing over the front section via an overpass. You get three layouts on this famed tarmac."
  }],
  [[9985, 10355, 10351], {
    url: 'https://game.raceroomracing.com/store/tracks/tt-circuit-assen/tt-circuit-assen/9984',
    location: "Assen, Netherlands",
    trackType: "Permanent Circuit",
    opened: "2006",
    racedHere: "STW, Porsche Carrera Cup Deutschland, ADAC GT Masters, GT4 European Series and 5 more",
    description: "Known as the ‘Cathedral of Speed’ in the Netherlands, the location was first used as a road circuit for motorcycle races in 1926. It was later remodelled into a shorter permanent road course, only keeping the finish line section from its original layout. The layout has been further refined over the years, and Assen’s combination of flat-out sweepers and tight switchbacks make it a real challenge."
  }],
  [[9839], {
    url: 'https://game.raceroomracing.com/store/tracks/twin-forest/twin-forest/9838',
    location: "Crawley, England, United Kingdom",
    trackType: "Permanent Circuit",
    description: "Twin Forest is the ultimate battleground for head-to-head racing! Designed for intense 1v1 duels, this compact circuit draws inspiration from the legendary Race of Champions format, pitting drivers against each other in a test of pure skill. With its mirrored layout and technical turns, every lap is a battle for supremacy. Precision, control, and a cool head are key to victory!"
  }],
  [[7027, 6658, 7026], {
    url: 'https://game.raceroomracing.com/store/tracks/twin-ring-motegi/twin-ring-motegi/6657',
    location: "Hiyama, Japan",
    trackType: "Permanent Circuit",
    opened: "1997",
    racedHere: "Super GT, GT Asia Series, WTCC, Super Taikyu and 1 more",
    description: "This track is located near Motegi in Japan. The 4.8 km long road course is built in a stop-start straight-hairpin style, providing great overtaking opportunities, and is mostly known for hosting series such as the WTCC, Formula Nippon, Super GT, Formula 4 and MotoGP, making it one of the most popular tracks on the Asian continent."
  }],
  [[9465], {
    url: 'https://game.raceroomracing.com/store/tracks/valerbanen/valerbanen/9464',
    location: "Braskereidfoss, Norway",
    trackType: "Permanent Circuit",
    opened: "1997",
    racedHere: "Porsche Carrera Cup Scandinavia, STCC",
    description: "Vålerbanen is a very unique race track in Braskereidfoss, Norway. During Winter it is used as a test track for driving under special conditions, such as icy roads, but during dry months it hosts popular events like Norway's largest amateur racing event - Gatebil and the Swedish Touring Car Championship."
  }],
  [[13339, 13340, 13187, 13338], {
    url: 'https://game.raceroomracing.com/store/tracks/autodromo-vallelunga-piero-taruffi/autodromo-vallelunga-piero-taruffi/13186',
    location: "Vallelunga, Italy",
    trackType: "Permanent Circuit",
    opened: "2005",
    racedHere: "International GT Open, Italian GT Championship, FIA Motorsport Games GT Cup, PURE ETCR and 5 more",
    description: "Located just north of Rome, Vallelunga is a technical 4.085 km circuit with 15 corners and a flowing clockwise layout. Fast sweepers like Curva Grande combine with demanding braking zones such as Campagnano, rewarding rhythm, precision, and consistent driving."
  }],
  [[9344, 9324, 9343, 9177], {
    url: 'https://game.raceroomracing.com/store/tracks/watkins-glen-international/watkins-glen-international/9176',
    location: "Watkins Glen, New York, USA, United States",
    trackType: "Road Course",
    opened: "1992",
    racedHere: "IMSA GT Championship, IMSA, GTWC America, Mazda MX-5 Cup and 4 more",
    description: "Watkins Glen International aka \"The Glen\" has a long history in motorsports. It hosted the Formula One United States Grand Prix in the 60s and 70s. The layout flows very nicely through the hills of its environment, only interrupted by the famous Bus Stop Chicane at the Back Straight."
  }],
  [[1856], {
    url: 'https://game.raceroomracing.com/store/tracks/weathertech-raceway-laguna-seca/modern/1855',
    location: "Monterey, California, USA, United States",
    trackType: "Road Course",
    opened: "1996",
    racedHere: "IMSA GT Championship, American Le Mans Series, Mazda MX-5 Cup, IMSA and 4 more",
    description: "This is a fast flowing track with pronounced elevation changes; it is also home to the famous “Corkscrew”, one of the most iconic turns in all of motorsports. Braking hard over a blind crest before the plunge will get your pulse up."
  }],
  [[13533], {
    url: 'https://game.raceroomracing.com/store/tracks/weathertech-raceway-laguna-seca/1987/13532',
    location: "Monterey, California, USA, United States",
    trackType: "Road Course · historic",
    opened: "1957–1995",
    racedHere: "IMSA GT Championship, Trans-Am",
    description: "Laguna Seca as it was until 1988, when the infield section was added to bring the lap up to the minimum length for motorcycle racing. Without it the lap is 3.06 km and nine turns, against 3.6 km and eleven today. The Corkscrew is there, the blind left-right that drops 18 m. The slow infield is not, so the original lap is shorter and quicker. This is the circuit Can-Am and IMSA GT cars raced on in the 1970s and 80s."
  }],
  [[8327, 8075], {
    url: 'https://game.raceroomracing.com/store/tracks/zhejiang-international-circuit/zhejiang-international-circuit/8074',
    location: "Shaoxing, China",
    trackType: "Permanent Circuit",
    opened: "2016",
    racedHere: "GTWC Asia, TCR",
    description: "The Zhejiang Circuit is located in the city of Shaoxing in the eastern province of Zhejiang, China. It is a 3.2km long FIA Grade 2 track, penned by Apex Circuit Design. It is visited each year by both national and international TCR series. It also is featured on the calendar of various GT series."
  }],
  [[3464], {
    url: 'https://game.raceroomracing.com/store/tracks/zhuhai-international-circuit/zhuhai-international-circuit/3463',
    location: "Zhuhai, Guangdong, China",
    trackType: "Permanent Circuit",
    opened: "2004",
    racedHere: "FIA GT Championship, Intercontinental Le Mans Cup, Asian Le Mans Series, GT Asia Series and 1 more",
    description: "The Zhuhai International Circuit was China's first permanent road circuit when it was built in 1996. The 4.3 km long FIA Grade II certified circuit was designed by the same group which created the Formula One circuit in Adelaide and was upgraded in 2004 by Tilke GmbH. It features 14 corners combining fast sweepers and slow hairpins that provide plenty of good overtaking opportunities. It hosted many races from series such as the FIA GT Championship, Endurance World Championship, A1 Grand Prix, GT Asia, Asian Le Mans Series & TCR Asia, making it the home of Chinese motorsport."
  }]
].flatMap(([ids, meta]) => ids.map(id => [id, meta])));
