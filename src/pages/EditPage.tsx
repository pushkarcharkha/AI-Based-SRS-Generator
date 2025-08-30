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
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/list')}
              className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              ← Back to List
            </button>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{title || 'Untitled Document'}</h1>
            {lastUpdatedAt && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Last saved: {new Date(lastUpdatedAt).toLocaleString()}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex border border-gray-300 dark:border-gray-600 rounded-md">
              <button
                onClick={() => setViewMode('edit')}
                className={`px-3 py-1 text-sm ${
                  viewMode === 'edit'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                    : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                <Edit3 className="w-4 h-4 inline mr-1" />
                Edit
              </button>
              <button
                onClick={() => setViewMode('preview')}
                className={`px-3 py-1 text-sm ${
                  viewMode === 'preview'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                    : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                <Eye className="w-4 h-4 inline mr-1" />
                Preview
              </button>
            </div>
            <button
              onClick={handleSave}
              disabled={isSaving || !isDirty}
              className={`px-3 py-1 text-sm font-medium rounded-md flex items-center ${
                isSaving || !isDirty
                  ? 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600'
              }`}
            >
              {isSaving ? <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              Save
            </button>
          </div>
        </div>
        {saveMessage && (
          <div
            className={`mt-2 p-2 text-sm rounded ${
              saveMessage.includes('Error')
                ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
            }`}
          >
            {saveMessage}
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex">
        {isLoading ? (
          <div className="h-full flex items-center justify-center w-full">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : loadError ? (
          <div className="h-full flex items-center justify-center w-full">
            <div className="text-red-500 dark:text-red-400 text-center">
              <p className="text-xl font-semibold">Error Loading Document</p>
              <p className="mt-2">{loadError}</p>
              <button
                onClick={() => navigate('/list')}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Return to Document List
              </button>
            </div>
          </div>
        ) : (
          <div className="flex w-full h-full">
            {/* Document Editor - Left Side */}
            <div className="flex-1 h-full overflow-hidden">
              {viewMode === 'edit' ? (
                <Editor
                  height="100%"
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
                    wordWrap: 'on',
                    lineNumbers: 'on',
                    fontSize: 14,
                    automaticLayout: true,
                    scrollBeyondLastLine: false,
                    padding: { top: 20, bottom: 20 },
                  }}
                />
              ) : (
                <div className="h-full overflow-auto p-6 bg-white dark:bg-gray-800">
                  <div className="max-w-4xl mx-auto prose dark:prose-invert">
                    <ReactMarkdown>{content || '**No content to preview**\n\nStart editing to see your document here.'}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>

            {/* AI Chat Section - Right Side Panel */}
            <div className="w-1/3 min-w-[300px] max-w-[500px] h-full flex flex-col bg-gray-50 dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 resize-x overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
                  <MessageSquare className="w-5 h-5 mr-2" />
                  AI Assistant
                </h2>
                <button
                  onClick={handleGeneralReview}
                  disabled={isReviewing || content.trim().length < 10}
                  className={`px-3 py-1 text-sm font-medium rounded-md flex items-center ${
                    isReviewing || content.trim().length < 10
                      ? 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400 cursor-not-allowed'
                      : 'bg-green-600 text-white hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600'
                  }`}
                >
                  {isReviewing ? (
                    <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-1" />
                  )}
                  Review
                </button>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4">
                {chat.length === 0 ? (
                  <div className="text-center text-gray-500 dark:text-gray-400 h-full flex flex-col items-center justify-center">
                    <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
                    <p>No messages yet. Ask the AI assistant for help or click "Review Document".</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {chat.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex ${
                          msg.role === 'user' ? 'justify-end' : msg.role === 'system' ? 'justify-center' : 'justify-start'
                        }`}
                      >
                        <div
                          className={`max-w-3/4 rounded-lg p-3 ${
                            msg.role === 'user'
                              ? 'bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100'
                              : msg.role === 'system'
                              ? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 text-sm italic'
                              : 'bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-100'
                          }`}
                        >
                          <ReactMarkdown>{msg.text}</ReactMarkdown>
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleChatSubmit();
                      }
                    }}
                    placeholder="Ask the AI assistant for help..."
                    className="flex-1 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                  <button
                    onClick={handleChatSubmit}
                    disabled={chatInput.trim() === '' || isReviewing}
                    className={`p-2 rounded-md ${
                      chatInput.trim() === '' || isReviewing
                        ? 'bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600'
                    }`}
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default EditPage;