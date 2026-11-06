import { Readable } from 'stream';
import csvParser from 'csv-parser';
import Scheme from '../models/Scheme.js';

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

function parseList(val, delimiter = /[,;|\n]/) {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(s => String(s).trim()).filter(Boolean);
  return String(val)
    .split(delimiter)
    .map(s => s.trim())
    .filter(Boolean);
}

function parseBool(val) {
  if (typeof val === 'boolean') return val;
  if (!val) return false;
  const str = String(val).trim().toLowerCase();
  return ['true', 'yes', '1', 'y', 'required'].includes(str);
}

function parseNum(val) {
  if (val === undefined || val === null || val === '') return undefined;
  const num = Number(String(val).replace(/[^0-9.-]+/g, ''));
  return isNaN(num) ? undefined : num;
}

/**
 * Normalizes a single raw row (from CSV or JSON) into a full Scheme schema object
 */
export function normalizeRowToScheme(row, defaultVerified = true) {
  const name = (row.name || row.schemeName || row.title || '').trim();
  if (!name) {
    throw new Error('Scheme name is required');
  }

  const baseSlug = slugify(row.slug || name);
  const slug = baseSlug || `scheme-${Date.now()}`;

  const category = (row.category || 'Social Security').trim();
  const level = ['State', 'state'].includes(row.level) ? 'State' : 'Central';

  // Build eligibility subdocument
  const minAge = parseNum(row.minAge || row.ageMin);
  const maxAge = parseNum(row.maxAge || row.ageMax);
  const minIncome = parseNum(row.minIncome || row.incomeMin);
  const maxIncome = parseNum(row.maxIncome || row.incomeMax);

  const eligibility = {
    age: (minAge !== undefined || maxAge !== undefined) ? { min: minAge, max: maxAge } : undefined,
    income: (minIncome !== undefined || maxIncome !== undefined) ? { min: minIncome, max: maxIncome } : undefined,
    genders: parseList(row.genders || row.gender),
    states: parseList(row.states || row.applicableStates),
    occupations: parseList(row.occupations || row.occupation),
    education: parseList(row.education),
    socialCategories: parseList(row.socialCategories || row.categorySocial),
    ruralUrban: parseList(row.ruralUrban),
    disabilityRequired: parseBool(row.disabilityRequired || row.disabilityOnly),
    farmerRequired: parseBool(row.farmerRequired || row.farmerOnly),
    employmentStatuses: parseList(row.employmentStatuses || row.employmentStatus),
    maritalStatuses: parseList(row.maritalStatuses || row.maritalStatus),
    minorityRequired: parseBool(row.minorityRequired || row.minorityOnly),
    bplRequired: parseBool(row.bplRequired || row.bplOnly),
    districts: parseList(row.districts),
    additionalRules: parseList(row.additionalRules)
  };

  return {
    name,
    slug,
    description: (row.description || `Government scheme: ${name}`).trim(),
    ministry: (row.ministry || '').trim(),
    department: (row.department || '').trim(),
    category,
    level,
    applicableStates: parseList(row.applicableStates || row.states),
    benefits: parseList(row.benefits || 'Financial assistance and support as per government guidelines', /[;|\n]/),
    documentsRequired: parseList(row.documentsRequired || 'Aadhaar Card, Identity Proof', /[;|\n]/),
    applicationProcess: parseList(row.applicationProcess || 'Apply through official portal or nearest CSC centre', /[;|\n]/),
    eligibility,
    officialUrl: (row.officialUrl || 'https://www.myscheme.gov.in/').trim(),
    sourceUrl: (row.sourceUrl || row.officialUrl || 'https://www.myscheme.gov.in/').trim(),
    sourceType: (row.sourceType || 'manual').trim(),
    verified: row.verified !== undefined ? parseBool(row.verified) : defaultVerified,
    active: true,
    lastVerifiedAt: new Date()
  };
}

/**
 * Parses raw CSV Buffer into an array of objects
 */
export async function parseCsvBuffer(buffer) {
  return new Promise((resolve, reject) => {
    const results = [];
    const stream = Readable.from(buffer.toString('utf-8'));
    stream
      .pipe(csvParser({ mapHeaders: ({ header }) => header.trim() }))
      .on('data', data => results.push(data))
      .on('end', () => resolve(results))
      .on('error', err => reject(err));
  });
}

/**
 * Bulk imports schemes from a CSV buffer into MongoDB
 */
export async function importSchemesFromCsv(buffer, options = {}) {
  const { defaultVerified = true } = options;
  const rows = await parseCsvBuffer(buffer);

  const insertedSchemes = [];
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      if (!row.name || !String(row.name).trim()) {
        continue; // Skip empty rows
      }

      const schemeData = normalizeRowToScheme(row, defaultVerified);

      // Handle duplicate slug collisions
      let finalSlug = schemeData.slug;
      const existing = await Scheme.findOne({ slug: finalSlug });
      if (existing) {
        finalSlug = `${schemeData.slug}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        schemeData.slug = finalSlug;
      }

      const created = await Scheme.create(schemeData);
      insertedSchemes.push({
        _id: created._id,
        name: created.name,
        slug: created.slug,
        category: created.category
      });
    } catch (err) {
      errors.push({
        row: i + 2, // 1-indexed accounting for header row
        name: row.name || 'Unknown',
        message: err.message
      });
    }
  }

  return {
    totalRows: rows.length,
    inserted: insertedSchemes.length,
    failed: errors.length,
    errors,
    insertedSchemes
  };
}

/**
 * Returns sample CSV template data
 */
export function getCsvTemplate() {
  const headers = [
    'name',
    'slug',
    'category',
    'level',
    'ministry',
    'description',
    'minAge',
    'maxAge',
    'maxIncome',
    'genders',
    'occupations',
    'farmerOnly',
    'disabilityOnly',
    'bplRequired',
    'minorityRequired',
    'applicableStates',
    'benefits',
    'documentsRequired',
    'applicationProcess',
    'officialUrl'
  ].join(',');

  const sampleRow1 = [
    '"PM Surya Ghar: Muft Bijli Yojana"',
    '"pm-surya-ghar"',
    '"Energy"',
    '"Central"',
    '"Ministry of New and Renewable Energy"',
    '"Subsidies for rooftop solar systems providing up to 300 units of free electricity monthly."',
    '18',
    '80',
    '800000',
    '"Any"',
    '"Any"',
    'false',
    'false',
    'false',
    'false',
    '""',
    '"Subsidies up to ₹78,000 for 3kW rooftop solar; Up to 300 units free power/month"',
    '"Aadhaar Card; Electricity Bill; Rooftop Ownership Proof; Bank Account Passbook"',
    '"Register on pmsuryaghar.gov.in; Choose DISCOM vendor; Technical inspection & subsidy credit"',
    '"https://pmsuryaghar.gov.in"'
  ].join(',');

  const sampleRow2 = [
    '"National Green Hydrogen Fellowship"',
    '"green-hydrogen-fellowship"',
    '"Energy"',
    '"Central"',
    '"Ministry of New and Renewable Energy"',
    '"Research grant and stipend for young scientists and graduate researchers working on clean energy technologies."',
    '21',
    '35',
    '',
    '"Any"',
    '"Student, Researcher"',
    'false',
    'false',
    'false',
    'false',
    '""',
    '"₹40,000 monthly fellowship stipend + ₹1.5 Lakh annual research contingency grant"',
    '"Degree Certificate; Valid GATE/NET score; Research Proposal; Aadhaar Card"',
    '"Apply online on MNRE fellowship portal; Institutional recommendation; National committee interview"',
    '"https://mnre.gov.in"'
  ].join(',');

  return `${headers}\n${sampleRow1}\n${sampleRow2}\n`;
}

