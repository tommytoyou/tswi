import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const filePath = path.join(process.cwd(), 'ucs-satellite-database.xlsx');

// Read the workbook
const workbook = XLSX.readFile(filePath);

// Get the first sheet
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

console.log('Sheet names:', workbook.SheetNames);
console.log('\nFirst sheet:', sheetName);

// Convert to JSON to see the structure
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

// Show first few rows to understand the structure
console.log('\nFirst 3 rows (headers and sample data):');
for (let i = 0; i < Math.min(3, data.length); i++) {
  console.log(`Row ${i}:`, data[i]);
}

// Show column headers
console.log('\nColumn headers (first row):');
const headers = data[0] as string[];
headers.forEach((header, index) => {
  console.log(`  ${index}: ${header}`);
});
