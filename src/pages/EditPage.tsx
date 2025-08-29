import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { Save, MessageSquare, RefreshCw, Send, Eye, Edit3 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

type DocStatus = 'draft' | 'review' | 'final';
type ViewMode = 'edit' | 'preview';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

type ReviewAgentResponse = {
  improved_content?: string;
  improvedContent?: string;
  changes_made?: string[];
  changesMade?: string[];
  suggestions?: string[];
  message?: string;
};

type DocumentResponse = {
  id: string;
  title: string;
  content: string;
  doc_type: string;
  status: DocStatus;
  created_at: string;
  updated_at: string;
};

type DocumentListItem = {
  id: string;
  title: string;
  doc_type: string;
  created: string;
  modified: string;
  status: DocStatus;
  size: string;
  author: string;
};

type ChatMsg = { role: 'user' | 'assistant' | 'system'; text: string; ts: number };

// Type for Monaco Editor instance
type MonacoEditor = {
  focus: () => void;
  getValue: () => string;
  setValue: (value: string) => void;
  // Add other Monaco editor methods as needed
} | null;

function EditPage() {
  const params = useParams();
  const navigate = useNavigate();

  const [documentId, setDocumentId] = useState<string | null>(null);
  const [title, setTitle] = useState<string>('');
  const [docType, setDocType] = useState<string>('');
  const [status, setStatus] = useState<DocStatus>('draft');

  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isReviewing, setIsReviewing] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // AI Chatbot state
  const [chatInput, setChatInput] = useState<string>('');
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>('edit');
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>('');

  const editorRef = useRef<MonacoEditor>(null);
  const handleEditorDidMount = (editor: MonacoEditor) => {
    editorRef.current = editor;
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat]);

  // Keyboard shortcut: Ctrl/Cmd + S to save
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      if ((isMac && e.metaKey && e.key.toLowerCase() === 's') || (!isMac && e.ctrlKey && e.key.toLowerCase() === 's')) {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, title, status, isSaving]);

  const effectiveDocId = useMemo(() => params.id || documentId, [params.id, documentId]);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        let id = params.id;

        if (!id) {
          // Load the most recent document to ensure preview shows directly
          const listRes = await fetch(`${API_BASE}/api/documents`);
          if (!listRes.ok) throw new Error('Unable to load documents');
          const list: DocumentListItem[] = await listRes.json();
          if (!list.length) {
            setIsLoading(false);
            setLoadError('No documents found. Generate or upload to begin editing.');
            return;
          }
          id = list[0].id;
          setDocumentId(id);
          // Navigate to canonical URL for consistency, but keep layout intact
          navigate(`/edit/${id}`, { replace: true });
        }

        const res = await fetch(`${API_BASE}/api/documents/${id}`);
        if (!res.ok) {
          let errorMessage = 'Failed to fetch document';
          try {
            const err = await res.json();
            errorMessage = err.detail || errorMessage;
          } catch {
            // If JSON parsing fails, use default message
          }
          throw new Error(errorMessage);
        }

        const data: DocumentResponse = await res.json();
        setTitle(data.title);
        setDocType(data.doc_type);
        setStatus(data.status);
        setContent(data.content || '');
        setLastUpdatedAt(data.updated_at || '');
        setIsLoading(false);

        // Seed system chat message one time
        setChat((prev) =>
          prev.length
            ? prev
            : [
                {
                  role: 'system',
                  text:
                    'You can instruct the AI to modify the current document. For example: "Make the introduction more concise" or "Add a section on non-functional requirements."',
                  ts: Date.now(),
                },
              ],
        );
      } catch (e) {
        const error = e as Error;
        setLoadError(error.message || 'Failed to load document');
        setIsLoading(false);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const handleSave = async () => {
    if (!effectiveDocId) return;
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch(`${API_BASE}/api/documents/${effectiveDocId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          status,
        }),
      });
      if (!res.ok) {
        let errorMessage = 'Failed to save document';
        try {
          const err = await res.json();
          errorMessage = err.detail || errorMessage;
        } catch {
          // If JSON parsing fails, use default message
        }
        throw new Error(errorMessage);
      }
      setSaveMessage('Saved');
      setIsDirty(false);
      setLastUpdatedAt(new Date().toISOString());
      setTimeout(() => setSaveMessage(null), 1500);
    } catch (e) {
      const error = e as Error;
      setSaveMessage(error.message || 'Save failed');
      setTimeout(() => setSaveMessage(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const callReviewAPI = async (feedbackList?: string[]) => {
    if (!effectiveDocId) return;
    setIsReviewing(true);
    try {
      const res = await fetch(`${API_BASE}/api/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_id: effectiveDocId,
          content,
          feedback: feedbackList && feedbackList.length ? feedbackList : undefined,
        }),
      });

      if (!res.ok) {
        let errorMessage = 'AI review failed';
        try {
          const err = await res.json();
          errorMessage = err.detail || errorMessage;
        } catch {
          // If JSON parsing fails, use default message
        }
        throw new Error(errorMessage);
      }

      const data: ReviewAgentResponse = await res.json();
      const improved = data.improved_content || data.improvedContent || '';

      if (improved) {
        setContent(improved);
      }

      const summary =
        (data.changes_made && data.changes_made.length
          ? `Applied ${data.changes_made.length} improvement(s).`
          : data.changesMade && data.changesMade.length
          ? `Applied ${data.changesMade.length} improvement(s).`
          : data.message || 'Changes applied.') +
        (data.suggestions && data.suggestions.length ? ` Suggestions: ${data.suggestions.join('; ')}` : '');

      // Append bot note
      setChat((prev) => [
        ...prev,
        { role: 'assistant', text: summary || 'Applied changes.', ts: Date.now() },
      ]);
    } catch (e) {
      const error = e as Error;
      setChat((prev) => [
        ...prev,
        { role: 'assistant', text: error.message || 'Review failed', ts: Date.now() },
      ]);
    } finally {
      setIsReviewing(false);
    }
  };

  // General AI Review (no feedback)
  const handleGeneralReview = async () => {
    setChat((prev) => [
      ...prev,
      { role: 'user', text: 'Please review and improve the document overall.', ts: Date.now() },
    ]);
    await callReviewAPI();
  };

  // Chat submit to apply targeted edits
  const handleChatSubmit = async () => {
    const text = chatInput.trim();
    if (!text) return;
    setChatInput('');
    setChat((prev) => [...prev, { role: 'user', text, ts: Date.now() }]);
    await callReviewAPI([text]);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Review & Edit Document</h2>
            <p className="text-gray-600 dark:text-gray-400">Loading document...</p>
            <div className="mt-6">
              <div className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg h-64 w-full max-w-2xl mx-auto" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Review & Edit Document</h2>
            <div className="p-4 rounded-lg bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 mb-6">
              {loadError}
            </div>
            <div className="flex justify-center space-x-3">
              <button
                onClick={() => navigate('/generate')}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Generate Document
              </button>
              <button
                onClick={() => navigate('/upload')}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-700 transition-colors"
              >
                Upload SRS
              </button>
              <button
                onClick={() => navigate('/list')}
                className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Export/List
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Review & Edit Document</h2>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <input
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="Untitled Document"
                  className="w-full sm:w-[420px] px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wide px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    {docType || 'Document'}
                  </span>
                  <select
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value as DocStatus);
                      setIsDirty(true);
                    }}
                    className="text-sm px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
                  >
                    <option value="draft">Draft</option>
                    <option value="review">Review</option>
                    <option value="final">Final</option>
                  </select>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {isDirty ? <span className="text-yellow-600 dark:text-yellow-400">• Unsaved</span> : lastUpdatedAt ? `Updated ${new Date(lastUpdatedAt).toLocaleString()}` : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {/* View Mode Toggle */}
              <div className="flex items-center rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <button
                  onClick={() => setViewMode('edit')}
                  className={`px-4 py-2 text-sm font-medium flex items-center space-x-2 ${
                    viewMode === 'edit' 
                      ? 'bg-blue-600 text-white' 
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <Edit3 className="w-4 h-4" />
                  <span>Editor</span>
                </button>
                <button
                  onClick={() => setViewMode('preview')}
                  className={`px-4 py-2 text-sm font-medium flex items-center space-x-2 border-l border-gray-200 dark:border-gray-700 ${
                    viewMode === 'preview' 
                      ? 'bg-blue-600 text-white' 
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  <span>Preview</span>
                </button>
              </div>

              {/* Action Buttons */}
              <button
                onClick={handleGeneralReview}
                disabled={isReviewing || !effectiveDocId}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
              >
                {isReviewing ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                <span>{isReviewing ? 'Reviewing...' : 'AI Review'}</span>
              </button>

              <button
                onClick={handleSave}
                disabled={isSaving || !effectiveDocId}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Saving...' : 'Save'}</span>
              </button>

              {saveMessage && (
                <span className="text-sm text-green-600 dark:text-green-400">{saveMessage}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Document Editor or Preview - Full Screen */}
        <div className="flex-1 bg-gray-50 dark:bg-gray-900 p-6">
          <div className="max-w-7xl mx-auto h-full">
            {viewMode === 'edit' ? (
              <div className="h-full bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Document Editor</h3>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Markdown supported • Ctrl/Cmd + S to save
                  </div>
                </div>
                <div className="h-[calc(100%-73px)]">
                  <Editor
                    height="600px"
                    defaultLanguage="markdown"
                    value={content}
                    onChange={(value) => {
                      setContent(value || '');
                      setIsDirty(true);
                    }}
                    onMount={handleEditorDidMount}
                    theme="vs-dark"
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      lineNumbers: 'on',
                      wordWrap: 'on',
                      automaticLayout: true,
                      scrollBeyondLastLine: false,
                      padding: { top: 20, bottom: 20 },
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="h-full bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Live Preview</h3>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Rendered from Markdown
                  </div>
                </div>
                <div className="h-[calc(100%-73px)] overflow-auto p-8">
                  <div className="prose prose-lg dark:prose-invert max-w-none">
                    <ReactMarkdown>{content || '**No content to preview**\n\nStart editing to see your document here.'}</ReactMarkdown>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* AI Assistant - Fixed Height Bottom Panel */}
        <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex flex-col h-80">
              {/* Assistant Header */}
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-gray-900 dark:text-white flex items-center">
                  <MessageSquare className="w-5 h-5 mr-2" />
                  AI Edit Assistant
                </h4>
                <div className="flex items-center space-x-3">
                  <div className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    {status}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    ID: {effectiveDocId?.slice(0, 8)}
                  </div>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 bg-gray-50 dark:bg-gray-900 rounded-lg p-4 overflow-auto mb-4">
                <div className="space-y-3">
                  {chat.map((m) => (
                    <div
                      key={m.ts}
                      className={`max-w-[85%] px-4 py-2 rounded-lg text-sm ${
                        m.role === 'user'
                          ? 'ml-auto bg-blue-600 text-white'
                          : m.role === 'assistant'
                          ? 'mr-auto bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700'
                          : 'mx-auto bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-center'
                      }`}
                    >
                      {m.text}
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
              </div>

              {/* Chat Input */}
              <div className="flex items-center space-x-3">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleChatSubmit();
                    }
                  }}
                  placeholder="Describe your edit... e.g., 'Tighten the Introduction and add Performance NFRs.'"
                  className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={handleChatSubmit}
                  disabled={isReviewing || !chatInput.trim()}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center space-x-2 font-medium"
                >
                  <Send className="w-4 h-4" />
                  <span>{isReviewing ? 'Applying...' : 'Apply'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EditPage;