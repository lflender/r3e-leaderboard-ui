/**
 * Country name to ISO 3166-1 alpha-2 code mappings
 * Handles special cases and variations not covered by Intl.DisplayNames
 */
const COUNTRY_NAME_MAP = {
    'netherlands': 'NL',
    'netherland': 'NL',
    'the netherlands': 'NL',
    'czech republic': 'CZ',
    'czechia': 'CZ',
    'antigua and barbuda': 'AG',
    'antigua & barbuda': 'AG',
    'romania': 'RO',
    'bosnia and herzegovina': 'BA',
    'bosnia & herzegovina': 'BA',
    'moldova': 'MD',
    'moldova, republic of': 'MD',
    'republic of moldova': 'MD',
    'bolivia': 'BO',
    'bolivia, plurinational state of': 'BO',
    'brunei': 'BN',
    'brunei darussalam': 'BN',
    'iran': 'IR',
    'iran, islamic republic of': 'IR',
    'islamic republic of iran': 'IR',
    'trinidad and tobago': 'TT',
    'trinidad & tobago': 'TT',
    'sint maarten': 'SX',
    'sint maarten (dutch part)': 'SX',
    'taiwan': 'TW',
    'taiwan, province of china': 'TW',
    'chinese taipei': 'TW',
    'hong kong': 'HK',
    'hongkong': 'HK',
    'venezuela': 'VE',
    'venezuela, bolivarian republic of': 'VE',
    'bolivarian republic of venezuela': 'VE',
    'swaziland': 'SZ',
    'eswatini': 'SZ',
    'turkey': 'TR',
    'türkiye': 'TR',
    'turkiye': 'TR',
    'palestine': 'PS',
    'palestine, state of': 'PS',
    'state of palestine': 'PS',
    'vietnam': 'VN',
    'viet nam': 'VN',
    'united states': 'US',
    'usa': 'US',
    'united kingdom': 'GB',
    'uk': 'GB',
    'great britain': 'GB',
    'korea': 'KR',
    'south korea': 'KR',
    'republic of korea': 'KR',
    'korea, republic of': 'KR',
    'north korea': 'KP',
    'korea, democratic people\'s republic of': 'KP',
    'democratic people\'s republic of korea': 'KP',
    'russia': 'RU',
    'russian federation': 'RU'
};

/**
 * ISO 3166-1 alpha-2 country codes
 */
const ISO_COUNTRY_CODES = [
    'AF','AX','AL','DZ','AS','AD','AO','AI','AQ','AG','AR','AM','AW','AU','AT','AZ','BS','BH','BD','BB','BY','BE','BZ','BJ','BM','BT','BO','BQ','BA','BW','BV','BR','IO','BN','BG','BF','BI','KH','CM','CA','CV','KY','CF','TD','CL','CN','CX','CC','CO','KM','CG','CD','CK','CR','CI','HR','CU','CW','CY','CZ','DK','DJ','DM','DO','EC','EG','SV','GQ','ER','EE','SZ','ET','FK','FO','FJ','FI','FR','GF','PF','TF','GA','GM','GE','DE','GH','GI','GR','GL','GD','GP','GU','GT','GG','GN','GW','GY','HT','HM','VA','HN','HK','HU','IS','IN','ID','IR','IQ','IE','IM','IL','IT','JM','JP','JE','JO','KZ','KE','KI','KP','KR','KW','KG','LA','LV','LB','LS','LR','LY','LI','LT','LU','MO','MG','MW','MY','MV','ML','MT','MH','MQ','MR','MU','YT','MX','FM','MD','MC','MN','ME','MS','MA','MZ','MM','NA','NR','NP','NL','NC','NZ','NI','NE','NG','NU','NF','MK','MP','NO','OM','PK','PW','PS','PA','PG','PY','PE','PH','PN','PL','PT','PR','QA','RE','RO','RU','RW','BL','SH','KN','LC','MF','PM','VC','WS','SM','ST','SA','SN','RS','SC','SL','SG','SX','SK','SI','SB','SO','ZA','GS','SS','ES','LK','SD','SR','SJ','SE','CH','SY','TW','TJ','TZ','TH','TL','TG','TK','TO','TT','TN','TR','TM','TC','TV','UG','UA','AE','GB','US','UM','UY','UZ','VU','VE','VN','VG','VI','WF','EH','YE','ZM','ZW'
];

// Make available globally
if (typeof window !== 'undefined') {
    window.COUNTRY_NAME_MAP = COUNTRY_NAME_MAP;
    window.ISO_COUNTRY_CODES = ISO_COUNTRY_CODES;
}
