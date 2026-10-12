/**
 * WA-USERAUTH — Universal Standalone Browser Integration Script
 *
 * Provides:
 *  - Declarative button integration via [data-wa-userauth]
 *  - Programmatic API via window.WAUserAuth.open(options)
 *  - Embedded responsive modal (Desktop centered modal / Mobile bottom sheet)
 *  - Comprehensive Global WhatsApp Country Dataset (240+ countries & territories)
 *  - Glitch-free In-Modal Country Picker Sheet with real-time search & custom dark scrollbar
 *  - Real Alphanumeric Text-Numeric Visual CAPTCHA with SVG distortion & 1-click refresh
 *  - 6-digit OTP input with paste and auto-advance
 *  - Resend cooldown timer
 *  - Custom DOM events: wa-userauth:success, wa-userauth:error, wa-userauth:close
 *  - Zero external dependencies (No React, jQuery, or framework required)
 */
(function (window, document) {
  'use strict';

  if (window.WAUserAuth && window.WAUserAuth.__INITIALIZED__) {
    return;
  }

  // Comprehensive Global Country Dataset (All Countries with WhatsApp support)
  const COUNTRIES = [
    { code: '+91', iso: 'IN', name: 'India', flag: '🇮🇳' },
    { code: '+1', iso: 'US', name: 'United States', flag: '🇺🇸' },
    { code: '+44', iso: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
    { code: '+971', iso: 'AE', name: 'United Arab Emirates', flag: '🇦🇪' },
    { code: '+966', iso: 'SA', name: 'Saudi Arabia', flag: '🇸🇦' },
    { code: '+1', iso: 'CA', name: 'Canada', flag: '🇨🇦' },
    { code: '+61', iso: 'AU', name: 'Australia', flag: '🇦🇺' },
    { code: '+49', iso: 'DE', name: 'Germany', flag: '🇩🇪' },
    { code: '+33', iso: 'FR', name: 'France', flag: '🇫🇷' },
    { code: '+39', iso: 'IT', name: 'Italy', flag: '🇮🇹' },
    { code: '+34', iso: 'ES', name: 'Spain', flag: '🇪🇸' },
    { code: '+55', iso: 'BR', name: 'Brazil', flag: '🇧🇷' },
    { code: '+52', iso: 'MX', name: 'Mexico', flag: '🇲🇽' },
    { code: '+62', iso: 'ID', name: 'Indonesia', flag: '🇮🇩' },
    { code: '+60', iso: 'MY', name: 'Malaysia', flag: '🇲🇾' },
    { code: '+65', iso: 'SG', name: 'Singapore', flag: '🇸🇬' },
    { code: '+234', iso: 'NG', name: 'Nigeria', flag: '🇳🇬' },
    { code: '+27', iso: 'ZA', name: 'South Africa', flag: '🇿🇦' },
    { code: '+92', iso: 'PK', name: 'Pakistan', flag: '🇵🇰' },
    { code: '+880', iso: 'BD', name: 'Bangladesh', flag: '🇧🇩' },
    { code: '+94', iso: 'LK', name: 'Sri Lanka', flag: '🇱🇰' },
    { code: '+977', iso: 'NP', name: 'Nepal', flag: '🇳🇵' },
    { code: '+20', iso: 'EG', name: 'Egypt', flag: '🇪🇬' },
    { code: '+90', iso: 'TR', name: 'Turkey', flag: '🇹🇷' },
    { code: '+7', iso: 'RU', name: 'Russia', flag: '🇷🇺' },
    { code: '+380', iso: 'UA', name: 'Ukraine', flag: '🇺🇦' },
    { code: '+81', iso: 'JP', name: 'Japan', flag: '🇯🇵' },
    { code: '+82', iso: 'KR', name: 'South Korea', flag: '🇰🇷' },
    { code: '+84', iso: 'VN', name: 'Vietnam', flag: '🇻🇳' },
    { code: '+66', iso: 'TH', name: 'Thailand', flag: '🇹🇭' },
    { code: '+63', iso: 'PH', name: 'Philippines', flag: '🇵🇭' },
    { code: '+31', iso: 'NL', name: 'Netherlands', flag: '🇳🇱' },
    { code: '+32', iso: 'BE', name: 'Belgium', flag: '🇧🇪' },
    { code: '+41', iso: 'CH', name: 'Switzerland', flag: '🇨🇭' },
    { code: '+43', iso: 'AT', name: 'Austria', flag: '🇦🇹' },
    { code: '+46', iso: 'SE', name: 'Sweden', flag: '🇸🇪' },
    { code: '+47', iso: 'NO', name: 'Norway', flag: '🇳🇴' },
    { code: '+45', iso: 'DK', name: 'Denmark', flag: '🇩🇰' },
    { code: '+358', iso: 'FI', name: 'Finland', flag: '🇫🇮' },
    { code: '+353', iso: 'IE', name: 'Ireland', flag: '🇮🇪' },
    { code: '+351', iso: 'PT', name: 'Portugal', flag: '🇵🇹' },
    { code: '+48', iso: 'PL', name: 'Poland', flag: '🇵🇱' },
    { code: '+420', iso: 'CZ', name: 'Czech Republic', flag: '🇨🇿' },
    { code: '+36', iso: 'HU', name: 'Hungary', flag: '🇭🇺' },
    { code: '+30', iso: 'GR', name: 'Greece', flag: '🇬🇷' },
    { code: '+40', iso: 'RO', name: 'Romania', flag: '🇷🇴' },
    { code: '+359', iso: 'BG', name: 'Bulgaria', flag: '🇧🇬' },
    { code: '+385', iso: 'HR', name: 'Croatia', flag: '🇭🇷' },
    { code: '+381', iso: 'RS', name: 'Serbia', flag: '🇷🇸' },
    { code: '+421', iso: 'SK', name: 'Slovakia', flag: '🇸🇰' },
    { code: '+386', iso: 'SI', name: 'Slovenia', flag: '🇸🇮' },
    { code: '+372', iso: 'EE', name: 'Estonia', flag: '🇪🇪' },
    { code: '+371', iso: 'LV', name: 'Latvia', flag: '🇱🇻' },
    { code: '+370', iso: 'LT', name: 'Lithuania', flag: '🇱🇹' },
    { code: '+356', iso: 'MT', name: 'Malta', flag: '🇲🇹' },
    { code: '+357', iso: 'CY', name: 'Cyprus', flag: '🇨🇾' },
    { code: '+354', iso: 'IS', name: 'Iceland', flag: '🇮🇸' },
    { code: '+352', iso: 'LU', name: 'Luxembourg', flag: '🇱🇺' },
    { code: '+377', iso: 'MC', name: 'Monaco', flag: '🇲🇨' },
    { code: '+423', iso: 'LI', name: 'Liechtenstein', flag: '🇱🇮' },
    { code: '+376', iso: 'AD', name: 'Andorra', flag: '🇦🇩' },
    { code: '+378', iso: 'SM', name: 'San Marino', flag: '🇸🇲' },
    { code: '+379', iso: 'VA', name: 'Vatican City', flag: '🇻🇦' },
    { code: '+972', iso: 'IL', name: 'Israel', flag: '🇮🇱' },
    { code: '+974', iso: 'QA', name: 'Qatar', flag: '🇶🇦' },
    { code: '+965', iso: 'KW', name: 'Kuwait', flag: '🇰🇼' },
    { code: '+968', iso: 'OM', name: 'Oman', flag: '🇴🇲' },
    { code: '+973', iso: 'BH', name: 'Bahrain', flag: '🇧🇭' },
    { code: '+962', iso: 'JO', name: 'Jordan', flag: '🇯🇴' },
    { code: '+961', iso: 'LB', name: 'Lebanon', flag: '🇱🇧' },
    { code: '+964', iso: 'IQ', name: 'Iraq', flag: '🇮🇶' },
    { code: '+967', iso: 'YE', name: 'Yemen', flag: '🇾🇪' },
    { code: '+970', iso: 'PS', name: 'Palestine', flag: '🇵🇸' },
    { code: '+212', iso: 'MA', name: 'Morocco', flag: '🇲🇦' },
    { code: '+213', iso: 'DZ', name: 'Algeria', flag: '🇩🇿' },
    { code: '+216', iso: 'TN', name: 'Tunisia', flag: '🇹🇳' },
    { code: '+218', iso: 'LY', name: 'Libya', flag: '🇱🇾' },
    { code: '+249', iso: 'SD', name: 'Sudan', flag: '🇸🇩' },
    { code: '+254', iso: 'KE', name: 'Kenya', flag: '🇰🇪' },
    { code: '+255', iso: 'TZ', name: 'Tanzania', flag: '🇹🇿' },
    { code: '+256', iso: 'UG', name: 'Uganda', flag: '🇺🇬' },
    { code: '+251', iso: 'ET', name: 'Ethiopia', flag: '🇪🇹' },
    { code: '+233', iso: 'GH', name: 'Ghana', flag: '🇬🇭' },
    { code: '+225', iso: 'CI', name: 'Ivory Coast', flag: '🇨🇮' },
    { code: '+221', iso: 'SN', name: 'Senegal', flag: '🇸🇳' },
    { code: '+237', iso: 'CM', name: 'Cameroon', flag: '🇨🇲' },
    { code: '+260', iso: 'ZM', name: 'Zambia', flag: '🇿🇲' },
    { code: '+263', iso: 'ZW', name: 'Zimbabwe', flag: '🇿🇼' },
    { code: '+258', iso: 'MZ', name: 'Mozambique', flag: '🇲🇿' },
    { code: '+264', iso: 'NA', name: 'Namibia', flag: '🇳🇦' },
    { code: '+267', iso: 'BW', name: 'Botswana', flag: '🇧🇼' },
    { code: '+250', iso: 'RW', name: 'Rwanda', flag: '🇷🇼' },
    { code: '+230', iso: 'MU', name: 'Mauritius', flag: '🇲🇺' },
    { code: '+54', iso: 'AR', name: 'Argentina', flag: '🇦🇷' },
    { code: '+57', iso: 'CO', name: 'Colombia', flag: '🇨🇴' },
    { code: '+56', iso: 'CL', name: 'Chile', flag: '🇨🇱' },
    { code: '+51', iso: 'PE', name: 'Peru', flag: '🇵🇪' },
    { code: '+58', iso: 'VE', name: 'Venezuela', flag: '🇻🇪' },
    { code: '+593', iso: 'EC', name: 'Ecuador', flag: '🇪🇨' },
    { code: '+591', iso: 'BO', name: 'Bolivia', flag: '🇧🇴' },
    { code: '+595', iso: 'PY', name: 'Paraguay', flag: '🇵🇾' },
    { code: '+598', iso: 'UY', name: 'Uruguay', flag: 'UY' },
    { code: '+507', iso: 'PA', name: 'Panama', flag: '🇵🇦' },
    { code: '+506', iso: 'CR', name: 'Costa Rica', flag: '🇨🇷' },
    { code: '+502', iso: 'GT', name: 'Guatemala', flag: '🇬🇹' },
    { code: '+503', iso: 'SV', name: 'El Salvador', flag: '🇸🇻' },
    { code: '+504', iso: 'HN', name: 'Honduras', flag: '🇭🇳' },
    { code: '+505', iso: 'NI', name: 'Nicaragua', flag: '🇳🇮' },
    { code: '+1876', iso: 'JM', name: 'Jamaica', flag: '🇯🇲' },
    { code: '+1809', iso: 'DO', name: 'Dominican Republic', flag: '🇩🇴' },
    { code: '+1787', iso: 'PR', name: 'Puerto Rico', flag: '🇵🇷' },
    { code: '+1868', iso: 'TT', name: 'Trinidad and Tobago', flag: '🇹🇹' },
    { code: '+64', iso: 'NZ', name: 'New Zealand', flag: '🇳🇿' },
    { code: '+679', iso: 'FJ', name: 'Fiji', flag: '🇫🇯' },
    { code: '+675', iso: 'PG', name: 'Papua New Guinea', flag: '🇵🇬' },
    { code: '+7', iso: 'KZ', name: 'Kazakhstan', flag: '🇰🇿' },
    { code: '+998', iso: 'UZ', name: 'Uzbekistan', flag: '🇺🇿' },
    { code: '+996', iso: 'KG', name: 'Kyrgyzstan', flag: '🇰🇬' },
    { code: '+992', iso: 'TJ', name: 'Tajikistan', flag: '🇹🇯' },
    { code: '+993', iso: 'TM', name: 'Turkmenistan', flag: '🇹🇲' },
    { code: '+994', iso: 'AZ', name: 'Azerbaijan', flag: '🇦🇿' },
    { code: '+995', iso: 'GE', name: 'Georgia', flag: '🇬🇪' },
    { code: '+374', iso: 'AM', name: 'Armenia', flag: '🇦🇲' },
    { code: '+852', iso: 'HK', name: 'Hong Kong', flag: '🇭🇰' },
    { code: '+853', iso: 'MO', name: 'Macau', flag: '🇲🇴' },
    { code: '+886', iso: 'TW', name: 'Taiwan', flag: '🇹🇼' },
    { code: '+976', iso: 'MN', name: 'Mongolia', flag: '🇲🇳' },
    { code: '+855', iso: 'KH', name: 'Cambodia', flag: '🇰🇭' },
    { code: '+856', iso: 'LA', name: 'Laos', flag: '🇱🇦' },
    { code: '+95', iso: 'MM', name: 'Myanmar', flag: '🇲🇲' },
    { code: '+975', iso: 'BT', name: 'Bhutan', flag: '🇧🇹' },
    { code: '+960', iso: 'MV', name: 'Maldives', flag: '🇲🇻' },
    { code: '+673', iso: 'BN', name: 'Brunei', flag: '🇧🇳' },
    { code: '+670', iso: 'TL', name: 'Timor-Leste', flag: '🇹🇱' },
    { code: '+93', iso: 'AF', name: 'Afghanistan', flag: '🇦🇫' },
    { code: '+355', iso: 'AL', name: 'Albania', flag: '🇦🇱' },
    { code: '+244', iso: 'AO', name: 'Angola', flag: '🇦🇴' },
    { code: '+1268', iso: 'AG', name: 'Antigua and Barbuda', flag: '🇦🇬' },
    { code: '+297', iso: 'AW', name: 'Aruba', flag: '🇦🇼' },
    { code: '+1242', iso: 'BS', name: 'Bahamas', flag: '🇧🇸' },
    { code: '+1246', iso: 'BB', name: 'Barbados', flag: '🇧🇧' },
    { code: '+375', iso: 'BY', name: 'Belarus', flag: '🇧🇾' },
    { code: '+501', iso: 'BZ', name: 'Belize', flag: '🇧🇿' },
    { code: '+229', iso: 'BJ', name: 'Benin', flag: '🇧🇯' },
    { code: '+1441', iso: 'BM', name: 'Bermuda', flag: '🇧🇲' },
    { code: '+387', iso: 'BA', name: 'Bosnia and Herzegovina', flag: '🇧🇦' },
    { code: '+226', iso: 'BF', name: 'Burkina Faso', flag: '🇧🇫' },
    { code: '+257', iso: 'BI', name: 'Burundi', flag: '🇧🇮' },
    { code: '+238', iso: 'CV', name: 'Cape Verde', flag: '🇨🇻' },
    { code: '+1345', iso: 'KY', name: 'Cayman Islands', flag: '🇰🇾' },
    { code: '+236', iso: 'CF', name: 'Central African Republic', flag: '🇨🇫' },
    { code: '+235', iso: 'TD', name: 'Chad', flag: '🇹🇩' },
    { code: '+269', iso: 'KM', name: 'Comoros', flag: '🇰🇲' },
    { code: '+242', iso: 'CG', name: 'Congo', flag: '🇨🇬' },
    { code: '+243', iso: 'CD', name: 'Congo (DRC)', flag: '🇨🇩' },
    { code: '+253', iso: 'DJ', name: 'Djibouti', flag: '🇩🇯' },
    { code: '+1767', iso: 'DM', name: 'Dominica', flag: '🇩🇲' },
    { code: '+240', iso: 'GQ', name: 'Equatorial Guinea', flag: '🇬🇶' },
    { code: '+291', iso: 'ER', name: 'Eritrea', flag: '🇪🇷' },
    { code: '+268', iso: 'SZ', name: 'Eswatini', flag: '🇸🇿' },
    { code: '+594', iso: 'GF', name: 'French Guiana', flag: '🇬🇫' },
    { code: '+241', iso: 'GA', name: 'Gabon', flag: '🇬🇦' },
    { code: '+220', iso: 'GM', name: 'Gambia', flag: '🇬🇲' },
    { code: '+1473', iso: 'GD', name: 'Grenada', flag: '🇬🇩' },
    { code: '+590', iso: 'GP', name: 'Guadeloupe', flag: '🇬🇵' },
    { code: '+1671', iso: 'GU', name: 'Guam', flag: '🇬🇺' },
    { code: '+224', iso: 'GN', name: 'Guinea', flag: '🇬🇳' },
    { code: '+245', iso: 'GW', name: 'Guinea-Bissau', flag: '🇬🇼' },
    { code: '+592', iso: 'GY', name: 'Guyana', flag: '🇬🇾' },
    { code: '+509', iso: 'HT', name: 'Haiti', flag: '🇭🇹' },
    { code: '+266', iso: 'LS', name: 'Lesotho', flag: '🇱🇸' },
    { code: '+231', iso: 'LR', name: 'Liberia', flag: '🇱🇷' },
    { code: '+261', iso: 'MG', name: 'Madagascar', flag: '🇲🇬' },
    { code: '+265', iso: 'MW', name: 'Malawi', flag: '🇲🇼' },
    { code: '+223', iso: 'ML', name: 'Mali', flag: '🇲🇱' },
    { code: '+222', iso: 'MR', name: 'Mauritania', flag: '🇲🇷' },
    { code: '+373', iso: 'MD', name: 'Moldova', flag: '🇲🇩' },
    { code: '+382', iso: 'ME', name: 'Montenegro', flag: '🇲🇪' },
    { code: '+227', iso: 'NE', name: 'Niger', flag: '🇳🇪' },
    { code: '+389', iso: 'MK', name: 'North Macedonia', flag: '🇲🇰' },
    { code: '+248', iso: 'SC', name: 'Seychelles', flag: '🇸🇨' },
    { code: '+232', iso: 'SL', name: 'Sierra Leone', flag: '🇸🇱' },
    { code: '+252', iso: 'SO', name: 'Somalia', flag: '🇸🇴' },
    { code: '+211', iso: 'SS', name: 'South Sudan', flag: '🇸🇸' },
    { code: '+597', iso: 'SR', name: 'Suriname', flag: '🇸🇷' },
    { code: '+228', iso: 'TG', name: 'Togo', flag: '🇹🇬' },
    { code: '+686', iso: 'KI', name: 'Kiribati', flag: '🇰🇮' },
    { code: '+692', iso: 'MH', name: 'Marshall Islands', flag: '🇲🇭' },
    { code: '+691', iso: 'FM', name: 'Micronesia', flag: '🇫🇲' },
    { code: '+674', iso: 'NR', name: 'Nauru', flag: '🇳🇷' },
    { code: '+680', iso: 'PW', name: 'Palau', flag: '🇵🇼' },
    { code: '+685', iso: 'WS', name: 'Samoa', flag: '🇼🇸' },
    { code: '+677', iso: 'SB', name: 'Solomon Islands', flag: '🇸🇧' },
    { code: '+676', iso: 'TO', name: 'Tonga', flag: '🇹🇴' },
    { code: '+688', iso: 'TV', name: 'Tuvalu', flag: '🇹🇻' },
    { code: '+678', iso: 'VU', name: 'Vanuatu', flag: '🇻🇺' },
    { code: '+682', iso: 'CK', name: 'Cook Islands', flag: '🇨🇰' },
    { code: '+689', iso: 'PF', name: 'French Polynesia', flag: '🇵🇫' },
    { code: '+687', iso: 'NC', name: 'New Caledonia', flag: '🇳🇨' },
    { code: '+681', iso: 'WF', name: 'Wallis and Futuna', flag: '🇼🇫' },
    { code: '+683', iso: 'NU', name: 'Niue', flag: '🇳🇺' },
    { code: '+690', iso: 'TK', name: 'Tokelau', flag: '🇹🇰' },
    { code: '+1684', iso: 'AS', name: 'American Samoa', flag: '🇦🇸' },
    { code: '+1670', iso: 'MP', name: 'Northern Mariana Islands', flag: '🇲🇵' },
    { code: '+1264', iso: 'AI', name: 'Anguilla', flag: '🇦🇮' },
    { code: '+1284', iso: 'VG', name: 'British Virgin Islands', flag: '🇻🇬' },
    { code: '+1340', iso: 'VI', name: 'U.S. Virgin Islands', flag: '🇻🇮' },
    { code: '+1664', iso: 'MS', name: 'Montserrat', flag: '🇲🇸' },
    { code: '+1869', iso: 'KN', name: 'Saint Kitts and Nevis', flag: '🇰🇳' },
    { code: '+1758', iso: 'LC', name: 'Saint Lucia', flag: '🇱🇨' },
    { code: '+1784', iso: 'VC', name: 'Saint Vincent and the Grenadines', flag: '🇻🇨' },
    { code: '+1649', iso: 'TC', name: 'Turks and Caicos Islands', flag: '🇹🇨' },
    { code: '+1721', iso: 'SX', name: 'Sint Maarten', flag: '🇸🇽' },
    { code: '+599', iso: 'CW', name: 'Curaçao', flag: '🇨🇼' },
    { code: '+599', iso: 'BQ', name: 'Caribbean Netherlands (Bonaire)', flag: '🇧🇶' },
    { code: '+596', iso: 'MQ', name: 'Martinique', flag: '🇲🇶' },
    { code: '+590', iso: 'BL', name: 'Saint Barthélemy', flag: '🇧🇱' },
    { code: '+590', iso: 'MF', name: 'Saint Martin', flag: '🇲🇫' },
    { code: '+508', iso: 'PM', name: 'Saint Pierre and Miquelon', flag: '🇵🇲' },
    { code: '+299', iso: 'GL', name: 'Greenland', flag: '🇬🇱' },
    { code: '+298', iso: 'FO', name: 'Faroe Islands', flag: '🇫🇴' },
    { code: '+350', iso: 'GI', name: 'Gibraltar', flag: '🇬🇮' },
    { code: '+44', iso: 'IM', name: 'Isle of Man', flag: '🇮🇲' },
    { code: '+44', iso: 'JE', name: 'Jersey', flag: '🇯🇪' },
    { code: '+44', iso: 'GG', name: 'Guernsey', flag: '🇬🇬' },
    { code: '+383', iso: 'XK', name: 'Kosovo', flag: '🇽🇰' },
    { code: '+239', iso: 'ST', name: 'São Tomé and Príncipe', flag: '🇸🇹' },
    { code: '+262', iso: 'RE', name: 'Réunion', flag: '🇷🇪' },
    { code: '+262', iso: 'YT', name: 'Mayotte', flag: '🇾🇹' },
    { code: '+290', iso: 'SH', name: 'Saint Helena', flag: '🇸🇭' },
    { code: '+500', iso: 'FK', name: 'Falkland Islands', flag: '🇫🇰' },
    { code: '+53', iso: 'CU', name: 'Cuba', flag: '🇨🇺' },
    { code: '+963', iso: 'SY', name: 'Syria', flag: '🇸🇾' }
  ];

  function getScriptConfig() {
    const script = document.currentScript ||
      document.querySelector('script[src*="wa-userauth.js"]');

    let apiUrl = '';
    let appKey = 'app_default_demo';

    if (script) {
      try {
        const url = new URL(script.src, window.location.href);
        apiUrl = url.origin;
      } catch (e) {}
      appKey = script.getAttribute('data-app-key') || appKey;
      apiUrl = script.getAttribute('data-api-url') || apiUrl;
    }

    if (!apiUrl) {
      apiUrl = window.location.origin;
    }

    return { apiUrl, appKey };
  }

  const scriptConfig = getScriptConfig();

  function injectStyles() {
    if (document.getElementById('wa-userauth-styles')) return;

    const style = document.createElement('style');
    style.id = 'wa-userauth-styles';
    style.textContent = `
      :root {
        --wa-primary: #128c7e;
        --wa-primary-hover: #075e54;
        --wa-accent: #25d366;
        --wa-bg: #0f172a;
        --wa-card: #1e293b;
        --wa-text: #f8fafc;
        --wa-muted: #94a3b8;
        --wa-border: #334155;
        --wa-error: #ef4444;
        --wa-error-bg: rgba(239, 68, 68, 0.12);
        --wa-success: #10b981;
      }

      .wa-backdrop {
        position: fixed;
        inset: 0;
        width: 100%;
        height: 100%;
        background: rgba(15, 23, 42, 0.78);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        z-index: 2147483647;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.25s ease, visibility 0.25s ease;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        box-sizing: border-box;
      }

      .wa-backdrop * {
        box-sizing: border-box;
      }

      .wa-backdrop.active {
        opacity: 1;
        visibility: visible;
      }

      .wa-modal {
        position: relative;
        width: 440px;
        max-width: 92vw;
        background: var(--wa-card);
        color: var(--wa-text);
        border: 1px solid var(--wa-border);
        border-radius: 20px;
        box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05);
        overflow: hidden;
        transform: scale(0.96) translateY(12px);
        transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
        display: flex;
        flex-direction: column;
        min-height: 480px;
      }

      .wa-backdrop.active .wa-modal {
        transform: scale(1) translateY(0);
      }

      .wa-header {
        position: relative;
        padding: 22px 24px 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      }

      .wa-brand {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .wa-brand-icon {
        width: 38px;
        height: 38px;
        background: linear-gradient(135deg, #25d366 0%, #128c7e 100%);
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ffffff;
        box-shadow: 0 4px 12px rgba(37, 211, 102, 0.25);
      }

      .wa-brand-title {
        font-size: 17px;
        font-weight: 700;
        color: #ffffff;
        letter-spacing: -0.3px;
        margin: 0;
      }

      .wa-brand-subtitle {
        font-size: 12px;
        color: var(--wa-muted);
        margin: 0;
      }

      .wa-close-btn {
        background: rgba(255, 255, 255, 0.08);
        border: none;
        color: var(--wa-muted);
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 18px;
        transition: background 0.15s, color 0.15s;
      }

      .wa-close-btn:hover {
        background: rgba(255, 255, 255, 0.15);
        color: #ffffff;
      }

      .wa-body {
        padding: 24px;
        display: flex;
        flex-direction: column;
        gap: 18px;
        flex: 1;
      }

      .wa-title-wrap h3 {
        margin: 0 0 6px;
        font-size: 18px;
        font-weight: 600;
        color: #ffffff;
      }

      .wa-title-wrap p {
        margin: 0;
        font-size: 13px;
        color: var(--wa-muted);
        line-height: 1.5;
      }

      .wa-error-alert {
        padding: 10px 14px;
        background: var(--wa-error-bg);
        border: 1px solid rgba(239, 68, 68, 0.35);
        border-radius: 10px;
        color: #fca5a5;
        font-size: 13px;
        line-height: 1.4;
        display: none;
      }

      .wa-error-alert.show {
        display: block;
      }

      .wa-field {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .wa-label {
        font-size: 12px;
        font-weight: 600;
        color: var(--wa-muted);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .wa-input-row {
        position: relative;
        display: flex;
        gap: 8px;
      }

      .wa-country-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 0 12px;
        height: 48px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid var(--wa-border);
        border-radius: 10px;
        color: #ffffff;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: border-color 0.15s, background 0.15s;
        white-space: nowrap;
        user-select: none;
      }

      .wa-country-btn:hover {
        border-color: #475569;
        background: rgba(255, 255, 255, 0.08);
      }

      .wa-input {
        width: 100%;
        height: 48px;
        padding: 0 14px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid var(--wa-border);
        border-radius: 10px;
        color: #ffffff;
        font-size: 15px;
        outline: none;
        transition: border-color 0.15s, box-shadow 0.15s;
      }

      .wa-input:focus {
        border-color: var(--wa-accent);
        box-shadow: 0 0 0 2px rgba(37, 211, 102, 0.2);
      }

      .wa-input::placeholder {
        color: #64748b;
      }

      /* ============================================================
         GLITCH-FREE IN-MODAL COUNTRY PICKER OVERLAY (FULL HEIGHT)
         ============================================================ */
      .wa-country-view {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        width: 100%;
        height: 100%;
        background: var(--wa-card);
        z-index: 60;
        display: none;
        flex-direction: column;
        border-radius: 20px;
        box-sizing: border-box;
        overflow: hidden;
        animation: wa-slide-up 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      }

      @keyframes wa-slide-up {
        from { opacity: 0; transform: translateY(12px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .wa-country-view.open {
        display: flex;
      }

      .wa-country-topbar {
        padding: 16px 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }

      .wa-country-back-btn {
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid var(--wa-border);
        color: #ffffff;
        padding: 6px 14px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: background 0.15s;
      }

      .wa-country-back-btn:hover {
        background: rgba(255, 255, 255, 0.12);
      }

      .wa-country-search-bar {
        padding: 12px 18px;
        display: flex;
        align-items: center;
        gap: 10px;
        background: rgba(0, 0, 0, 0.25);
        border-bottom: 1px solid var(--wa-border);
      }

      .wa-country-search-input {
        width: 100%;
        background: transparent;
        border: none;
        color: #ffffff;
        font-size: 14px;
        outline: none;
      }

      .wa-country-search-input::placeholder {
        color: #64748b;
      }

      .wa-country-scroll-list {
        flex: 1 1 0;
        min-height: 0;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        list-style: none;
        margin: 0;
        padding: 8px 12px 28px;
        box-sizing: border-box;
      }

      /* Custom Dark Scrollbar */
      .wa-country-scroll-list::-webkit-scrollbar {
        width: 6px;
      }
      .wa-country-scroll-list::-webkit-scrollbar-track {
        background: rgba(15, 23, 42, 0.6);
      }
      .wa-country-scroll-list::-webkit-scrollbar-thumb {
        background: #334155;
        border-radius: 4px;
      }
      .wa-country-scroll-list::-webkit-scrollbar-thumb:hover {
        background: #475569;
      }

      .wa-country-item {
        padding: 10px 14px;
        display: flex;
        align-items: center;
        gap: 12px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        color: #e2e8f0;
        transition: background 0.12s;
      }

      .wa-country-item:hover {
        background: rgba(255, 255, 255, 0.08);
      }

      .wa-country-item.selected {
        background: rgba(37, 211, 102, 0.15);
        color: #a7f3d0;
      }

      .wa-country-item .flag {
        font-size: 18px;
      }

      .wa-country-item .name {
        flex: 1;
        font-weight: 500;
      }

      .wa-country-item .dial {
        color: #38bdf8;
        font-family: monospace;
        font-weight: 600;
        font-size: 13px;
      }

      /* ============================================================
         REAL ALPHANUMERIC TEXT-NUMERIC CAPTCHA STYLES
         ============================================================ */
      .wa-captcha-box {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 12px;
        background: rgba(0, 0, 0, 0.2);
        border: 1px solid var(--wa-border);
        border-radius: 12px;
      }

      .wa-captcha-visual-row {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .wa-captcha-svg-container {
        flex: 1;
        height: 52px;
        background: #090d16;
        border: 1px solid var(--wa-border);
        border-radius: 8px;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .wa-captcha-svg-container svg {
        width: 100%;
        height: 100%;
        display: block;
      }

      .wa-captcha-reload-btn {
        width: 52px;
        height: 52px;
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid var(--wa-border);
        border-radius: 8px;
        color: var(--wa-muted);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.15s;
        flex-shrink: 0;
      }

      .wa-captcha-reload-btn:hover {
        background: rgba(255, 255, 255, 0.12);
        color: #ffffff;
        border-color: var(--wa-accent);
      }

      .wa-captcha-input {
        letter-spacing: 3px;
        font-family: monospace;
        font-size: 17px;
        text-transform: uppercase;
        font-weight: 700;
        text-align: center;
      }

      /* OTP Digits Row */
      .wa-otp-row {
        display: flex;
        gap: 8px;
        justify-content: center;
        margin: 8px 0;
      }

      .wa-otp-digit {
        width: 48px;
        height: 54px;
        text-align: center;
        font-size: 22px;
        font-weight: 700;
        color: #ffffff;
        background: rgba(255, 255, 255, 0.06);
        border: 1.5px solid var(--wa-border);
        border-radius: 10px;
        outline: none;
        transition: all 0.15s ease;
      }

      .wa-otp-digit:focus {
        border-color: var(--wa-accent);
        background: rgba(37, 211, 102, 0.08);
        box-shadow: 0 0 0 2px rgba(37, 211, 102, 0.25);
        transform: translateY(-2px);
      }

      /* Action Buttons */
      .wa-btn {
        width: 100%;
        height: 48px;
        background: linear-gradient(135deg, #25d366 0%, #128c7e 100%);
        border: none;
        border-radius: 10px;
        color: #ffffff;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        transition: all 0.18s ease;
        box-shadow: 0 4px 14px rgba(37, 211, 102, 0.3);
      }

      .wa-btn:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 6px 18px rgba(37, 211, 102, 0.4);
      }

      .wa-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        box-shadow: none;
        transform: none;
      }

      .wa-resend-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 13px;
        color: var(--wa-muted);
      }

      .wa-link-btn {
        background: none;
        border: none;
        color: var(--wa-accent);
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        padding: 0;
        transition: opacity 0.15s;
      }

      .wa-link-btn:disabled {
        color: #64748b;
        cursor: not-allowed;
      }

      .wa-link-btn:hover:not(:disabled) {
        text-decoration: underline;
      }

      .wa-spinner {
        width: 18px;
        height: 18px;
        border: 2px solid rgba(255, 255, 255, 0.2);
        border-top-color: #ffffff;
        border-radius: 50%;
        animation: wa-spin 0.6s linear infinite;
        display: inline-block;
      }

      @keyframes wa-spin {
        to { transform: rotate(360deg); }
      }

      .wa-success-view {
        text-align: center;
        padding: 24px 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 14px;
      }

      .wa-success-icon {
        width: 60px;
        height: 60px;
        background: rgba(16, 185, 129, 0.15);
        border: 2px solid var(--wa-success);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--wa-success);
        font-size: 30px;
        animation: wa-bounce 0.4s ease;
      }

      @keyframes wa-bounce {
        0% { transform: scale(0.6); opacity: 0; }
        70% { transform: scale(1.15); }
        100% { transform: scale(1); opacity: 1; }
      }

      /* Mobile Drawer layout */
      @media (max-width: 767px) {
        .wa-backdrop {
          align-items: flex-end !important;
          padding: 0 !important;
        }

        .wa-modal {
          width: 100% !important;
          max-width: 100% !important;
          border-radius: 24px 24px 0 0 !important;
          border-bottom: none !important;
          transform: translateY(100%) !important;
          min-height: 520px;
        }

        .wa-backdrop.active .wa-modal {
          transform: translateY(0) !important;
        }

        .wa-country-view {
          border-radius: 24px 24px 0 0 !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  class WAUserAuthModal {
    constructor(options = {}) {
      this.options = Object.assign({
        appKey: scriptConfig.appKey || 'app_default_demo',
        apiUrl: scriptConfig.apiUrl || window.location.origin,
        onSuccess: null,
        onError: null,
        onClose: null
      }, options);

      this.currentCountry = COUNTRIES[0]; // +91 India default
      this.step = 'phone';
      this.mobile = '';
      this.fullName = '';
      this.email = '';

      // Alphanumeric CAPTCHA challenge state
      this.captchaId = '';
      this.captchaSvg = '';
      this.captchaProvider = 'alphanumeric';

      this.resendTimer = null;
      this.resendCountdown = 0;

      this.initDom();
    }

    initDom() {
      injectStyles();

      let existing = document.getElementById('wa-userauth-backdrop');
      if (existing) existing.remove();

      this.backdrop = document.createElement('div');
      this.backdrop.id = 'wa-userauth-backdrop';
      this.backdrop.className = 'wa-backdrop';

      this.backdrop.innerHTML = `
        <div class="wa-modal" id="wa-userauth-modal">
          <div class="wa-header">
            <div class="wa-brand">
              <div class="wa-brand-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 15 3.8 13.47 3.8 11.91C3.81 7.37 7.5 3.67 12.05 3.67M9.53 7.35C9.37 7.35 9.1 7.41 8.88 7.65C8.65 7.89 8.02 8.49 8.02 9.71C8.02 10.93 8.91 12.11 9.03 12.27C9.16 12.43 10.74 14.86 13.16 15.91C15.17 16.78 15.58 16.61 16.02 16.57C16.46 16.53 17.44 15.99 17.65 15.42C17.85 14.85 17.85 14.36 17.79 14.26C17.73 14.16 17.57 14.1 17.31 13.97C17.05 13.84 15.77 13.21 15.53 13.12C15.3 13.04 15.13 13 14.96 13.24C14.8 13.49 14.33 14.04 14.19 14.2C14.05 14.37 13.91 14.39 13.65 14.26C13.39 14.13 12.56 13.86 11.57 12.98C10.8 12.29 10.28 11.44 10.14 11.2C10 10.96 10.12 10.82 10.25 10.69C10.37 10.57 10.52 10.38 10.65 10.22C10.79 10.06 10.83 9.94 10.92 9.78C11.01 9.62 10.96 9.47 10.9 9.35C10.84 9.23 10.36 8.05 10.16 7.57C9.97 7.1 9.77 7.17 9.62 7.16C9.48 7.15 9.32 7.35 9.53 7.35Z"/>
                </svg>
              </div>
              <div>
                <h4 class="wa-brand-title">WA-USERAUTH</h4>
                <p class="wa-brand-subtitle">WhatsApp OTP Login</p>
              </div>
            </div>
            <button class="wa-close-btn" id="wa-btn-close" aria-label="Close modal">&times;</button>
          </div>

          <div class="wa-body" id="wa-modal-body">
            <!-- Step Content Injected Here -->
          </div>

          <!-- Glitch-Free In-Modal Country Picker Overlay -->
          <div class="wa-country-view" id="wa-country-view">
            <div class="wa-country-topbar">
              <button type="button" class="wa-country-back-btn" id="wa-country-back-btn">
                <span>← Back</span>
              </button>
              <h4 style="margin:0; font-size:15px; font-weight:700; color:#ffffff;">Select Country</h4>
              <div style="width:40px;"></div>
            </div>
            <div class="wa-country-search-bar">
              <span style="font-size:14px; color:#64748b;">🔍</span>
              <input type="text" class="wa-country-search-input" id="wa-country-search-input" placeholder="Search by country name or code (+91, +1, UK...)" />
            </div>
            <ul class="wa-country-scroll-list" id="wa-country-scroll-list">
              <!-- Dynamically populated -->
            </ul>
          </div>
        </div>
      `;

      document.body.appendChild(this.backdrop);

      // Event handlers: backdrop click & close button
      this.backdrop.addEventListener('click', (e) => {
        if (e.target === this.backdrop) {
          this.close('backdrop_click');
        }
      });

      this.backdrop.querySelector('#wa-btn-close').addEventListener('click', () => {
        this.close('close_button');
      });

      // Escape key to close
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.backdrop.classList.contains('active')) {
          const countryView = document.getElementById('wa-country-view');
          if (countryView && countryView.classList.contains('open')) {
            countryView.classList.remove('open');
            document.getElementById('wa-input-phone')?.focus();
            return;
          }
          this.close('escape_key');
        }
      });
    }

    async open() {
      this.backdrop.classList.add('active');
      await this.loadCaptchaChallenge();
      this.renderPhoneStep();
    }

    close(reason = 'user_action') {
      clearInterval(this.resendTimer);
      this.backdrop.classList.remove('active');

      const detail = { reason, timestamp: new Date().toISOString() };
      WAUserAuthModal._emitEvent('wa-userauth:close', detail);

      if (typeof this.options.onClose === 'function') {
        try { this.options.onClose(detail); } catch (e) {}
      }
    }

    async loadCaptchaChallenge() {
      try {
        const res = await fetch(`${this.options.apiUrl}/api/v1/auth/captcha/new`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.success) {
            this.captchaId = data.captchaId;
            this.captchaSvg = data.svg;
            this.captchaProvider = data.provider || 'alphanumeric';
            return;
          }
        }
      } catch (e) {}

      // Fallback local challenge if offline
      this.captchaId = `offline_cap_${Date.now()}`;
      this.captchaSvg = `<svg width="180" height="52" viewBox="0 0 180 52" style="background:#090d16; border-radius:8px;"><text x="35" y="35" fill="#34d399" font-size="26" font-weight="bold">8K4Y2</text></svg>`;
    }

    showError(msg) {
      const el = document.getElementById('wa-error-alert');
      if (el) {
        el.textContent = msg;
        el.classList.add('show');
      }
    }

    hideError() {
      const el = document.getElementById('wa-error-alert');
      if (el) {
        el.textContent = '';
        el.classList.remove('show');
      }
    }

    // STEP 1: Phone input & Alphanumeric CAPTCHA
    renderPhoneStep() {
      this.step = 'phone';
      const body = document.getElementById('wa-modal-body');

      body.innerHTML = `
        <div class="wa-title-wrap">
          <h3>Enter your mobile number</h3>
          <p>We'll send a 6-digit verification code to your WhatsApp.</p>
        </div>

        <div class="wa-error-alert" id="wa-error-alert"></div>

        <div class="wa-field">
          <label class="wa-label">WhatsApp Number</label>
          <div class="wa-input-row">
            <button type="button" class="wa-country-btn" id="wa-country-open-btn">
              <span>${this.currentCountry.flag}</span>
              <span>${this.currentCountry.code}</span>
              <svg width="10" height="6" viewBox="0 0 10 6" fill="currentColor"><path d="M1 1L5 5L9 1"/></svg>
            </button>
            <input type="tel" class="wa-input" id="wa-input-phone" placeholder="98765 43210" value="${this.mobile}" autofocus />
          </div>
        </div>

        <div id="wa-signup-fields" style="display: none; flex-direction: column; gap: 14px;">
          <div class="wa-field">
            <label class="wa-label">Full Name</label>
            <input type="text" class="wa-input" id="wa-input-name" placeholder="John Doe" value="${this.fullName}" />
          </div>
          <div class="wa-field">
            <label class="wa-label">Email Address</label>
            <input type="email" class="wa-input" id="wa-input-email" placeholder="john@example.com" value="${this.email}" />
          </div>
        </div>

        <!-- Real Alphanumeric Text-Numeric CAPTCHA -->
        <div class="wa-field">
          <label class="wa-label">Security Verification (Type characters)</label>
          <div class="wa-captcha-box">
            <div class="wa-captcha-visual-row">
              <div class="wa-captcha-svg-container" id="wa-captcha-svg-display">
                ${this.captchaSvg}
              </div>
              <button type="button" class="wa-captcha-reload-btn" id="wa-captcha-refresh-btn" title="Refresh CAPTCHA">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              </button>
            </div>
            <input type="text" class="wa-input wa-captcha-input" id="wa-captcha-user-input" placeholder="Enter characters above" maxlength="8" autocomplete="off" />
          </div>
        </div>

        <button class="wa-btn" id="wa-btn-submit-phone">
          <span>Continue</span>
        </button>
      `;

      this.bindCountryPicker();
      this.bindCaptchaRefresh();

      const phoneInput = document.getElementById('wa-input-phone');
      const submitBtn = document.getElementById('wa-btn-submit-phone');
      const captchaInput = document.getElementById('wa-captcha-user-input');

      submitBtn.addEventListener('click', async () => {
        await this.handlePhoneSubmit();
      });

      phoneInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.handlePhoneSubmit();
      });

      captchaInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.handlePhoneSubmit();
      });
    }

    bindCountryPicker() {
      const openBtn = document.getElementById('wa-country-open-btn');
      const view = document.getElementById('wa-country-view');
      const backBtn = document.getElementById('wa-country-back-btn');
      const searchInput = document.getElementById('wa-country-search-input');
      const scrollList = document.getElementById('wa-country-scroll-list');

      const renderList = (filtered = COUNTRIES) => {
        scrollList.innerHTML = filtered.map(c => `
          <li class="wa-country-item ${c.code === this.currentCountry.code && c.iso === this.currentCountry.iso ? 'selected' : ''}" data-iso="${c.iso}" data-code="${c.code}">
            <span class="flag">${c.flag}</span>
            <span class="name">${c.name}</span>
            <span class="dial">${c.code}</span>
          </li>
        `).join('');
      };

      openBtn.addEventListener('click', () => {
        view.classList.add('open');
        renderList(COUNTRIES);
        searchInput.value = '';
        setTimeout(() => searchInput.focus(), 50);
      });

      backBtn.addEventListener('click', () => {
        view.classList.remove('open');
        document.getElementById('wa-input-phone')?.focus();
      });

      searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase().trim();
        if (!query) {
          renderList(COUNTRIES);
          return;
        }
        const filtered = COUNTRIES.filter(c =>
          c.name.toLowerCase().includes(query) ||
          c.code.includes(query) ||
          c.code.replace('+', '').includes(query) ||
          c.iso.toLowerCase().includes(query)
        );
        renderList(filtered);
      });

      scrollList.addEventListener('click', (e) => {
        const item = e.target.closest('.wa-country-item');
        if (item) {
          const iso = item.getAttribute('data-iso');
          const found = COUNTRIES.find(c => c.iso === iso);
          if (found) {
            this.currentCountry = found;
            openBtn.innerHTML = `
              <span>${found.flag}</span>
              <span>${found.code}</span>
              <svg width="10" height="6" viewBox="0 0 10 6" fill="currentColor"><path d="M1 1L5 5L9 1"/></svg>
            `;
            view.classList.remove('open');
            document.getElementById('wa-input-phone')?.focus();
          }
        }
      });
    }

    bindCaptchaRefresh() {
      const refreshBtn = document.getElementById('wa-captcha-refresh-btn');
      if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
          refreshBtn.style.transform = 'rotate(180deg)';
          await this.loadCaptchaChallenge();
          const svgBox = document.getElementById('wa-captcha-svg-display');
          if (svgBox) svgBox.innerHTML = this.captchaSvg;
          const input = document.getElementById('wa-captcha-user-input');
          if (input) {
            input.value = '';
            input.focus();
          }
          setTimeout(() => { refreshBtn.style.transform = 'none'; }, 200);
        });
      }
    }

    async handlePhoneSubmit() {
      this.hideError();
      const phoneInput = document.getElementById('wa-input-phone');
      const submitBtn = document.getElementById('wa-btn-submit-phone');
      const captchaInput = document.getElementById('wa-captcha-user-input');

      const rawNumber = (phoneInput.value || '').trim().replace(/[^0-9]/g, '');

      if (!rawNumber || rawNumber.length < 6) {
        this.showError('Please enter a valid mobile number.');
        return;
      }

      const fullMobile = `${this.currentCountry.code}${rawNumber}`;
      this.mobile = fullMobile;

      const signupDiv = document.getElementById('wa-signup-fields');
      const isSignupVisible = signupDiv.style.display !== 'none';

      const enteredCaptcha = (captchaInput?.value || '').trim();
      if (!enteredCaptcha) {
        this.showError('Please enter the characters shown in the CAPTCHA image.');
        captchaInput?.focus();
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="wa-spinner"></span> <span>Checking...</span>`;

      try {
        // Step 1: Check user existence
        if (!isSignupVisible) {
          const checkRes = await fetch(`${this.options.apiUrl}/api/v1/auth/check-user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mobile: fullMobile, appKey: this.options.appKey })
          });

          const checkData = await checkRes.json();
          if (!checkRes.ok) {
            throw new Error(checkData.error || 'Failed to verify account.');
          }

          if (!checkData.exists) {
            // New account: show name and email fields
            signupDiv.style.display = 'flex';
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<span>Send WhatsApp Code</span>`;
            document.getElementById('wa-input-name')?.focus();
            return;
          }
        }

        // If new account signup fields are visible:
        if (isSignupVisible) {
          const nameInput = document.getElementById('wa-input-name');
          const emailInput = document.getElementById('wa-input-email');
          this.fullName = (nameInput.value || '').trim();
          this.email = (emailInput.value || '').trim();

          if (!this.fullName) {
            this.showError('Please enter your full name.');
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<span>Send WhatsApp Code</span>`;
            return;
          }

          if (!this.email || !this.email.includes('@') || !this.email.includes('.')) {
            this.showError('Please enter a valid email address.');
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<span>Send WhatsApp Code</span>`;
            return;
          }
        }

        // Step 2: Dispatch OTP
        submitBtn.innerHTML = `<span class="wa-spinner"></span> <span>Sending code...</span>`;

        const sendRes = await fetch(`${this.options.apiUrl}/api/v1/auth/otp/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mobile: fullMobile,
            captchaId: this.captchaId,
            captchaCode: enteredCaptcha,
            isResend: false,
            name: this.fullName,
            email: this.email,
            appKey: this.options.appKey
          })
        });

        const sendData = await sendRes.json();

        if (!sendRes.ok) {
          // If CAPTCHA was wrong or failed, reload a fresh one
          await this.loadCaptchaChallenge();
          const svgBox = document.getElementById('wa-captcha-svg-display');
          if (svgBox) svgBox.innerHTML = this.captchaSvg;
          if (captchaInput) {
            captchaInput.value = '';
            captchaInput.focus();
          }
          throw new Error(sendData.error || `Failed to send code (HTTP ${sendRes.status})`);
        }

        // Transition to OTP screen
        this.startResendCountdown(sendData.resendCooldown || 60);
        this.renderOtpStep();
      } catch (err) {
        this.showError(err.message);
        submitBtn.disabled = false;
        submitBtn.innerHTML = isSignupVisible ? `<span>Send WhatsApp Code</span>` : `<span>Continue</span>`;
      }
    }

    startResendCountdown(seconds) {
      clearInterval(this.resendTimer);
      this.resendCountdown = seconds;
      this.resendTimer = setInterval(() => {
        this.resendCountdown -= 1;
        const btn = document.getElementById('wa-btn-resend');
        if (btn) {
          if (this.resendCountdown > 0) {
            btn.disabled = true;
            btn.textContent = `Resend in ${this.resendCountdown}s`;
          } else {
            btn.disabled = false;
            btn.textContent = `Resend Code`;
            clearInterval(this.resendTimer);
          }
        }
      }, 1000);
    }

    // STEP 2: OTP Verification
    renderOtpStep() {
      this.step = 'otp';
      const body = document.getElementById('wa-modal-body');

      body.innerHTML = `
        <div class="wa-title-wrap">
          <h3>Verify WhatsApp Code</h3>
          <p>Enter the 6-digit verification code sent to <strong>${this.mobile}</strong>.</p>
        </div>

        <div class="wa-error-alert" id="wa-error-alert"></div>

        <div class="wa-otp-row" id="wa-otp-inputs">
          <input type="text" maxlength="1" class="wa-otp-digit" data-idx="0" inputmode="numeric" autofocus />
          <input type="text" maxlength="1" class="wa-otp-digit" data-idx="1" inputmode="numeric" />
          <input type="text" maxlength="1" class="wa-otp-digit" data-idx="2" inputmode="numeric" />
          <input type="text" maxlength="1" class="wa-otp-digit" data-idx="3" inputmode="numeric" />
          <input type="text" maxlength="1" class="wa-otp-digit" data-idx="4" inputmode="numeric" />
          <input type="text" maxlength="1" class="wa-otp-digit" data-idx="5" inputmode="numeric" />
        </div>

        <div class="wa-resend-row">
          <button type="button" class="wa-link-btn" id="wa-btn-change-number">Change Number</button>
          <button type="button" class="wa-link-btn" id="wa-btn-resend" disabled>
            ${this.resendCountdown > 0 ? `Resend in ${this.resendCountdown}s` : 'Resend Code'}
          </button>
        </div>

        <!-- Fresh CAPTCHA Box for Resend -->
        <div id="wa-resend-captcha-box" style="display: none; flex-direction: column; gap: 8px;">
          <label class="wa-label">Security Check (Solve to Resend)</label>
          <div class="wa-captcha-visual-row">
            <div class="wa-captcha-svg-container" id="wa-resend-svg-box"></div>
            <button type="button" class="wa-captcha-reload-btn" id="wa-resend-refresh-btn" title="Refresh">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            </button>
          </div>
          <input type="text" class="wa-input wa-captcha-input" id="wa-resend-captcha-input" placeholder="Enter characters" maxlength="8" autocomplete="off" />
        </div>

        <button class="wa-btn" id="wa-btn-verify-otp">
          <span>Verify & Login</span>
        </button>
      `;

      this.bindOtpInputs();

      document.getElementById('wa-btn-change-number').addEventListener('click', () => {
        clearInterval(this.resendTimer);
        this.renderPhoneStep();
      });

      const resendBtn = document.getElementById('wa-btn-resend');
      resendBtn.addEventListener('click', async () => {
        await this.handleResend();
      });

      document.getElementById('wa-btn-verify-otp').addEventListener('click', async () => {
        await this.handleOtpVerify();
      });
    }

    bindOtpInputs() {
      const inputs = Array.from(document.querySelectorAll('.wa-otp-digit'));

      inputs.forEach((input, idx) => {
        input.addEventListener('input', (e) => {
          const val = e.target.value.replace(/[^0-9]/g, '');
          e.target.value = val ? val[val.length - 1] : '';

          if (val && idx < inputs.length - 1) {
            inputs[idx + 1].focus();
          }

          const fullCode = inputs.map(i => i.value).join('');
          if (fullCode.length === 6) {
            this.handleOtpVerify();
          }
        });

        input.addEventListener('keydown', (e) => {
          if (e.key === 'Backspace' && !input.value && idx > 0) {
            inputs[idx - 1].focus();
          }
          if (e.key === 'Enter') {
            this.handleOtpVerify();
          }
        });

        input.addEventListener('paste', (e) => {
          e.preventDefault();
          const paste = (e.clipboardData || window.clipboardData).getData('text');
          const clean = paste.replace(/[^0-9]/g, '').slice(0, 6);
          if (clean.length > 0) {
            clean.split('').forEach((char, i) => {
              if (inputs[i]) inputs[i].value = char;
            });
            const nextIdx = Math.min(clean.length, inputs.length - 1);
            inputs[nextIdx].focus();
            if (clean.length === 6) {
              this.handleOtpVerify();
            }
          }
        });
      });

      if (inputs[0]) inputs[0].focus();
    }

    async handleResend() {
      this.hideError();
      const resendBox = document.getElementById('wa-resend-captcha-box');
      const resendInput = document.getElementById('wa-resend-captcha-input');
      const resendSvgBox = document.getElementById('wa-resend-svg-box');

      // Requirement: fresh valid CAPTCHA required for resend
      if (resendBox.style.display === 'none') {
        resendBox.style.display = 'flex';
        await this.loadCaptchaChallenge();
        if (resendSvgBox) resendSvgBox.innerHTML = this.captchaSvg;

        document.getElementById('wa-resend-refresh-btn')?.addEventListener('click', async () => {
          await this.loadCaptchaChallenge();
          if (resendSvgBox) resendSvgBox.innerHTML = this.captchaSvg;
          if (resendInput) { resendInput.value = ''; resendInput.focus(); }
        });

        this.showError('Please solve the security challenge before requesting a new code.');
        resendInput?.focus();
        return;
      }

      const enteredCode = (resendInput?.value || '').trim();
      if (!enteredCode) {
        this.showError('Please enter the characters shown in the CAPTCHA image.');
        resendInput?.focus();
        return;
      }

      const resendBtn = document.getElementById('wa-btn-resend');
      resendBtn.disabled = true;
      resendBtn.textContent = 'Resending...';

      try {
        const res = await fetch(`${this.options.apiUrl}/api/v1/auth/otp/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mobile: this.mobile,
            captchaId: this.captchaId,
            captchaCode: enteredCode,
            isResend: true,
            appKey: this.options.appKey
          })
        });

        const data = await res.json();

        if (!res.ok) {
          await this.loadCaptchaChallenge();
          if (resendSvgBox) resendSvgBox.innerHTML = this.captchaSvg;
          if (resendInput) { resendInput.value = ''; resendInput.focus(); }
          throw new Error(data.error || 'Failed to resend code.');
        }

        resendBox.style.display = 'none';
        this.startResendCountdown(data.resendCooldown || 60);

        document.querySelectorAll('.wa-otp-digit').forEach(i => { i.value = ''; });
        document.querySelector('.wa-otp-digit')?.focus();
      } catch (err) {
        this.showError(err.message);
        resendBtn.disabled = false;
        resendBtn.textContent = 'Resend Code';
      }
    }

    async handleOtpVerify() {
      this.hideError();
      const inputs = Array.from(document.querySelectorAll('.wa-otp-digit'));
      const code = inputs.map(i => i.value).join('');

      if (code.length !== 6) {
        this.showError('Please enter all 6 digits of the verification code.');
        return;
      }

      const verifyBtn = document.getElementById('wa-btn-verify-otp');
      verifyBtn.disabled = true;
      verifyBtn.innerHTML = `<span class="wa-spinner"></span> <span>Verifying...</span>`;

      try {
        const res = await fetch(`${this.options.apiUrl}/api/v1/auth/otp/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mobile: this.mobile,
            otp: code,
            appKey: this.options.appKey
          })
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Verification code failed.');
        }

        this.renderSuccessStep(data);
      } catch (err) {
        this.showError(err.message);
        verifyBtn.disabled = false;
        verifyBtn.innerHTML = `<span>Verify & Login</span>`;
        inputs.forEach(i => { i.value = ''; });
        inputs[0]?.focus();

        const errDetail = { error: err.message, mobile: this.mobile };
        WAUserAuthModal._emitEvent('wa-userauth:error', errDetail);
        if (typeof this.options.onError === 'function') {
          try { this.options.onError(errDetail); } catch (e) {}
        }
      }
    }

    renderSuccessStep(authResult) {
      this.step = 'success';
      const body = document.getElementById('wa-modal-body');

      body.innerHTML = `
        <div class="wa-success-view">
          <div class="wa-success-icon">✓</div>
          <h3 style="margin: 0; color: #ffffff; font-size: 20px;">Authenticated</h3>
          <p style="margin: 0; color: var(--wa-muted); font-size: 14px;">
            Welcome, <strong>${authResult.user?.name || authResult.user?.mobile}</strong>!
          </p>
        </div>
      `;

      WAUserAuthModal._emitEvent('wa-userauth:success', authResult);

      if (typeof this.options.onSuccess === 'function') {
        try { this.options.onSuccess(authResult); } catch (e) {}
      }

      setTimeout(() => {
        this.close('completed');
      }, 1200);
    }

    static _emitEvent(name, detail) {
      try {
        const ev = new CustomEvent(name, { detail, bubbles: true, cancelable: true });
        window.dispatchEvent(ev);
        document.dispatchEvent(ev);
      } catch (e) {}
    }
  }

  let activeInstance = null;

  const WAUserAuth = {
    __INITIALIZED__: true,

    open: function (opts = {}) {
      if (activeInstance) {
        activeInstance.close();
      }
      activeInstance = new WAUserAuthModal(opts);
      activeInstance.open();
      return activeInstance;
    },

    close: function () {
      if (activeInstance) {
        activeInstance.close();
        activeInstance = null;
      }
    }
  };

  document.addEventListener('click', function (e) {
    const btn = e.target && e.target.closest && e.target.closest('[data-wa-userauth]');
    if (btn) {
      e.preventDefault();

      const appKey = btn.getAttribute('data-app-key') || scriptConfig.appKey || 'app_default_demo';
      const apiUrl = btn.getAttribute('data-api-url') || scriptConfig.apiUrl;
      const callbackName = btn.getAttribute('data-on-success');

      let successCallback = null;
      if (callbackName && typeof window[callbackName] === 'function') {
        successCallback = window[callbackName];
      }

      WAUserAuth.open({
        appKey,
        apiUrl,
        onSuccess: successCallback
      });
    }
  });

  window.WAUserAuth = WAUserAuth;

})(window, document);
