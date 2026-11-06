import { useEffect, useState, useRef } from 'react';
import {
  FileText,
  Upload,
  Sparkles,
  Download,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  Layers,
  Search,
  ExternalLink,
  Trash2,
  RotateCcw,
  ShieldCheck,
  FileSpreadsheet
} from 'lucide-react';
import api from '../lib/api';

const CATEGORIES = [
  'Education',
  'Healthcare',
  'Employment',
  'Agriculture',
  'Housing',
  'Entrepreneurship',
  'Social Security',
  'Energy'
];

const blankForm = {
  name: '',
  slug: '',
  description: '',
  ministry: '',
  category: 'Education',
  level: 'Central',
  officialUrl: 'https://www.myscheme.gov.in/',
  sourceUrl: 'https://www.myscheme.gov.in/',
  verified: true,
  active: true,
  minAge: '',
  maxAge: '',
  maxIncome: '',
  benefits: '',
  documentsRequired: '',
  applicationProcess: '',
  farmerRequired: false,
  disabilityRequired: false,
  bplRequired: false,
  minorityRequired: false
};

export default function Admin() {
  const [activeTab, setActiveTab] = useState('manual'); // 'manual' | 'csv' | 'pdf'
  const [items, setItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [form, setForm] = useState(blankForm);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  // Bulk CSV state
  const [csvFile, setCsvFile] = useState(null);
  const [csvResult, setCsvResult] = useState(null);
  const [csvDefaultVerified, setCsvDefaultVerified] = useState(true);
  const csvInputRef = useRef(null);

  // PDF Extraction state
  const [pdfFile, setPdfFile] = useState(null);
  const [extractedScheme, setExtractedScheme] = useState(null);
  const [rawTextSnippet, setRawTextSnippet] = useState('');
  const [pdfWarning, setPdfWarning] = useState('');
  const pdfInputRef = useRef(null);

  const loadSchemes = () => {
    api.get('/schemes?limit=200').then(r => setItems(r.data.items || []));
  };

  useEffect(() => {
    loadSchemes();
  }, []);

  const handleCreateManual = async e => {
    e.preventDefault();
    setLoading(true);
    setMsg({ type: '', text: '' });

    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim() || form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        description: form.description.trim(),
        ministry: form.ministry.trim(),
        category: form.category,
        level: form.level,
        officialUrl: form.officialUrl.trim(),
        sourceUrl: form.sourceUrl.trim(),
        verified: Boolean(form.verified),
        active: true,
        benefits: form.benefits
          ? form.benefits.split(';').map(s => s.trim()).filter(Boolean)
          : ['Financial assistance as per official scheme guidelines'],
        documentsRequired: form.documentsRequired
          ? form.documentsRequired.split(';').map(s => s.trim()).filter(Boolean)
          : ['Aadhaar Card', 'Identity Proof'],
        applicationProcess: form.applicationProcess
          ? form.applicationProcess.split(';').map(s => s.trim()).filter(Boolean)
          : ['Apply online at the official portal or nearest CSC center'],
        eligibility: {
          age: (form.minAge || form.maxAge) ? { min: Number(form.minAge) || undefined, max: Number(form.maxAge) || undefined } : undefined,
          income: form.maxIncome ? { max: Number(form.maxIncome) } : undefined,
          farmerRequired: form.farmerRequired,
          disabilityRequired: form.disabilityRequired,
          bplRequired: form.bplRequired,
          minorityRequired: form.minorityRequired
        }
      };

      await api.post('/schemes', payload);
      setMsg({ type: 'success', text: `Scheme "${payload.name}" created successfully!` });
      setForm(blankForm);
      loadSchemes();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to create scheme.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await api.get('/schemes/csv-template', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'schemes_upload_template.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setMsg({ type: 'error', text: 'Failed to download CSV template.' });
    }
  };

  const handleCsvUpload = async e => {
    e.preventDefault();
    if (!csvFile) return;

    setLoading(true);
    setCsvResult(null);
    setMsg({ type: '', text: '' });

    const formData = new FormData();
    formData.append('file', csvFile);
    formData.append('defaultVerified', String(csvDefaultVerified));

    try {
      const res = await api.post('/schemes/bulk-upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setCsvResult(res.data);
      setMsg({ type: 'success', text: res.data.message });
      setCsvFile(null);
      if (csvInputRef.current) csvInputRef.current.value = '';
      loadSchemes();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Bulk CSV upload failed.' });
    } finally {
      setLoading(false);
    }
  };

  const handlePdfExtract = async e => {
    e.preventDefault();
    if (!pdfFile) return;

    setLoading(true);
    setExtractedScheme(null);
    setRawTextSnippet('');
    setPdfWarning('');
    setMsg({ type: '', text: '' });

    const formData = new FormData();
    formData.append('file', pdfFile);

    try {
      const res = await api.post('/schemes/extract-pdf', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setExtractedScheme(res.data.scheme);
      setRawTextSnippet(res.data.rawTextSnippet || '');
      if (res.data.warning) setPdfWarning(res.data.warning);
      setMsg({ type: 'success', text: 'PDF circular extracted successfully! Review the extracted rules below.' });
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to extract scheme from PDF.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveExtractedScheme = async () => {
    if (!extractedScheme) return;
    setLoading(true);
    try {
      await api.post('/schemes', extractedScheme);
      setMsg({ type: 'success', text: `Extracted scheme "${extractedScheme.name}" published to database!` });
      setExtractedScheme(null);
      setPdfFile(null);
      if (pdfInputRef.current) pdfInputRef.current.value = '';
      loadSchemes();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to save extracted scheme.' });
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900">Admin Scheme Management</h1>
          <p className="text-sm text-slate-500">
            Publish single schemes, bulk import via CSV, or extract structured rules from official PDF circulars.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-200">
            {items.length} Schemes in Database
          </span>
        </div>
      </div>

      {/* Global Status Message */}
      {msg.text && (
        <div
          className={`flex items-center gap-2 rounded-xl p-4 text-sm font-medium ${
            msg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {msg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveTab('manual')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition ${
            activeTab === 'manual'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <PlusCircle size={16} />
          <span>Manual Entry</span>
        </button>

        <button
          onClick={() => setActiveTab('csv')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition ${
            activeTab === 'csv'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileSpreadsheet size={16} />
          <span>Bulk CSV Upload (Phase 1)</span>
        </button>

        <button
          onClick={() => setActiveTab('pdf')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition ${
            activeTab === 'pdf'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Sparkles size={16} />
          <span>AI PDF Extractor (Phase 2)</span>
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        {/* Left Column: Active Tab Content */}
        <div>
          {/* TAB 1: MANUAL ENTRY */}
          {activeTab === 'manual' && (
            <form onSubmit={handleCreateManual} className="card p-6 space-y-4">
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <PlusCircle size={20} className="text-emerald-700" />
                Add New Scheme
              </h2>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-bold text-slate-700">Scheme Name *</label>
                  <input
                    required
                    className="input mt-1"
                    placeholder="e.g. PM Surya Ghar: Muft Bijli Yojana"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">URL Slug (unique)</label>
                  <input
                    className="input mt-1"
                    placeholder="e.g. pm-surya-ghar"
                    value={form.slug}
                    onChange={e => setForm({ ...form, slug: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="text-xs font-bold text-slate-700">Category *</label>
                  <select
                    className="input mt-1"
                    value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })}
                  >
                    {CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">Level</label>
                  <select
                    className="input mt-1"
                    value={form.level}
                    onChange={e => setForm({ ...form, level: e.target.value })}
                  >
                    <option value="Central">Central</option>
                    <option value="State">State</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">Ministry / Department</label>
                  <input
                    className="input mt-1"
                    placeholder="e.g. Ministry of Power"
                    value={form.ministry}
                    onChange={e => setForm({ ...form, ministry: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Description *</label>
                <textarea
                  required
                  rows={3}
                  className="input mt-1"
                  placeholder="Summary of the scheme objectives and key highlights..."
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                />
              </div>

              {/* Eligibility Criteria Sub-section */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                <span className="text-xs font-black uppercase tracking-wider text-slate-600 block">
                  Eligibility Criteria Limits
                </span>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600">Min Age</label>
                    <input
                      type="number"
                      className="input mt-1 text-xs"
                      placeholder="e.g. 18"
                      value={form.minAge}
                      onChange={e => setForm({ ...form, minAge: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Max Age</label>
                    <input
                      type="number"
                      className="input mt-1 text-xs"
                      placeholder="e.g. 60"
                      value={form.maxAge}
                      onChange={e => setForm({ ...form, maxAge: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Max Annual Income (₹)</label>
                    <input
                      type="number"
                      className="input mt-1 text-xs"
                      placeholder="e.g. 500000"
                      value={form.maxIncome}
                      onChange={e => setForm({ ...form, maxIncome: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.farmerRequired}
                      onChange={e => setForm({ ...form, farmerRequired: e.target.checked })}
                    />
                    <span>Farmer Only</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.disabilityRequired}
                      onChange={e => setForm({ ...form, disabilityRequired: e.target.checked })}
                    />
                    <span>PwD / Disability Only</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.bplRequired}
                      onChange={e => setForm({ ...form, bplRequired: e.target.checked })}
                    />
                    <span>BPL Card Required</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.minorityRequired}
                      onChange={e => setForm({ ...form, minorityRequired: e.target.checked })}
                    />
                    <span>Minority Only</span>
                  </label>
                </div>
              </div>

              {/* Benefits and Documents */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-bold text-slate-700">Benefits (semicolon separated)</label>
                  <input
                    className="input mt-1 text-xs"
                    placeholder="Benefit 1; Benefit 2"
                    value={form.benefits}
                    onChange={e => setForm({ ...form, benefits: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">Documents Required (semicolon separated)</label>
                  <input
                    className="input mt-1 text-xs"
                    placeholder="Aadhaar Card; Income Certificate; Bank Passbook"
                    value={form.documentsRequired}
                    onChange={e => setForm({ ...form, documentsRequired: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-bold text-slate-700">Official Portal URL</label>
                  <input
                    className="input mt-1 text-xs"
                    placeholder="https://..."
                    value={form.officialUrl}
                    onChange={e => setForm({ ...form, officialUrl: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">Source Reference URL</label>
                  <input
                    className="input mt-1 text-xs"
                    placeholder="https://..."
                    value={form.sourceUrl}
                    onChange={e => setForm({ ...form, sourceUrl: e.target.value })}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary !px-6 py-2.5 font-bold shadow-sm"
              >
                {loading ? 'Publishing Scheme...' : 'Create & Publish Scheme'}
              </button>
            </form>
          )}

          {/* TAB 2: BULK CSV UPLOAD (PHASE 1) */}
          {activeTab === 'csv' && (
            <div className="space-y-6">
              <div className="card p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                      <FileSpreadsheet size={20} className="text-emerald-700" />
                      Bulk Scheme CSV Ingestion (Phase 1)
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Upload a CSV file containing multiple schemes with eligibility rules, benefits, and category tags.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="btn-secondary text-xs flex items-center gap-1.5 shrink-0"
                  >
                    <Download size={14} />
                    <span>Download CSV Template</span>
                  </button>
                </div>

                <form onSubmit={handleCsvUpload} className="space-y-4 pt-3">
                  <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:border-emerald-500 transition bg-slate-50/50">
                    <Upload size={32} className="mx-auto text-slate-400 mb-2" />
                    <input
                      ref={csvInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      onChange={e => setCsvFile(e.target.files?.[0] || null)}
                      className="text-xs text-slate-600 block mx-auto file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-800 hover:file:bg-emerald-100"
                    />
                    <p className="text-[11px] text-slate-400 mt-2">
                      Accepts CSV files with headers: name, category, minAge, maxAge, maxIncome, farmerOnly, etc.
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={csvDefaultVerified}
                        onChange={e => setCsvDefaultVerified(e.target.checked)}
                      />
                      <span>Mark imported schemes as Verified (instantly visible to citizens)</span>
                    </label>

                    <button
                      type="submit"
                      disabled={!csvFile || loading}
                      className="btn-primary !px-5 py-2 text-xs font-bold"
                    >
                      {loading ? 'Importing CSV...' : 'Upload & Import Schemes'}
                    </button>
                  </div>
                </form>

                {/* CSV Results Summary */}
                {csvResult && (
                  <div className="mt-4 border-t border-slate-100 pt-4 space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-xl bg-slate-50 p-3 text-center border border-slate-200">
                        <span className="text-xs text-slate-500 block">Total Rows</span>
                        <span className="text-lg font-black text-slate-800">{csvResult.totalRows}</span>
                      </div>
                      <div className="rounded-xl bg-emerald-50 p-3 text-center border border-emerald-200">
                        <span className="text-xs text-emerald-700 block">Imported</span>
                        <span className="text-lg font-black text-emerald-800">{csvResult.inserted}</span>
                      </div>
                      <div className="rounded-xl bg-red-50 p-3 text-center border border-red-200">
                        <span className="text-xs text-red-600 block">Failed / Skipped</span>
                        <span className="text-lg font-black text-red-700">{csvResult.failed}</span>
                      </div>
                    </div>

                    {csvResult.insertedSchemes?.length > 0 && (
                      <div>
                        <span className="text-xs font-bold text-slate-700 block mb-1">Newly Imported Schemes:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {csvResult.insertedSchemes.map((s, idx) => (
                            <span key={idx} className="rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5">
                              {s.name} ({s.category})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {csvResult.errors?.length > 0 && (
                      <div className="rounded-xl bg-red-50 p-3 text-xs text-red-800 border border-red-200">
                        <span className="font-bold block mb-1">Import Warnings / Errors:</span>
                        <ul className="list-disc ml-4 space-y-0.5">
                          {csvResult.errors.map((err, idx) => (
                            <li key={idx}>Row {err.row}: {err.message}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: AI PDF EXTRACTOR (PHASE 2) */}
          {activeTab === 'pdf' && (
            <div className="space-y-6">
              <div className="card p-6 space-y-4">
                <div>
                  <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <Sparkles size={20} className="text-emerald-700" />
                    AI-Powered PDF Circular Extractor (Phase 2)
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Upload an official government guideline or gazette PDF. The AI engine reads the circular and converts unstructured rules into verified eligibility schema fields.
                  </p>
                </div>

                <form onSubmit={handlePdfExtract} className="space-y-4 pt-2">
                  <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:border-emerald-500 transition bg-slate-50/50">
                    <FileText size={32} className="mx-auto text-emerald-600 mb-2" />
                    <input
                      ref={pdfInputRef}
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={e => setPdfFile(e.target.files?.[0] || null)}
                      className="text-xs text-slate-600 block mx-auto file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-800 hover:file:bg-emerald-100"
                    />
                    <p className="text-[11px] text-slate-400 mt-2">
                      Upload official government gazette / guideline PDF (up to 15MB).
                    </p>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={!pdfFile || loading}
                      className="btn-primary !px-5 py-2 text-xs font-bold flex items-center gap-1.5"
                    >
                      <Sparkles size={14} />
                      <span>{loading ? 'Analyzing & Extracting with AI...' : 'Extract Scheme Rules'}</span>
                    </button>
                  </div>
                </form>

                {pdfWarning && (
                  <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800 border border-amber-200">
                    {pdfWarning}
                  </div>
                )}

                {/* Extracted Review Card */}
                {extractedScheme && (
                  <div className="mt-6 border-t border-slate-200 pt-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                        <CheckCircle2 size={14} />
                        Extracted Scheme Rules (Preview & Confirm)
                      </span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        {extractedScheme.category}
                      </span>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-3 text-xs">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                          <span className="text-slate-400 block font-semibold">Scheme Name</span>
                          <span className="font-bold text-slate-900 text-sm">{extractedScheme.name}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block font-semibold">Ministry</span>
                          <span className="font-bold text-slate-700">{extractedScheme.ministry || 'Government of India'}</span>
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-400 block font-semibold">Description</span>
                        <p className="text-slate-700 mt-0.5">{extractedScheme.description}</p>
                      </div>

                      {/* Extracted Eligibility Rules */}
                      <div className="rounded-xl bg-white p-3 border border-slate-200 space-y-1.5">
                        <span className="font-bold text-slate-800 block text-[11px] uppercase tracking-wide">
                          Parsed Eligibility Logic
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-slate-600">
                          <div>
                            Age: <strong>{extractedScheme.eligibility?.age ? `${extractedScheme.eligibility.age.min || 0} to ${extractedScheme.eligibility.age.max || 'Any'}` : 'Any'}</strong>
                          </div>
                          <div>
                            Income Cap: <strong>{extractedScheme.eligibility?.income?.max ? `₹${extractedScheme.eligibility.income.max.toLocaleString('en-IN')}` : 'No cap'}</strong>
                          </div>
                          <div>
                            Target: <strong>{extractedScheme.eligibility?.farmerRequired ? 'Farmers' : extractedScheme.eligibility?.disabilityRequired ? 'PwD' : 'General'}</strong>
                          </div>
                        </div>
                      </div>

                      {/* Benefits & Documents */}
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <span className="text-slate-400 block font-semibold mb-1">Key Benefits:</span>
                          <ul className="list-disc ml-4 space-y-0.5 text-slate-700">
                            {extractedScheme.benefits?.map((b, i) => (
                              <li key={i}>{b}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <span className="text-slate-400 block font-semibold mb-1">Required Documents:</span>
                          <ul className="list-disc ml-4 space-y-0.5 text-slate-700">
                            {extractedScheme.documentsRequired?.map((d, i) => (
                              <li key={i}>{d}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setExtractedScheme(null)}
                        className="btn-secondary text-xs"
                      >
                        Discard
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveExtractedScheme}
                        disabled={loading}
                        className="btn-primary !px-5 py-2 text-xs font-bold flex items-center gap-1.5"
                      >
                        <ShieldCheck size={14} />
                        <span>Confirm & Publish to Portal</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Published Schemes Catalog */}
        <div className="card h-fit overflow-hidden border border-slate-200">
          <div className="border-b border-slate-100 p-4 bg-slate-50/50 flex items-center justify-between">
            <span className="font-bold text-sm text-slate-800">Published Schemes ({items.length})</span>
            <button
              onClick={loadSchemes}
              className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold flex items-center gap-1"
            >
              <RotateCcw size={12} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-3 text-slate-400" />
              <input
                className="input !pl-8 text-xs py-1.5 w-full"
                placeholder="Filter schemes..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
            {filteredItems.slice(0, 50).map(s => (
              <div key={s._id} className="p-3 hover:bg-slate-50 transition">
                <div className="flex items-start justify-between gap-1">
                  <h4 className="font-bold text-xs text-slate-900 line-clamp-1">{s.name}</h4>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 shrink-0">
                    {s.category}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                  <span>{s.level} · {s.ministry || 'Govt of India'}</span>
                  {s.officialUrl && (
                    <a
                      href={s.officialUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-700 hover:underline flex items-center gap-0.5"
                    >
                      <span>Link</span>
                      <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              </div>
            ))}
            {filteredItems.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-400">
                No matching schemes found.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
