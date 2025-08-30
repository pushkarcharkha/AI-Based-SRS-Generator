import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Edit3, Trash2, Search, Filter, Eye, X } from 'lucide-react';
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
    return documents.filter((doc) => {
      const matchesSearch =
        doc.title.toLowerCase().includes(term) || doc.doc_type.toLowerCase().includes(term);
      const matchesType = filterType === 'all' || doc.doc_type === filterType;
      const matchesStatus = filterStatus === 'all' || doc.status === filterStatus;
      return matchesSearch && matchesType && matchesStatus;
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
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Document Library</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Manage, export, and organize all your generated documents.
        </p>
      </div>

      {/* Filters and Search */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
        {err && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 text-sm">
            <strong>Error:</strong> {err}
          </div>
        )}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 md:space-x-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div className="flex space-x-4">
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="animate-pulse h-6 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-3" />
              <div className="animate-pulse h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-6" />
              <div className="space-y-2">
                <div className="animate-pulse h-3 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="animate-pulse h-3 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="animate-pulse h-3 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {filteredDocuments.length === 0 && !err ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No documents found</h3>
              <p className="text-gray-600 dark:text-gray-400">
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
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white">{doc.title}</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{doc.doc_type}</p>
                        </div>
                      </div>

                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(doc.status)}`}>
                        {doc.status}
                      </span>
                    </div>

                    <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
                      <div className="flex justify-between">
                        <span>Created:</span>
                        <span>{new Date(doc.created).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Modified:</span>
                        <span>{new Date(doc.modified).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Size:</span>
                        <span>{doc.size}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Feedback Score:</span>
                        <span>{doc.feedback_score}</span>
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      <button
                        onClick={() => handlePreview(doc.id)}
                        disabled={busyId === doc.id}
                        className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center justify-center space-x-1 disabled:opacity-50"
                      >
                        <Eye className="w-4 h-4" />
                        <span>Preview</span>
                      </button>

                      <button
                        onClick={() => handleEdit(doc.id)}
                        disabled={busyId === doc.id}
                        className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center space-x-1 disabled:opacity-50"
                      >
                        <Edit3 className="w-4 h-4" />
                        <span>Edit</span>
                      </button>
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Export as:</span>
                        <div className="flex space-x-1">
                          <button
                            onClick={() => handleDownload(doc, 'MD')}
                            disabled={busyId === doc.id}
                            className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                          >
                            MD
                          </button>
                          <button
                            onClick={() => handleDownload(doc, 'PDF')}
                            disabled={busyId === doc.id}
                            className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                          >
                            PDF
                          </button>
                          <button
                            onClick={() => handleDownload(doc, 'DOCX')}
                            disabled={busyId === doc.id}
                            className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                          >
                            DOCX
                          </button>
                          <button
                            onClick={() => handleDownload(doc, 'LaTeX')}
                            disabled={busyId === doc.id}
                            className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                          >
                            LaTeX
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700/50 rounded-b-xl">
                    <button
                      onClick={() => handleDelete(doc.id)}
                      disabled={busyId === doc.id}
                      className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm font-medium flex items-center space-x-1 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {filteredDocuments.length === 0 && err && (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Error Loading Documents</h3>
              <p className="text-gray-600 dark:text-gray-400">{err}</p>
            </div>
          )}

          {/* Stats Summary */}
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{documents.length}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Total Documents</div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 text-center">
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {documents.filter((d) => d.status === 'draft').length}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Drafts</div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {documents.filter((d) => d.status === 'review').length}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">In Review</div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 text-center">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setPreviewOpen(false)}
            aria-hidden="true"
          />
          <div className="relative bg-white dark:bg-gray-900 w-full max-w-4xl rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <div className="font-semibold text-gray-900 dark:text-white">Preview</div>
              <button
                onClick={() => setPreviewOpen(false)}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto p-4">
              {previewLoading ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  Loading content...
                </div>
              ) : previewDoc ? (
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown>{previewDoc.content || ''}</ReactMarkdown>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  Unable to load document. {err ? `Error: ${err}` : 'Please try again.'}
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end space-x-2">
              {previewDoc && (
                <>
                  <button
                    onClick={() => navigate(`/edit/${previewDoc.id}`)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Edit
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
                        'MD'
                      );
                    }}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
                  >
                    Export as MD
                  </button>
                </>
              )}
              <button
                onClick={() => setPreviewOpen(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
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