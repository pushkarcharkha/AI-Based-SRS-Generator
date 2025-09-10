import  { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Edit3, Trash2, Search, Filter, Eye, X, Clock, Calendar, HardDrive, Star, Download, FileDown, FileText as FileDoc, FileCode, BarChart2, BookOpen, Archive } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// Define type for Vite's import.meta.env
interface ImportMetaEnv {
  VITE_API_URL?: string;
}

interface ImportMeta {
  env: ImportMetaEnv;
}

type DocStatus = 'draft' | 'review' | 'final';

type ApiDocumentList = {
  id: string;
  title: string;
  doc_type: string;
  created: string; // ISO
  modified: string; // ISO
  status: DocStatus;
  size: string;
  author: string;
  feedback_score: number; // Matches backend DocumentListResponse
};

type ApiDocument = {
  id: string;
  title: string;
  content: string;
  doc_type: string;
  status: DocStatus;
  created_at: string;
  updated_at: string;
};

// Use typed import.meta
const API_BASE = (import.meta as ImportMeta).env.VITE_API_URL || 'http://localhost:8000';

function ListPage() {
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const [documents, setDocuments] = useState<ApiDocumentList[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Preview modal
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<ApiDocument | null>(null);

  const loadDocuments = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`${API_BASE}/api/documents`);
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.detail || `Failed to load documents (Status: ${res.status})`);
      }
      const data: ApiDocumentList[] = await res.json();
      if (!Array.isArray(data)) {
        throw new Error('Invalid response format: Expected array of documents');
      }
      setDocuments(data);
    } catch (e: unknown) {
      console.error('Error fetching documents:', e);
      setErr((e as Error).message || 'Unable to fetch documents. Please check the server and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const filteredDocuments = useMemo(() => {
    const term = searchTerm.toLowerCase();
    // First filter the documents
    const filtered = documents.filter((doc) => {
      const matchesSearch =
        doc.title.toLowerCase().includes(term) || doc.doc_type.toLowerCase().includes(term);
      const matchesType = filterType === 'all' || doc.doc_type === filterType;
      const matchesStatus = filterStatus === 'all' || doc.status === filterStatus;
      return matchesSearch && matchesType && matchesStatus;
    });
    
    // Then sort by creation date (newest first)
    return filtered.sort((a, b) => {
      const dateA = new Date(a.created || 0).getTime();
      const dateB = new Date(b.created || 0).getTime();
      return dateB - dateA; // Descending order (newest first)
    });
  }, [documents, searchTerm, filterType, filterStatus]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'review':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'final':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const handleDownload = async (doc: ApiDocumentList, labelFormat: 'MD' | 'PDF' | 'DOCX' | 'LaTeX') => {
    try {
      setBusyId(doc.id);
      const format = labelFormat.toLowerCase();
      const res = await fetch(`${API_BASE}/api/export/${doc.id}?format=${encodeURIComponent(format)}`, {
        method: 'GET',
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Export failed (Status: ${res.status})`);
      }
      const blob = await res.blob();
      const dispo = res.headers.get('Content-Disposition') || '';
      const match = /filename="?([^"]+)"?/.exec(dispo);
      const filename = match?.[1] || `${doc.title}.${format}`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      console.error(`Export error for ${labelFormat}:`, e);
      alert((e as Error).message || `Failed to export as ${labelFormat}. Please try again or contact support.`);
    } finally {
      setBusyId(null);
    }
  };

  const handleEdit = (docId: string) => {
    navigate(`/review/${docId}`);
  };

  const handleDelete = async (docId: string) => {
    const proceed = window.confirm('Delete this document? This action cannot be undone.');
    if (!proceed) return;
    try {
      setBusyId(docId);
      const res = await fetch(`${API_BASE}/api/documents/${docId}`, { method: 'DELETE' });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.detail || `Delete failed (Status: ${res.status})`);
      }
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (e: unknown) {
      console.error('Delete error:', e);
      alert((e as Error).message || 'Delete failed. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const handlePreview = async (docId: string) => {
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewDoc(null);
    try {
      const res = await fetch(`${API_BASE}/api/documents/${docId}`);
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.detail || `Failed to load document (Status: ${res.status})`);
      }
      const data: ApiDocument = await res.json();
      setPreviewDoc(data);
    } catch (e: unknown) {
      console.error('Preview error:', e);
      setErr((e as Error).message || 'Unable to load document preview. Please try again.');
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-fade-in">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
          <BookOpen className="w-8 h-8 mr-3 text-primary-500" />
          Document Library
        </h2>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl">
          Manage, export, and organize all your generated documents.
        </p>
      </div>

      {/* Filters and Search */}
      <div className="card mb-8">
        {err && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 text-sm flex items-center">
            <X className="w-4 h-4 mr-2 flex-shrink-0" />
            <span><strong>Error:</strong> {err}</span>
          </div>
        )}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 md:space-x-4">
          <div className="flex-1">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 group-hover:text-primary-500 transition-colors" />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input pl-10 transition-all duration-200 border-gray-300 dark:border-gray-600 focus:border-primary-500 focus:ring focus:ring-primary-500/20"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Filter className="w-4 h-4 text-gray-500" />
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="form-select pl-9 pr-8 py-2 appearance-none bg-no-repeat"
              >
                <option value="all">All Types</option>
                <option value="SRS">SRS</option>
                <option value="SOW">SOW</option>
                <option value="Proposal">Proposal</option>
                <option value="Technical">Technical</option>
                <option value="Business">Business</option>
              </select>
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="form-select"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="review">Review</option>
              <option value="final">Final</option>
            </select>
          </div>
        </div>
      </div>

      {/* Document Grid */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-0 overflow-hidden">
              <div className="p-6">
                <div className="animate-pulse h-6 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-3" />
                <div className="animate-pulse h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-6" />
                <div className="space-y-2">
                  <div className="animate-pulse h-3 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="animate-pulse h-3 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="animate-pulse h-3 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
              </div>
              <div className="h-12 bg-gray-50 dark:bg-gray-800/50 animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {filteredDocuments.length === 0 && !err ? (
            <div className="text-center py-16 card">
              <div className="w-20 h-20 mx-auto mb-6 relative">
                <div className="absolute inset-0 bg-gray-100 dark:bg-gray-700 rounded-lg transform rotate-6"></div>
                <div className="absolute inset-0 bg-gray-200 dark:bg-gray-600 rounded-lg transform -rotate-6"></div>
                <div className="absolute inset-0 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center">
                  <Archive className="w-10 h-10 text-gray-400" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No documents found</h3>
              <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                {searchTerm || filterType !== 'all' || filterStatus !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Upload documents or generate new ones to get started'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="card p-0 overflow-hidden hover:shadow-md transition-all duration-300 hover:translate-y-[-2px] group"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-5">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex items-center justify-center shadow-sm">
                          {doc.doc_type === 'SRS' && <FileText className="w-6 h-6 text-primary-600 dark:text-primary-400" />}
                          {doc.doc_type === 'SOW' && <FileDoc className="w-6 h-6 text-primary-600 dark:text-primary-400" />}
                          {doc.doc_type === 'Proposal' && <BookOpen className="w-6 h-6 text-primary-600 dark:text-primary-400" />}
                          {doc.doc_type === 'Technical' && <FileCode className="w-6 h-6 text-primary-600 dark:text-primary-400" />}
                          {doc.doc_type === 'Business' && <BarChart2 className="w-6 h-6 text-primary-600 dark:text-primary-400" />}
                          {!['SRS', 'SOW', 'Proposal', 'Technical', 'Business'].includes(doc.doc_type) && 
                            <FileText className="w-6 h-6 text-primary-600 dark:text-primary-400" />}
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                            {doc.title}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{doc.doc_type}</p>
                        </div>
                      </div>

                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(doc.status)} shadow-sm`}>
                        {doc.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-gray-600 dark:text-gray-400 mb-5">
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                        <span className="text-xs">Created: {new Date(doc.created).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-2 text-gray-400" />
                        <span className="text-xs">Modified: {new Date(doc.modified).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center">
                        <HardDrive className="w-4 h-4 mr-2 text-gray-400" />
                        <span className="text-xs">Size: {doc.size}</span>
                      </div>
                      <div className="flex items-center">
                        <Star className="w-4 h-4 mr-2 text-gray-400" />
                        <span className="text-xs">Score: {doc.feedback_score}</span>
                      </div>
                    </div>

                    <div className="flex space-x-3">
                      <button
                        onClick={() => handlePreview(doc.id)}
                        disabled={busyId === doc.id}
                        className="btn-secondary flex-1 py-2 text-sm"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        <span>Preview</span>
                      </button>

                      <button
                        onClick={() => handleEdit(doc.id)}
                        disabled={busyId === doc.id}
                        className="btn-primary flex-1 py-2 text-sm"
                      >
                        <Edit3 className="w-4 h-4 mr-2" />
                        <span>Edit</span>
                      </button>
                    </div>

                    <div className="mt-5 pt-5 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                          <Download className="w-4 h-4 mr-1.5 text-gray-500" />
                          Export as:
                        </span>
                        <div className="flex space-x-3">
                          <button
                            onClick={() => handleDownload(doc, 'MD')}
                            disabled={busyId === doc.id}
                            className="p-1.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 group relative"
                            title="Markdown"
                          >
                            <FileText className="w-4 h-4" />
                            <span className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">Markdown</span>
                          </button>
                          <button
                            onClick={() => handleDownload(doc, 'PDF')}
                            disabled={busyId === doc.id}
                            className="p-1.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 group relative"
                            title="PDF"
                          >
                            <FileText className="w-4 h-4" />
                            <span className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10">PDF</span>
                          </button>
                          <button
                            onClick={() => handleDownload(doc, 'DOCX')}
                            disabled={busyId === doc.id}
                            className="p-1.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 group relative"
                            title="Word Document"
                          >
                            <FileDoc className="w-4 h-4" />
                            <span className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">Word Doc</span>
                          </button>
                          <button
                            onClick={() => handleDownload(doc, 'LaTeX')}
                            disabled={busyId === doc.id}
                            className="p-1.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 group relative"
                            title="LaTeX"
                          >
                            <FileCode className="w-4 h-4" />
                            <span className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10">LaTeX</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/50">
                    <button
                      onClick={() => handleDelete(doc.id)}
                      disabled={busyId === doc.id}
                      className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm font-medium flex items-center space-x-1.5 transition-colors disabled:opacity-50 group"
                    >
                      <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {filteredDocuments.length === 0 && err && (
            <div className="text-center py-12 card">
              <X className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Error Loading Documents</h3>
              <p className="text-gray-600 dark:text-gray-400">{err}</p>
            </div>
          )}

          {/* Stats Summary */}
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-6 animate-fade-in">
            <div className="card p-6 text-center hover:shadow-md transition-all duration-300 hover:translate-y-[-2px] group">
              <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                <Archive className="w-6 h-6 text-primary-600 dark:text-primary-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{documents.length}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Total Documents</div>
            </div>

            <div className="card p-6 text-center hover:shadow-md transition-all duration-300 hover:translate-y-[-2px] group">
              <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                <FileText className="w-6 h-6 text-yellow-600 dark:text-yellow-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {documents.filter((d) => d.status === 'draft').length}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Drafts</div>
            </div>

            <div className="card p-6 text-center hover:shadow-md transition-all duration-300 hover:translate-y-[-2px] group">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                <Edit3 className="w-6 h-6 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {documents.filter((d) => d.status === 'review').length}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">In Review</div>
            </div>

            <div className="card p-6 text-center hover:shadow-md transition-all duration-300 hover:translate-y-[-2px] group">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                <BookOpen className="w-6 h-6 text-green-600 dark:text-green-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {documents.filter((d) => d.status === 'final').length}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Final</div>
            </div>
          </div>
        </>
      )}

      {/* Preview Modal */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setPreviewOpen(false)}
            aria-hidden="true"
          />
          <div className="relative bg-white dark:bg-gray-900 w-full max-w-4xl rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden animate-slide-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <div className="font-semibold text-gray-900 dark:text-white flex items-center">
                <FileText className="w-5 h-5 mr-2 text-primary-500" />
                Document Preview
              </div>
              <button
                onClick={() => setPreviewOpen(false)}
                className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto p-6 bg-white dark:bg-gray-900">
              {previewLoading ? (
                <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                  <div className="w-10 h-10 border-3 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-lg">Loading document preview...</p>
                </div>
              ) : previewDoc ? (
                <div className="prose prose-sm max-w-none dark:prose-invert animate-fade-in">
                  <ReactMarkdown>{previewDoc.content || ''}</ReactMarkdown>
                </div>
              ) : (
                <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                  <X className="w-12 h-12 text-red-500 mx-auto mb-4" />
                  <p className="text-lg font-medium">Unable to load document</p>
                  <p className="mt-2">{err ? `Error: ${err}` : 'Please try again.'}</p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end space-x-3 bg-gray-50 dark:bg-gray-800">
              {previewDoc && (
                <>
                  <button
                    onClick={() => navigate(`/edit/${previewDoc.id}`)}
                    className="btn-primary px-4 py-2"
                  >
                    <Edit3 className="w-4 h-4 mr-2" />
                    Edit Document
                  </button>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Export:</span>
                    <button
                      onClick={() => {
                        setPreviewOpen(false);
                        handleDownload(
                          {
                            id: previewDoc.id,
                            title: previewDoc.title,
                            doc_type: previewDoc.doc_type,
                            created: previewDoc.created_at,
                            modified: previewDoc.updated_at,
                            status: previewDoc.status,
                            size: `${(previewDoc.content || '').split(' ').length} words`,
                            author: 'System',
                            feedback_score: 0, // Default for preview
                          },
                          'MD'
                        );
                      }}
                      className="p-1.5 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      title="Export as Markdown"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setPreviewOpen(false);
                        handleDownload(
                          {
                            id: previewDoc.id,
                            title: previewDoc.title,
                            doc_type: previewDoc.doc_type,
                            created: previewDoc.created_at,
                            modified: previewDoc.updated_at,
                            status: previewDoc.status,
                            size: `${(previewDoc.content || '').split(' ').length} words`,
                            author: 'System',
                            feedback_score: 0, // Default for preview
                          },
                          'PDF'
                        );
                      }}
                      className="p-1.5 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      title="Export as PDF"
                    >
                      <FileText className="w-4 h-4" />
                      <span className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10">PDF</span>
                    </button>
                  </div>
                </>
              )}
              <button
                onClick={() => setPreviewOpen(false)}
                className="btn-secondary px-4 py-2"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ListPage;