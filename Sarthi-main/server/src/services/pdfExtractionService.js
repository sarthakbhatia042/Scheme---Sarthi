import { PDFParse } from 'pdf-parse';

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

/**
 * Extracts raw text from a PDF Buffer using pdf-parse v2
 */
export async function extractTextFromPdf(buffer) {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  return result.text || '';
}

/**
 * Heuristic/Regex extractor for government circulars when LLM is offline or no key
 */
function extractViaHeuristics(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const fullText = text.toLowerCase();

  // Try to find scheme title in first 10 lines
  let name = lines[0] || 'Extracted Government Scheme';
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const l = lines[i];
    if (l.length > 5 && l.length < 90 && !/^(page|date|government|ministry|notification|circular|reference)/i.test(l)) {
      name = l;
      break;
    }
  }

  // Detect Category
  let category = 'Social Security';
  if (/solar|power|electricity|renewable|hydrogen|energy|grid/i.test(fullText)) category = 'Energy';
  else if (/farmer|crop|agriculture|kisan|seed|fertilizer|irrigation/i.test(fullText)) category = 'Agriculture';
  else if (/student|scholarship|matric|college|university|school|education/i.test(fullText)) category = 'Education';
  else if (/health|hospital|medical|ayushman|treatment|insurance/i.test(fullText)) category = 'Healthcare';
  else if (/job|employment|apprentice|skill|training|stipend|rojp/i.test(fullText)) category = 'Employment';
  else if (/business|loan|mudra|msme|entrepreneur|svanidhi|startup/i.test(fullText)) category = 'Entrepreneurship';
  else if (/house|housing|awas|shelter|pucca/i.test(fullText)) category = 'Housing';

  // Detect Level
  const level = /state government|applicable to|government of (madhya pradesh|uttar pradesh|maharashtra|rajasthan|bihar|tamil nadu|delhi|karnataka|gujarat)/i.test(fullText) ? 'State' : 'Central';

  // Detect Ministry
  let ministry = 'Government of India';
  const ministryMatch = text.match(/ministry of [^\n,.]+/i);
  if (ministryMatch) {
    ministry = ministryMatch[0].trim();
  } else if (/department of [^\n,.]+/i.test(text)) {
    ministry = text.match(/department of [^\n,.]+/i)[0].trim();
  }

  // Detect Age
  let minAge = undefined;
  let maxAge = undefined;
  const ageBetween = text.match(/(?:age|aged)\s*(?:between)?\s*(\d{1,2})\s*(?:to|-|and)\s*(\d{1,2})/i);
  if (ageBetween) {
    minAge = Number(ageBetween[1]);
    maxAge = Number(ageBetween[2]);
  } else {
    const minAgeMatch = text.match(/(?:minimum|above|at least)\s*(\d{1,2})\s*years/i);
    if (minAgeMatch) minAge = Number(minAgeMatch[1]);
    const maxAgeMatch = text.match(/(?:maximum|not exceeding|up to|below)\s*(\d{1,2})\s*years/i);
    if (maxAgeMatch) maxAge = Number(maxAgeMatch[1]);
  }

  // Detect Income
  let maxIncome = undefined;
  const incomeMatch = text.match(/(?:income|family income)\s*(?:not exceeding|below|up to|less than)?\s*(?:rs\.?|inr|₹)?\s*([0-9,]+)\s*(?:per annum|annually|\/year)?/i);
  if (incomeMatch) {
    const rawVal = Number(incomeMatch[1].replace(/,/g, ''));
    if (!isNaN(rawVal) && rawVal > 1000) maxIncome = rawVal;
  }

  // Detect Gender
  let genders = [];
  if (/only for (women|females|girls)|women only|female only|mahila/i.test(fullText)) {
    genders = ['Female'];
  } else if (/only for men|male only/i.test(fullText)) {
    genders = ['Male'];
  }

  // Detect Occupations
  const occupations = [];
  if (/farmer|cultivator/i.test(fullText)) occupations.push('Farmer');
  if (/student|scholar/i.test(fullText)) occupations.push('Student');
  if (/vendor|hawker|street vendor/i.test(fullText)) occupations.push('Street Vendor');
  if (/unemployed|job seeker/i.test(fullText)) occupations.push('Job Seeker');
  if (/entrepreneur|artisan|craftsman/i.test(fullText)) occupations.push('Artisan');

  // Benefits extraction
  const benefits = [];
  for (const line of lines) {
    if (/(?:financial assistance|grant|subsidy|stipend|coverage of|lakh|thousand|cash transfer|pension|benefit)/i.test(line) && line.length < 180) {
      benefits.push(line.replace(/^[-*•\d.]+\s*/, ''));
      if (benefits.length >= 3) break;
    }
  }
  if (benefits.length === 0) {
    benefits.push('Financial assistance and institutional support under official scheme guidelines');
  }

  // Documents extraction
  const documentsRequired = [];
  const docKeywords = ['aadhaar', 'ration card', 'income certificate', 'caste certificate', 'domicile', 'bank passbook', 'electricity bill', 'land record', 'mark sheet'];
  for (const kw of docKeywords) {
    if (fullText.includes(kw)) {
      documentsRequired.push(kw.charAt(0).toUpperCase() + kw.slice(1) + (kw.includes('card') || kw.includes('bill') || kw.includes('passbook') || kw.includes('certificate') ? '' : ' Certificate/Document'));
    }
  }
  if (documentsRequired.length === 0) {
    documentsRequired.push('Aadhaar Card', 'Identity Proof', 'Bank Account Details');
  }

  return {
    name,
    slug: slugify(name),
    category,
    level,
    ministry,
    description: lines.slice(0, 4).join(' ').slice(0, 350) + '...',
    benefits,
    documentsRequired,
    applicationProcess: [
      'Download and review official guidelines',
      'Register on official portal or visit nearest CSC/department office',
      'Submit attested documents and receive application acknowledgement'
    ],
    eligibility: {
      age: (minAge || maxAge) ? { min: minAge, max: maxAge } : undefined,
      income: maxIncome ? { max: maxIncome } : undefined,
      genders,
      occupations,
      disabilityRequired: /pwd|disability|disabled|handicapped/i.test(fullText),
      farmerRequired: /farmer|pm-kisan|landholder|cultivator/i.test(fullText),
      bplRequired: /bpl|below poverty line|antodaya/i.test(fullText),
      minorityRequired: /minority community|minority status/i.test(fullText)
    },
    officialUrl: 'https://www.myscheme.gov.in/',
    sourceType: 'official-pdf',
    verified: false,
    active: true
  };
}

/**
 * Extracts structured scheme data from a PDF buffer using AI (Groq or Google) with fallback
 */
export async function extractSchemeFromPdf(buffer, customApiKey = '') {
  const text = await extractTextFromPdf(buffer);
  if (!text || text.trim().length < 50) {
    throw new Error('Could not extract readable text from PDF. The document may be a scanned image without OCR text.');
  }

  // Truncate to first ~12,000 characters to keep within context limits while capturing core guidelines
  const snippet = text.slice(0, 12000);

  const groqKey = customApiKey || process.env.GROQ_API_KEY;
  const googleKey = process.env.GOOGLE_API_KEY;

  if (!groqKey && !googleKey) {
    // Return heuristic extraction
    const fallbackScheme = extractViaHeuristics(snippet);
    return {
      scheme: fallbackScheme,
      rawTextSnippet: snippet.slice(0, 500) + '...',
      modelUsed: 'heuristic-regex-extractor'
    };
  }

  try {
    let llm;
    let modelName = '';

    if (groqKey) {
      const { ChatGroq } = await import('@langchain/groq');
      modelName = 'openai/gpt-oss-120b';
      llm = new ChatGroq({
        apiKey: groqKey,
        model: modelName,
        temperature: 0.1
      });
    } else {
      const { ChatGoogleGenerativeAI } = await import('@langchain/google-genai');
      modelName = 'gemini-1.5-flash';
      llm = new ChatGoogleGenerativeAI({
        apiKey: googleKey,
        model: modelName,
        temperature: 0.1
      });
    }

    const prompt = `You are an expert government policy analyst. Analyze the following official government circular / guideline document text and extract structured information for a government scheme database.

Return ONLY a valid JSON object matching this exact structure:
{
  "name": "Full official name of the scheme",
  "slug": "url-friendly-slug-like-this",
  "category": "One of: Education, Healthcare, Employment, Agriculture, Housing, Entrepreneurship, Social Security, Energy",
  "level": "Central or State",
  "ministry": "Name of the implementing Ministry or Department",
  "description": "2-3 concise sentences summarizing what the scheme does",
  "applicableStates": ["State names if state-specific, or leave empty if Central/All India"],
  "benefits": ["Benefit item 1", "Benefit item 2"],
  "documentsRequired": ["Document 1", "Document 2"],
  "applicationProcess": ["Step 1", "Step 2", "Step 3"],
  "eligibility": {
    "minAge": 18,
    "maxAge": 60,
    "maxIncome": 500000,
    "genders": ["Any", "Male", or "Female"],
    "occupations": ["Farmer", "Student", "Artisan", etc.],
    "farmerRequired": false,
    "disabilityRequired": false,
    "bplRequired": false,
    "minorityRequired": false,
    "socialCategories": ["General", "OBC", "SC", "ST", "EWS"]
  },
  "officialUrl": "Official portal URL mentioned in document, or https://www.myscheme.gov.in/"
}

CRITICAL RULES:
1. Extract exact numerical limits (age, income) where specified in text. If unspecified, omit or set to null.
2. Return ONLY clean JSON without markdown code fences or conversational text.

OFFICIAL CIRCULAR TEXT:
${snippet}`;

    const response = await llm.invoke(prompt);
    let rawContent = String(response.content).trim();

    // Strip markdown code fences if model returned them
    if (rawContent.startsWith('```')) {
      rawContent = rawContent.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    }

    const parsed = JSON.parse(rawContent);

    // Normalize eligibility object
    const el = parsed.eligibility || {};
    const normalizedEligibility = {
      age: (el.minAge || el.maxAge) ? { min: el.minAge || undefined, max: el.maxAge || undefined } : undefined,
      income: el.maxIncome ? { max: el.maxIncome } : undefined,
      genders: Array.isArray(el.genders) ? el.genders : (el.gender ? [el.gender] : []),
      states: Array.isArray(parsed.applicableStates) ? parsed.applicableStates : [],
      occupations: Array.isArray(el.occupations) ? el.occupations : [],
      socialCategories: Array.isArray(el.socialCategories) ? el.socialCategories : [],
      farmerRequired: Boolean(el.farmerRequired),
      disabilityRequired: Boolean(el.disabilityRequired),
      bplRequired: Boolean(el.bplRequired),
      minorityRequired: Boolean(el.minorityRequired)
    };

    const scheme = {
      name: parsed.name || 'Extracted Scheme',
      slug: slugify(parsed.slug || parsed.name || 'extracted-scheme'),
      category: parsed.category || 'Social Security',
      level: ['State', 'state'].includes(parsed.level) ? 'State' : 'Central',
      ministry: parsed.ministry || 'Government of India',
      description: parsed.description || 'Government welfare initiative',
      applicableStates: Array.isArray(parsed.applicableStates) ? parsed.applicableStates : [],
      benefits: Array.isArray(parsed.benefits) && parsed.benefits.length > 0 ? parsed.benefits : ['Government financial assistance and support'],
      documentsRequired: Array.isArray(parsed.documentsRequired) && parsed.documentsRequired.length > 0 ? parsed.documentsRequired : ['Aadhaar Card', 'Identity Proof'],
      applicationProcess: Array.isArray(parsed.applicationProcess) && parsed.applicationProcess.length > 0 ? parsed.applicationProcess : ['Verify details and apply through official portal'],
      eligibility: normalizedEligibility,
      officialUrl: parsed.officialUrl || 'https://www.myscheme.gov.in/',
      sourceUrl: parsed.officialUrl || 'https://www.myscheme.gov.in/',
      sourceType: 'official-pdf',
      verified: false,
      active: true
    };

    return {
      scheme,
      rawTextSnippet: snippet.slice(0, 500) + '...',
      modelUsed
    };
  } catch (err) {
    console.error('LLM PDF extraction error, falling back to heuristic extraction:', err);
    const fallbackScheme = extractViaHeuristics(snippet);
    return {
      scheme: fallbackScheme,
      rawTextSnippet: snippet.slice(0, 500) + '...',
      modelUsed: 'heuristic-fallback',
      warning: `LLM extraction note: ${err.message}. Heuristic rules used.`
    };
  }
}

