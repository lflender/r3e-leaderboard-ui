(function () {
    const TRACK_LOGOS_BY_SLUG = Object.freeze({
        'adria-international-raceway-2003': 'images/tracks/VenueLogo_13748_on_dark_small.webp',
        'adria-international-raceway-2021': 'images/tracks/VenueLogo_13748_on_dark_small.webp',
        'alemannenring': 'images/tracks/VenueLogo_13817_on_dark_small.webp',
        'anderstorp-raceway': 'images/tracks/VenueLogo_13784_on_dark_small.webp',
        'autodrom-most': 'images/tracks/VenueLogo_13795_on_dark_small.webp',
        'avus': 'images/tracks/VenueLogo_13814_on_dark_small.webp',
        'bathurst-circuit': 'images/tracks/VenueLogo_13758_on_dark_small.webp',
        'bilster-berg': 'images/tracks/VenueLogo_13798_on_dark_small.webp',
        'brands-hatch-grand-prix': 'images/tracks/VenueLogo_13743_on_dark_small.webp',
        'brands-hatch-indy': 'images/tracks/VenueLogo_13743_on_dark_small.webp',
        'brno': 'images/tracks/VenueLogo_13783_on_dark_small.webp',
        'chang-international-circuit': 'images/tracks/VenueLogo_13779_on_dark_small.webp',
        'circuit-de-charade': 'images/tracks/VenueLogo_13810_on_dark_small.webp',
        'circuit-de-pau-ville': 'images/tracks/VenueLogo_13811_on_dark_small.webp',
        'circuit-de-spa-francorchamps': 'images/tracks/VenueLogo_13744_on_dark_small.webp',
        'circuit-de-spa-francorchamps-1995': 'images/tracks/VenueLogo_13744_on_dark_small.webp',
        'circuit-zandvoort': 'images/tracks/VenueLogo_13745_on_dark_small.webp',
        'circuit-zandvoort-2019': 'images/tracks/VenueLogo_13745_on_dark_small.webp',
        'circuit-zolder': 'images/tracks/VenueLogo_13753_on_dark_small.webp',
        'daytona-international-speedway': 'images/tracks/VenueLogo_13800_on_dark_small.webp',
        'dekra-lausitzring': 'images/tracks/VenueLogo_13770_on_dark_small.webp',
        'donington-park': 'images/tracks/VenueLogo_13808_on_dark_small.webp',
        'dubai-autodrome': 'images/tracks/VenueLogo_13793_on_dark_small.webp',
        'estoril-circuit': 'images/tracks/VenueLogo_13763_on_dark_small.webp',
        'falkenberg-motorbana': 'images/tracks/VenueLogo_13790_on_dark_small.webp',
        'fliegerhorst-diepholz': 'images/tracks/VenueLogo_13813_on_dark_small.webp',
        'fliegerhorst-wunstorf': 'images/tracks/VenueLogo_13821_on_dark_small.webp',
        'gellerasen-arena': 'images/tracks/VenueLogo_13786_on_dark_small.webp',
        'genting-highlands-highway': 'images/tracks/VenueLogo_13803_on_dark_small.webp',
        'glasbachrennen': 'images/tracks/VenueLogo_13742_on_dark_small.webp',
        'hockenheimring': 'images/tracks/VenueLogo_13741_on_dark_small.webp',
        'hockenheimring-classic': 'images/tracks/VenueLogo_13741_on_dark_small.webp',
        'hungaroring': 'images/tracks/VenueLogo_13762_on_dark_small.webp',
        'imola': 'images/tracks/VenueLogo_13759_on_dark_small.webp',
        'indianapolis-2012': 'images/tracks/VenueLogo_13746_on_dark_small.webp',
        'indianapolis-motor-speedway': 'images/tracks/VenueLogo_13746_on_dark_small.webp',
        'interlagos': 'images/tracks/VenueLogo_13809_on_dark_small.webp',
        'knutstorp-ring': 'images/tracks/VenueLogo_13789_on_dark_small.webp',
        'lakeview-hillclimb': 'images/tracks/VenueLogo_13752_on_dark_small.webp',
        'macau': 'images/tracks/VenueLogo_13767_on_dark_small.webp',
        'mantorp-park': 'images/tracks/VenueLogo_13787_on_dark_small.webp',
        'mid-ohio': 'images/tracks/VenueLogo_13751_on_dark_small.webp',
        'monza-circuit': 'images/tracks/VenueLogo_13750_on_dark_small.webp',
        'moscow-raceway': 'images/tracks/VenueLogo_13771_on_dark_small.webp',
        'motorland-aragon': 'images/tracks/VenueLogo_13801_on_dark_small.webp',
        'motorsport-arena-oschersleben-2024': 'images/tracks/VenueLogo_13769_on_dark_small.webp',
        'ningbo-international-speedpark': 'images/tracks/VenueLogo_13796_on_dark_small.webp',
        'nogaro-circuit-paul-armagnac': 'images/tracks/VenueLogo_13805_on_dark_small.webp',
        'nordschleife': 'images/tracks/VenueLogo_13754_on_dark_small.webp',
        'norisring': 'images/tracks/VenueLogo_13772_on_dark_small.webp',
        'nurburgring': 'images/tracks/VenueLogo_13754_on_dark_small.webp',
        'paul-ricard': 'images/tracks/VenueLogo_13775_on_dark_small.webp',
        'portimao-circuit': 'images/tracks/VenueLogo_13756_on_dark_small.webp',
        'raceroom-hillclimb': 'images/tracks/VenueLogo_13755_on_dark_small.webp',
        'raceroom-raceway': 'images/tracks/VenueLogo_13749_on_dark_small.webp',
        'red-bull-ring-spielberg': 'images/tracks/VenueLogo_13773_on_dark_small.webp',
        'road-america': 'images/tracks/VenueLogo_13782_on_dark_small.webp',
        'sachsenring': 'images/tracks/VenueLogo_13777_on_dark_small.webp',
        'salzburgring': 'images/tracks/VenueLogo_13764_on_dark_small.webp',
        'sepang': 'images/tracks/VenueLogo_13791_on_dark_small.webp',
        'shanghai-circuit': 'images/tracks/VenueLogo_13765_on_dark_small.webp',
        'silverstone-circuit': 'images/tracks/VenueLogo_13747_on_dark_small.webp',
        'silverstone-circuit-classic': 'images/tracks/VenueLogo_13747_on_dark_small.webp',
        'slovakia-ring': 'images/tracks/VenueLogo_13766_on_dark_small.webp',
        'sonoma-raceway': 'images/tracks/VenueLogo_13760_on_dark_small.webp',
        'stowe-circuit': 'images/tracks/VenueLogo_13747_on_dark_small.webp',
        'suzuka-circuit': 'images/tracks/VenueLogo_13757_on_dark_small.webp',
        'tt-circuit-assen': 'images/tracks/VenueLogo_13807_on_dark_small.webp',
        'twin-forest': 'images/tracks/VenueLogo_13806_on_dark_small.webp',
        'twin-ring-motegi': 'images/tracks/VenueLogo_13794_on_dark_small.webp',
        'valerbanen': 'images/tracks/VenueLogo_13804_on_dark_small.webp',
        'vallelunga': 'images/tracks/VenueLogo_13820_on_dark_small.webp',
        'watkins-glen-international': 'images/tracks/VenueLogo_13802_on_dark_small.webp',
        'weathertech-raceway-laguna-seca': 'images/tracks/VenueLogo_13761_on_dark_small.webp',
        'weathertech-raceway-laguna-seca-1987': 'images/tracks/VenueLogo_13761_on_dark_small.webp',
        'zhejiang-circuit': 'images/tracks/VenueLogo_13799_on_dark_small.webp',
        'zhuhai-circuit': 'images/tracks/VenueLogo_13776_on_dark_small.webp'
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
        'brands hatch': 'brands-hatch-grand-prix',
        'brands hatch - grand prix': 'brands-hatch-grand-prix',
        'brands hatch - indy': 'brands-hatch-indy',
        'brno': 'brno',
        'chang international circuit': 'chang-international-circuit',
        'circuit de charade': 'circuit-de-charade',
        'circuit de pau-ville': 'circuit-de-pau-ville',
        'circuit de spa-francorchamps': 'circuit-de-spa-francorchamps',
        'circuit de spa-francorchamps 1995': 'circuit-de-spa-francorchamps-1995',
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
        'fliegerhorst wunstorf': 'fliegerhorst-wunstorf',
        'gellerasen arena': 'gellerasen-arena',
        'genting highlands highway': 'genting-highlands-highway',
        'glasbachrennen': 'glasbachrennen',
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
        'weathertech raceway laguna seca 1987': 'weathertech-raceway-laguna-seca-1987',
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





