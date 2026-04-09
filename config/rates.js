/*
  DialAfrica Route + Rate Configuration
  All rates are in pence per minute
*/

const rates = {
  "+213": { country: "Algeria", rate: 12, active: true },
  "+244": { country: "Angola", rate: 14, active: true },
  "+229": { country: "Benin", rate: 13, active: true },
  "+267": { country: "Botswana", rate: 11, active: true },
  "+226": { country: "Burkina Faso", rate: 14, active: true },
  "+257": { country: "Burundi", rate: 15, active: true },
  "+238": { country: "Cape Verde", rate: 16, active: true },
  "+237": { country: "Cameroon", rate: 13, active: true },
  "+236": { country: "Central African Republic", rate: 15, active: true },
  "+235": { country: "Chad", rate: 15, active: true },
  "+269": { country: "Comoros", rate: 16, active: true },
  "+242": { country: "Congo", rate: 13, active: true },
  "+243": { country: "DR Congo", rate: 14, active: true },
  "+253": { country: "Djibouti", rate: 16, active: true },
  "+20":  { country: "Egypt", rate: 10, active: true },
  "+240": { country: "Equatorial Guinea", rate: 14, active: true },
  "+291": { country: "Eritrea", rate: 16, active: true },
  "+251": { country: "Ethiopia", rate: 13, active: true },
  "+241": { country: "Gabon", rate: 13, active: true },
  "+220": { country: "Gambia", rate: 12, active: true },
  "+233": { country: "Ghana", rate: 12, active: true },
  "+224": { country: "Guinea", rate: 14, active: true },
  "+245": { country: "Guinea-Bissau", rate: 15, active: true },
  "+254": { country: "Kenya", rate: 11, active: true },
  "+266": { country: "Lesotho", rate: 12, active: true },
  "+231": { country: "Liberia", rate: 14, active: true },
  "+218": { country: "Libya", rate: 13, active: true },
  "+261": { country: "Madagascar", rate: 15, active: true },
  "+265": { country: "Malawi", rate: 13, active: true },
  "+223": { country: "Mali", rate: 14, active: true },
  "+222": { country: "Mauritania", rate: 14, active: true },
  "+230": { country: "Mauritius", rate: 11, active: true },
  "+212": { country: "Morocco", rate: 10, active: true },
  "+258": { country: "Mozambique", rate: 13, active: true },
  "+264": { country: "Namibia", rate: 11, active: true },
  "+227": { country: "Niger", rate: 14, active: true },
  "+234": { country: "Nigeria", rate: 12, active: true },
  "+250": { country: "Rwanda", rate: 12, active: true },
  "+239": { country: "Sao Tome and Principe", rate: 16, active: true },
  "+221": { country: "Senegal", rate: 13, active: true },
  "+248": { country: "Seychelles", rate: 16, active: true },
  "+232": { country: "Sierra Leone", rate: 14, active: true },
  "+252": { country: "Somalia", rate: 15, active: true },
  "+27":  { country: "South Africa", rate: 9, active: true },
  "+211": { country: "South Sudan", rate: 15, active: true },
  "+249": { country: "Sudan", rate: 14, active: true },
  "+268": { country: "Eswatini", rate: 12, active: true },
  "+255": { country: "Tanzania", rate: 11, active: true },
  "+228": { country: "Togo", rate: 13, active: true },
  "+216": { country: "Tunisia", rate: 11, active: true },
  "+256": { country: "Uganda", rate: 11, active: true },
  "+260": { country: "Zambia", rate: 12, active: true },
  "+263": { country: "Zimbabwe", rate: 10, active: true }
};

function getRateFromNumber(phoneNumber) {
  if (!phoneNumber) {
    return null;
  }

  const cleaned = phoneNumber.trim();

  const sortedCodes = Object.keys(rates).sort(
    (a, b) => b.length - a.length
  );

  for (const code of sortedCodes) {
    if (cleaned.startsWith(code)) {
      const route = rates[code];

      return {
        destinationCountry: route.country,
        destinationCode: code,
        ratePerMinute: route.rate,
        active: route.active
      };
    }
  }

  return null;
}

function getAllRoutes() {
  return Object.entries(rates).map(([code, data]) => ({
    destinationCode: code,
    destinationCountry: data.country,
    ratePerMinute: data.rate,
    active: data.active
  }));
}

module.exports = {
  rates,
  getRateFromNumber,
  getAllRoutes
};