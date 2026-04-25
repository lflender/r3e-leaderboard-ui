(function () {
    const TRACK_LOGOS_BY_SLUG = Object.freeze({
        'adria-international-raceway-2003': 'images/tracks/adria-international-raceway-2003-13350-logo-original.png',
        'adria-international-raceway-2021': 'images/tracks/adria-international-raceway-2003-13350-logo-original.png',
        'alemannenring': 'images/tracks/alemannenring-12936-logo-original.png',
        'anderstorp-raceway': 'images/tracks/anderstorp-raceway-5300-logo-original.png',
        'autodrom-most': 'images/tracks/autodrom-most-7111-logo-original.png',
        'avus': 'images/tracks/avus-12419-logo-original.png',
        'bathurst-circuit': 'images/tracks/bathurst-circuit-1845-logo-original.png',
        'bilster-berg': 'images/tracks/bilster-berg-7818-logo-original.png',
        'brands-hatch-grand-prix': 'images/tracks/brands-hatch-grand-prix-9472-logo-original.png',
        'brands-hatch-indy': 'images/tracks/brands-hatch-grand-prix-9472-logo-original.png',
        'brno': 'images/tracks/brno-5297-logo-original.png',
        'chang-international-circuit': 'images/tracks/chang-international-circuit-4252-logo-original.png',
        'circuit-de-charade': 'images/tracks/circuit-de-charade-10903-logo-original.png',
        'circuit-de-pau-ville': 'images/tracks/circuit-de-pau-ville-11904-logo-original.png',
        'circuit-de-spa-francorchamps': 'images/tracks/circuit-de-spa-francorchamps-13255-logo-original.png',
        'circuit-zandvoort': 'images/tracks/circuit-zandvoort-10781-logo-original.png',
        'circuit-zandvoort-2019': 'images/tracks/circuit-zandvoort-10781-logo-original.png',
        'circuit-zolder': 'images/tracks/circuit-zolder-1683-logo-original.png',
        'daytona-international-speedway': 'images/tracks/daytona-international-speedway-8366-logo-original.png',
        'dekra-lausitzring': 'images/tracks/dekra-lausitzring-2467-logo-original.png',
        'donington-park': 'images/tracks/donington-park-10393-logo-original.png',
        'dubai-autodrome': 'images/tracks/dubai-autodrome-6586-logo-original.png',
        'estoril-circuit': 'images/tracks/estoril-circuit-2018-logo-original.png',
        'falkenberg-motorbana': 'images/tracks/falkenberg-motorbana-6139-logo-original.png',
        'fliegerhorst-diepholz': 'images/tracks/fliegerhorst-diepholz-12394-logo-original.png',
        'gellerasen-arena': 'images/tracks/gellerasen-arena-5924-logo-original.png',
        'genting-highlands-highway': 'images/tracks/genting-highlands-highway-9320-logo-original.png',
        'hockenheimring': 'images/tracks/hockenheimring-1692-logo-original.png',
        'hockenheimring-classic': 'images/tracks/hockenheimring-classic-12111-logo-original.png',
        'hungaroring': 'images/tracks/hungaroring-1865-logo-original.png',
        'imola': 'images/tracks/imola-1849-logo-original.png',
        'indianapolis-2012': 'images/tracks/indianapolis-2012-1851-logo-original.png',
        'indianapolis-motor-speedway': 'images/tracks/indianapolis-2012-1851-logo-original.png',
        'interlagos': 'images/tracks/interlagos-10462-logo-original.png',
        'knutstorp-ring': 'images/tracks/knutstorp-ring-6136-logo-original.png',
        'lakeview-hillclimb': 'images/tracks/lakeview-hillclimb-1681-logo-original.png',
        'macau': 'images/tracks/macau-2122-logo-original.png',
        'mantorp-park': 'images/tracks/mantorp-park-6009-logo-original.png',
        'mid-ohio': 'images/tracks/mid-ohio-1673-logo-original.png',
        'monza-circuit': 'images/tracks/monza-circuit-1670-logo-original.png',
        'moscow-raceway': 'images/tracks/moscow-raceway-2472-logo-original.png',
        'motorland-aragon': 'images/tracks/motorland-aragon-8703-logo-original.png',
        'motorsport-arena-oschersleben-2024': 'images/tracks/motorsport-arena-oschersleben-2024-12505-logo-original.png',
        'ningbo-international-speedpark': 'images/tracks/ningbo-international-speedpark-7272-logo-original.png',
        'nogaro-circuit-paul-armagnac': 'images/tracks/nogaro-circuit-paul-armagnac-9657-logo-original.png',
        'nordschleife': 'images/tracks/nordschleife-2812-logo-original.png',
        'norisring': 'images/tracks/norisring-2517-logo-original.png',
        'nurburgring': 'images/tracks/nordschleife-2812-logo-original.png',
        'paul-ricard': 'images/tracks/paul-ricard-2866-logo-original.png',
        'portimao-circuit': 'images/tracks/portimao-circuit-1771-logo-original.png',
        'raceroom-hillclimb': 'images/tracks/raceroom-hillclimb-1705-logo-original.png',
        'raceroom-raceway': 'images/tracks/raceroom-raceway-262-logo-original.png',
        'red-bull-ring-spielberg': 'images/tracks/red-bull-ring-spielberg-2521-logo-original.png',
        'road-america': 'images/tracks/road-america-5275-logo-original.png',
        'sachsenring': 'images/tracks/sachsenring-3537-logo-original.png',
        'salzburgring': 'images/tracks/salzburgring-2020-logo-original.png',
        'sepang': 'images/tracks/sepang-6340-logo-original.png',
        'shanghai-circuit': 'images/tracks/shanghai-circuit-2021-logo-original.png',
        'silverstone-circuit': 'images/tracks/silverstone-circuit-4038-logo-original.png',
        'silverstone-circuit-classic': 'images/tracks/silverstone-circuit-4038-logo-original.png',
        'slovakia-ring': 'images/tracks/slovakia-ring-2029-logo-original.png',
        'sonoma-raceway': 'images/tracks/sonoma-raceway-1853-logo-original.png',
        'stowe-circuit': 'images/tracks/silverstone-circuit-4038-logo-original.png',
        'suzuka-circuit': 'images/tracks/suzuka-circuit-1840-logo-original.png',
        'tt-circuit-assen': 'images/tracks/tt-circuit-assen-9984-logo-original.png',
        'twin-forest': 'images/tracks/twin-forest-9838-logo-original.png',
        'twin-ring-motegi': 'images/tracks/twin-ring-motegi-6657-logo-original.png',
        'valerbanen': 'images/tracks/valerbanen-9464-logo-original.png',
        'vallelunga': 'images/tracks/vallelunga-13186-logo-original.png',
        'watkins-glen-international': 'images/tracks/watkins-glen-international-9176-logo-original.png',
        'weathertech-raceway-laguna-seca': 'images/tracks/weathertech-raceway-laguna-seca-1855-logo-original.png',
        'zhejiang-circuit': 'images/tracks/zhejiang-circuit-8074-logo-original.png',
        'zhuhai-circuit': 'images/tracks/zhuhai-circuit-3463-logo-original.png'
    });

    const TRACK_LOGO_SLUG_BY_LABEL = Object.freeze({
        'adria international raceway 2003': 'adria-international-raceway-2003',
        'adria international raceway 2021': 'adria-international-raceway-2021',
        'alemannenring': 'alemannenring',
        'anderstorp raceway': 'anderstorp-raceway',
        'autodrom most': 'autodrom-most',
        'avus': 'avus',
        'bathurst circuit': 'bathurst-circuit',
        'bilster berg': 'bilster-berg',
        'brands hatch - grand prix': 'brands-hatch-grand-prix',
        'brands hatch - indy': 'brands-hatch-indy',
        'brno': 'brno',
        'chang international circuit': 'chang-international-circuit',
        'circuit de charade': 'circuit-de-charade',
        'circuit de pau-ville': 'circuit-de-pau-ville',
        'circuit de spa-francorchamps': 'circuit-de-spa-francorchamps',
        'circuit zandvoort': 'circuit-zandvoort',
        'circuit zandvoort 2019': 'circuit-zandvoort-2019',
        'circuit zolder': 'circuit-zolder',
        'daytona international speedway': 'daytona-international-speedway',
        'dekra lausitzring': 'dekra-lausitzring',
        'donington park': 'donington-park',
        'dubai autodrome': 'dubai-autodrome',
        'estoril circuit': 'estoril-circuit',
        'falkenberg motorbana': 'falkenberg-motorbana',
        'fliegerhorst diepholz': 'fliegerhorst-diepholz',
        'gellerasen arena': 'gellerasen-arena',
        'genting highlands highway': 'genting-highlands-highway',
        'hockenheimring': 'hockenheimring',
        'hockenheimring classic': 'hockenheimring-classic',
        'hockenheimring dmec': 'hockenheimring',
        'hungaroring': 'hungaroring',
        'imola': 'imola',
        'indianapolis 2012': 'indianapolis-2012',
        'indianapolis motor speedway': 'indianapolis-motor-speedway',
        'interlagos': 'interlagos',
        'knutstorp ring': 'knutstorp-ring',
        'lakeview hillclimb': 'lakeview-hillclimb',
        'macau': 'macau',
        'mantorp park': 'mantorp-park',
        'mid ohio': 'mid-ohio',
        'monza circuit': 'monza-circuit',
        'moscow raceway': 'moscow-raceway',
        'motorland aragon': 'motorland-aragon',
        'motorsport arena oschersleben 2024': 'motorsport-arena-oschersleben-2024',
        'ningbo international speedpark': 'ningbo-international-speedpark',
        'nogaro circuit paul armagnac': 'nogaro-circuit-paul-armagnac',
        'nordschleife': 'nordschleife',
        'norisring': 'norisring',
        'nurburgring': 'nurburgring',
        'paul ricard': 'paul-ricard',
        'portimao circuit': 'portimao-circuit',
        'raceroom hillclimb': 'raceroom-hillclimb',
        'raceroom raceway': 'raceroom-raceway',
        'red bull ring spielberg': 'red-bull-ring-spielberg',
        'road america': 'road-america',
        'sachsenring': 'sachsenring',
        'salzburgring': 'salzburgring',
        'sepang': 'sepang',
        'shanghai circuit': 'shanghai-circuit',
        'silverstone circuit': 'silverstone-circuit',
        'silverstone circuit classic': 'silverstone-circuit-classic',
        'slovakia ring': 'slovakia-ring',
        'sonoma raceway': 'sonoma-raceway',
        'stowe circuit': 'stowe-circuit',
        'suzuka circuit': 'suzuka-circuit',
        'tt circuit assen': 'tt-circuit-assen',
        'twin forest': 'twin-forest',
        'twin ring motegi': 'twin-ring-motegi',
        'valerbanen': 'valerbanen',
        'vallelunga': 'vallelunga',
        'watkins glen international': 'watkins-glen-international',
        'weathertech raceway laguna seca': 'weathertech-raceway-laguna-seca',
        'zhejiang circuit': 'zhejiang-circuit',
        'zhuhai circuit': 'zhuhai-circuit'
    });

    function normalizeTrackLogoKey(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    function resolveTrackLogoSlugByLabel(label) {
        const normalizedLabel = normalizeTrackLogoKey(label);
        if (!normalizedLabel) {
            return '';
        }

        const exactSlug = TRACK_LOGO_SLUG_BY_LABEL[normalizedLabel];
        if (exactSlug) {
            return exactSlug;
        }

        const baseLabel = normalizedLabel.split(' - ')[0];
        return TRACK_LOGO_SLUG_BY_LABEL[baseLabel] || '';
    }

    function resolveTrackLogoBySlug(slug) {
        return TRACK_LOGOS_BY_SLUG[String(slug || '').trim()] || '';
    }

    function resolveTrackLogoByLabel(label) {
        return resolveTrackLogoBySlug(resolveTrackLogoSlugByLabel(label));
    }

    function resolveTrackLogoById(trackId, fallbackLabel = '') {
        const tracks = Array.isArray(window.TRACKS_DATA) ? window.TRACKS_DATA : [];
        const track = tracks.find(item => String(item?.id) === String(trackId));
        const label = track?.label || fallbackLabel;
        return resolveTrackLogoByLabel(label);
    }

    function buildTrackLogosById() {
        const result = {};
        const tracks = Array.isArray(window.TRACKS_DATA) ? window.TRACKS_DATA : [];

        for (const track of tracks) {
            if (!track || track.id === undefined || track.id === null) {
                continue;
            }
            const logoUrl = resolveTrackLogoByLabel(track.label || track.name || '');
            if (logoUrl) {
                result[String(track.id)] = logoUrl;
            }
        }

        return result;
    }

    window.TRACK_LOGOS_BY_SLUG = TRACK_LOGOS_BY_SLUG;
    window.TRACK_LOGOS_BY_ID = buildTrackLogosById();
    window.R3ETrackImages = {
        TRACK_LOGOS_BY_SLUG,
        TRACK_LOGO_SLUG_BY_LABEL,
        normalizeTrackLogoKey,
        resolveTrackLogoSlugByLabel,
        resolveTrackLogoBySlug,
        resolveTrackLogoByLabel,
        resolveTrackLogoById,
        buildTrackLogosById
    };
})();





