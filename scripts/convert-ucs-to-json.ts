import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

interface UCSSatellite {
  noradId: string;
  name: string;
  country: string;
  countryNormalized: string; // For grouping
  operator: string;
  users: string; // Civil, Commercial, Government, Military
  sector: string; // Normalized sector for display
  purpose: string;
  detailedPurpose: string;
  orbitClass: string;
  orbitType: string;
  perigee?: number;
  apogee?: number;
  inclination?: number;
  launchDate?: string;
  launchSite?: string;
}

// Country normalization map
const countryMap: Record<string, string> = {
  'USA': 'USA',
  'United States': 'USA',
  'United States of America': 'USA',
  'China': 'China',
  "China (People's Republic)": 'China',
  'PRC': 'China',
  'Russia': 'Russia',
  'Russian Federation': 'Russia',
  'USSR': 'Russia',
  'France': 'EU',
  'Germany': 'EU',
  'Italy': 'EU',
  'Spain': 'EU',
  'Netherlands': 'EU',
  'Belgium': 'EU',
  'Austria': 'EU',
  'ESA': 'EU',
  'European Union': 'EU',
  'EUMETSAT': 'EU',
  'Multinational': 'EU',
  'United Kingdom': 'EU',
  'UK': 'EU',
  'India': 'India',
  'Japan': 'Japan',
  // Add more as needed
};

// Normalize country to main groupings
function normalizeCountry(country: string): string {
  if (!country) return 'Other';

  const normalized = country.trim();

  // Check exact match first
  if (countryMap[normalized]) {
    return countryMap[normalized];
  }

  // Check partial matches
  const upper = normalized.toUpperCase();
  if (upper.includes('USA') || upper.includes('UNITED STATES') || upper.includes('AMERICAN')) {
    return 'USA';
  }
  if (upper.includes('CHINA') || upper.includes('PRC')) {
    return 'China';
  }
  if (upper.includes('RUSSIA') || upper.includes('RUSSIAN')) {
    return 'Russia';
  }
  if (upper.includes('INDIA') || upper.includes('INDIAN')) {
    return 'India';
  }
  if (upper.includes('JAPAN') || upper.includes('JAPANESE')) {
    return 'Japan';
  }
  // EU countries
  if (upper.includes('ESA') || upper.includes('EUMETSAT') || upper.includes('EUROPEAN') ||
      upper.includes('FRANCE') || upper.includes('GERMANY') || upper.includes('ITALY') ||
      upper.includes('SPAIN') || upper.includes('NETHERLANDS') || upper.includes('BELGIUM') ||
      upper.includes('UK') || upper.includes('UNITED KINGDOM') || upper.includes('BRITAIN')) {
    return 'EU';
  }

  return 'Other';
}

// Normalize sector from Users field
function normalizeSector(users: string): string {
  if (!users) return 'Commercial';

  const upper = users.toUpperCase();
  if (upper.includes('MILITARY')) return 'Military';
  if (upper.includes('GOVERNMENT')) return 'Government';
  if (upper.includes('CIVIL')) return 'Civil';
  if (upper.includes('COMMERCIAL')) return 'Commercial';

  return 'Commercial';
}

// Parse Excel date (Excel stores dates as serial numbers)
function parseExcelDate(dateValue: any): string | undefined {
  if (!dateValue) return undefined;

  // If it's a number, it's an Excel serial date
  if (typeof dateValue === 'number') {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + dateValue * 86400000);
    return date.toISOString().split('T')[0];
  }

  // If it's a string, try to parse it
  if (typeof dateValue === 'string') {
    const parsed = new Date(dateValue);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  }

  return undefined;
}

const filePath = path.join(process.cwd(), 'ucs-satellite-database.xlsx');

// Read the workbook
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

// Convert to JSON
const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

// Skip header row
const satellites: UCSSatellite[] = [];
const countryCounts: Record<string, number> = {};
const sectorCounts: Record<string, number> = {};

for (let i = 1; i < rawData.length; i++) {
  const row = rawData[i];
  if (!row || row.length < 27) continue;

  const noradId = row[26]?.toString();
  if (!noradId || noradId === '0' || noradId === '') continue;

  const country = row[3]?.toString() || '';
  const countryNormalized = normalizeCountry(country);
  const users = row[5]?.toString() || '';
  const sector = normalizeSector(users);

  // Count for stats
  countryCounts[countryNormalized] = (countryCounts[countryNormalized] || 0) + 1;
  sectorCounts[sector] = (sectorCounts[sector] || 0) + 1;

  const satellite: UCSSatellite = {
    noradId: noradId.trim(),
    name: (row[1]?.toString() || row[0]?.toString() || 'Unknown').trim(),
    country: country.trim(),
    countryNormalized,
    operator: (row[4]?.toString() || '').trim(),
    users: users.trim(),
    sector,
    purpose: (row[6]?.toString() || '').trim(),
    detailedPurpose: (row[7]?.toString() || '').trim(),
    orbitClass: (row[8]?.toString() || '').trim(),
    orbitType: (row[9]?.toString() || '').trim(),
    perigee: typeof row[11] === 'number' ? row[11] : undefined,
    apogee: typeof row[12] === 'number' ? row[12] : undefined,
    inclination: typeof row[14] === 'number' ? row[14] : undefined,
    launchDate: parseExcelDate(row[19]),
    launchSite: (row[23]?.toString() || '').trim(),
  };

  satellites.push(satellite);
}

console.log(`Processed ${satellites.length} satellites`);
console.log('\nCountry distribution:');
Object.entries(countryCounts)
  .sort((a, b) => b[1] - a[1])
  .forEach(([country, count]) => {
    console.log(`  ${country}: ${count}`);
  });

console.log('\nSector distribution:');
Object.entries(sectorCounts)
  .sort((a, b) => b[1] - a[1])
  .forEach(([sector, count]) => {
    console.log(`  ${sector}: ${count}`);
  });

// Write to JSON file
const outputPath = path.join(process.cwd(), 'public', 'data', 'ucs-satellites.json');
const outputData = {
  lastUpdated: new Date().toISOString(),
  source: 'UCS Satellite Database',
  totalCount: satellites.length,
  countryCounts,
  sectorCounts,
  satellites,
};

fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
console.log(`\nWritten to ${outputPath}`);
