import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, MessageSquare, RefreshCw, Send, Eye, Edit3, Columns, LayoutGrid, Maximize2, Minimize2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// Monaco Editor import
import MonacoEditor from '../components/MonacoEditor';

type DocStatus = 'draft' | 'review' | 'final';
type ViewMode = 'edit' | 'preview' | 'split';

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

// Custom styles for TipTap editor
const editorStyles = {
  '.ProseMirror': {
    height: '100%',
    padding: '24px',
    outline: 'none',
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    fontSize: '16px',
    lineHeight: '1.6',
    color: '#333',
    backgroundColor: '#fff',
    overflowY: 'auto',
    boxShadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.05)',
  },
  '.dark .ProseMirror': {
    color: '#e0e0e0',
    backgroundColor: '#1e1e1e',
    boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.05)',
  },
  '.ProseMirror p': {
    marginBottom: '1.2em',
  },
  '.ProseMirror h1, .ProseMirror h2, .ProseMirror h3, .ProseMirror h4, .ProseMirror h5, .ProseMirror h6': {
    fontWeight: '600',
    lineHeight: '1.25',
    marginTop: '1.5em',
    marginBottom: '0.75em',
    color: '#111',
  },
  '.dark .ProseMirror h1, .dark .ProseMirror h2, .dark .ProseMirror h3, .dark .ProseMirror h4, .dark .ProseMirror h5, .dark .ProseMirror h6': {
    color: '#f3f3f3',
  },
  '.ProseMirror h1': { 
    fontSize: '2em', 
    borderBottom: '1px solid #eee', 
    paddingBottom: '0.3em',
    marginTop: '0.5em',
  },
  '.ProseMirror h2': { 
    fontSize: '1.5em', 
    borderBottom: '1px solid #eee', 
    paddingBottom: '0.2em',
    marginTop: '1.2em',
  },
  '.ProseMirror h3': { fontSize: '1.3em' },
  '.ProseMirror h4': { fontSize: '1.2em' },
  '.ProseMirror h5': { fontSize: '1.1em' },
  '.ProseMirror h6': { fontSize: '1em', color: '#555' },
  '.dark .ProseMirror h1, .dark .ProseMirror h2': { borderBottom: '1px solid #333' },
  '.dark .ProseMirror h6': { color: '#aaa' },
  '.ProseMirror ul, .ProseMirror ol': {
    paddingLeft: '1.5em',
    marginBottom: '1.2em',
  },
  '.ProseMirror ul': {
    listStyleType: 'disc',
  },
  '.ProseMirror ol': {
    listStyleType: 'decimal',
  },
  '.ProseMirror li': {
    marginBottom: '0.5em',
    position: 'relative',
  },
  '.ProseMirror li p': {
    marginBottom: '0.5em',
  },
  '.ProseMirror blockquote': {
    borderLeft: '4px solid #ddd',
    paddingLeft: '1.2em',
    fontStyle: 'italic',
    marginLeft: '0',
    marginRight: '0',
    marginBottom: '1.2em',
    color: '#555',
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderRadius: '0 4px 4px 0',
    padding: '0.5em 1.2em 0.5em 1.2em',
  },
  '.dark .ProseMirror blockquote': {
    borderLeft: '4px solid #444',
    color: '#aaa',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  '.ProseMirror code': {
    fontFamily: '"SF Mono", Monaco, Menlo, Consolas, "Ubuntu Mono", monospace',
    backgroundColor: 'rgba(97, 97, 97, 0.1)',
    borderRadius: '3px',
    padding: '0.2em 0.4em',
    fontSize: '0.9em',
    color: '#e83e8c',
  },
  '.dark .ProseMirror code': {
    color: '#f06595',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  '.ProseMirror pre': {
    backgroundColor: '#f6f8fa',
    borderRadius: '5px',
    padding: '0.7em 1em',
    marginBottom: '1.2em',
    overflowX: 'auto',
    border: '1px solid #e1e4e8',
  },
  '.dark .ProseMirror pre': {
    backgroundColor: '#2d333b',
    border: '1px solid #444c56',
  },
  '.ProseMirror pre code': {
    backgroundColor: 'transparent',
    padding: '0',
    fontSize: '0.9em',
    lineHeight: '1.5',
    color: '#333',
  },
  '.dark .ProseMirror pre code': {
    color: '#e0e0e0',
  },
  '.ProseMirror mark': {
    backgroundColor: 'rgba(255, 212, 0, 0.5)',
    borderRadius: '3px',
    padding: '0.1em 0.3em',
  },
  '.ProseMirror a': {
    color: '#0074d9',
    textDecoration: 'underline',
  },
  '.dark .ProseMirror a': {
    color: '#3b9cff',
  },
  '.ProseMirror hr': {
    border: 'none',
    borderTop: '2px solid rgba(97, 97, 97, 0.1)',
    margin: '2em 0',
  },
  '.ProseMirror table': {
    borderCollapse: 'collapse',
    marginBottom: '1.2em',
    width: '100%',
    tableLayout: 'fixed',
    overflow: 'hidden',
    borderRadius: '4px',
    border: '1px solid #ddd',
  },
  '.dark .ProseMirror table': {
    border: '1px solid #444',
  },
  '.ProseMirror table td, .ProseMirror table th': {
    border: '1px solid #ddd',
    padding: '0.5em',
    verticalAlign: 'top',
    position: 'relative',
    minWidth: '75px',
  },
  '.dark .ProseMirror table td, .dark .ProseMirror table th': {
    border: '1px solid #444',
  },
  '.ProseMirror table th': {
    backgroundColor: '#f5f5f5',
    fontWeight: 'bold',
    textAlign: 'left',
  },
  '.dark .ProseMirror table th': {
    backgroundColor: '#333',
  },
  '.ProseMirror table tr:nth-child(even)': {
    backgroundColor: '#f9f9f9',
  },
  '.dark .ProseMirror table tr:nth-child(even)': {
    backgroundColor: '#2a2a2a',
  },
  '.ProseMirror .resize-cursor': {
    cursor: 'col-resize',
    position: 'absolute',
    right: '-2px',
    top: 0,
    bottom: 0,
    width: '4px',
    backgroundColor: '#0074d9',
    opacity: '0.5',
  },
  '.ProseMirror .selectedCell': {
    backgroundColor: 'rgba(200, 200, 255, 0.4)',
  },
  '.dark .ProseMirror .selectedCell': {
    backgroundColor: 'rgba(100, 100, 155, 0.4)',
  },
  '.ProseMirror .tableWrapper': {
    overflow: 'auto',
    marginBottom: '1.2em',
    padding: '0.5em',
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderRadius: '4px',
  },
  '.dark .ProseMirror .tableWrapper': {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  '.ProseMirror .markdown-table': {
    margin: '0 auto',
    overflow: 'hidden',
    borderRadius: '4px',
  },
  // Task list styles
  '.ProseMirror ul[data-type="taskList"]': {
    listStyleType: 'none',
    padding: 0,
    marginBottom: '1.2em',
  },
  '.ProseMirror ul[data-type="taskList"] li': {
    display: 'flex',
    alignItems: 'flex-start',
    marginBottom: '0.5em',
  },
  '.ProseMirror ul[data-type="taskList"] li > label': {
    flexShrink: 0,
    marginRight: '0.5em',
    userSelect: 'none',
  },
  '.ProseMirror ul[data-type="taskList"] li > div': {
    flex: 1,
  },
  '.ProseMirror ul[data-type="taskList"] input[type="checkbox"]': {
    cursor: 'pointer',
    margin: '0.2em 0.5em 0 0',
  },
  '.ProseMirror ul[data-type="taskList"] li[data-checked="true"] > div': {
    textDecoration: 'line-through',
    color: '#999',
  },
  '.dark .ProseMirror ul[data-type="taskList"] li[data-checked="true"] > div': {
    color: '#777',
  },
  
  // Code block styles
  '.ProseMirror .code-block': {
    backgroundColor: '#f6f8fa',
    borderRadius: '5px',
    padding: '0.7em 1em',
    marginBottom: '1.2em',
    overflowX: 'auto',
    border: '1px solid #e1e4e8',
    fontFamily: '"SF Mono", Monaco, Menlo, Consolas, "Ubuntu Mono", monospace',
    fontSize: '0.9em',
    lineHeight: '1.5',
  },
  '.dark .ProseMirror .code-block': {
    backgroundColor: '#2d333b',
    border: '1px solid #444c56',
    color: '#e0e0e0',
  },
  
  // Enhanced diff styles
  '.ProseMirror .diff-removed': {
    backgroundColor: 'rgba(255, 0, 0, 0.15)',
    textDecoration: 'line-through',
    padding: '0.1em 0.3em',
    borderRadius: '3px',
    color: '#b71c1c',
    display: 'inline-block',
    margin: '0 2px',
  },
  '.dark .ProseMirror .diff-removed': {
    backgroundColor: 'rgba(255, 0, 0, 0.2)',
    color: '#ff6b6b',
  },
  '.ProseMirror .diff-added': {
    backgroundColor: 'rgba(0, 200, 0, 0.15)',
    padding: '0.1em 0.3em',
    borderRadius: '3px',
    color: '#1b5e20',
    display: 'inline-block',
    margin: '0 2px',
    fontWeight: '500',
  },
  '.dark .ProseMirror .diff-added': {
    backgroundColor: 'rgba(0, 200, 0, 0.2)',
    color: '#4caf50',
  },
  '.ProseMirror .removed-content': {
    marginBottom: '1.5em',
    padding: '1em',
    borderRadius: '5px',
    backgroundColor: 'rgba(255, 0, 0, 0.05)',
    border: '1px solid rgba(255, 0, 0, 0.2)',
  },
  '.dark .ProseMirror .removed-content': {
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    border: '1px solid rgba(255, 0, 0, 0.3)',
  },
  '.ProseMirror .removed-content h4': {
    marginTop: '0',
    color: '#b71c1c',
    fontSize: '1em',
    fontWeight: '600',
  },
  '.dark .ProseMirror .removed-content h4': {
    color: '#ff6b6b',
  },
  '.ProseMirror .diff-section': {
    borderLeft: '3px solid #0074d9',
    paddingLeft: '1em',
    marginBottom: '1.5em',
    backgroundColor: 'rgba(0, 116, 217, 0.05)',
    borderRadius: '0 4px 4px 0',
    padding: '0.5em 1em',
  },
  '.dark .ProseMirror .diff-section': {
    borderLeft: '3px solid #3b9cff',
    backgroundColor: 'rgba(59, 156, 255, 0.05)',
  },
};

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
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Handle content changes from Monaco Editor
  const handleEditorChange = (newContent: string) => {
    setContent(newContent);
    setIsDirty(true);
  };
  
  // Get the current theme based on system preference
  const [editorTheme, setEditorTheme] = useState<'vs-dark' | 'light'>('vs-dark');
  
  // Detect system theme preference
  useEffect(() => {
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const updateTheme = (e: MediaQueryListEvent | MediaQueryList) => {
      setEditorTheme(e.matches ? 'vs-dark' : 'light');
    };
    
    // Set initial theme
    updateTheme(darkModeMediaQuery);
    
    // Listen for theme changes
    darkModeMediaQuery.addEventListener('change', updateTheme);
    return () => darkModeMediaQuery.removeEventListener('change', updateTheme);
  }, []);

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

  // Function to normalize dashes for export
  const normalizeDashes = (text: string): string => {
    return text
      .replace(/[–—−■]/g, '-') // Replace various dash types with standard ASCII dash
      .replace(/[•]/g, '*');    // Replace bullet points with asterisk
  };
  
  const handleSave = async () => {
    if (!effectiveDocId) return;
    setIsSaving(true);
    setSaveMessage(null);
    try {
      // Normalize dashes before saving
      const normalizedContent = normalizeDashes(content);
      
      const res = await fetch(`${API_BASE}/api/documents/${effectiveDocId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content: normalizedContent,
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
      // Normalize dashes before sending to API
      const normalizedContent = normalizeDashes(content);
      
      const res = await fetch(`${API_BASE}/api/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_id: effectiveDocId,
          content: normalizedContent,
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
      let improved = data.improved_content || data.improvedContent || '';

      // Create a detailed summary with diff information
      let summary = '';
      
      // Check if we have diff details
      if ('diff_details' in data) {
        const diff = (data as any).diff_details;
        summary = '### Changes Applied\n\n';
        
        // Process content with visual diff highlighting
        if ((diff.added && diff.added.length > 0) || (diff.removed && diff.removed.length > 0)) {
          // Start with the original content
          let processedContent = improved || content;
          
          // Create a diff section to wrap all changes
          let diffSectionStart = '<div class="diff-section"><h4>AI Modifications:</h4>';
          let diffSectionEnd = '</div>';
          
          // Define modification type
          interface Modification {
            type: 'added' | 'removed';
            text: string;
            html: string;
            regex?: RegExp;
          }
          
          // Track all modifications for better display
          let modifications: Modification[] = [];
          
          // Process removals first
          if (diff.removed && diff.removed.length > 0) {
            // Add to summary markdown for the chat
            summary += '#### Removed Content\n```diff\n';
            diff.removed.forEach((line: string) => {
              summary += `- ${line}\n`;
              
              // Add to modifications for visual display
              modifications.push({
                type: 'removed',
                text: line,
                html: `<span class="diff-removed">${line}</span>`
              });
            });
            summary += '```\n\n';
          }
          
          // Process additions
          if (diff.added && diff.added.length > 0) {
            // Add to summary markdown for the chat
            summary += '#### Added Content\n```diff\n';
            diff.added.forEach((line: string) => {
              summary += `+ ${line}\n`;
              
              // Escape special regex characters to avoid issues
              const escapedLine = line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              
              // Add to modifications for visual display
              modifications.push({
                type: 'added',
                text: line,
                regex: new RegExp(escapedLine, 'g'),
                html: `<span class="diff-added">${line}</span>`
              });
            });
            summary += '```\n\n';
          }
          
          // Apply all modifications to the content
          // First, handle removals by adding them to the diff section
          let removalsHtml = '';
          modifications
            .filter(mod => mod.type === 'removed')
            .forEach(mod => {
              removalsHtml += `<p>${mod.html}</p>`;
            });
          
          // Then, handle additions by replacing them in the content
          modifications
            .filter(mod => mod.type === 'added' && mod.regex !== undefined)
            .forEach(mod => {
              // We've already filtered for mods with regex
              processedContent = processedContent.replace(
                mod.regex as RegExp,
                mod.html
              );
            });
          
          // Combine everything into the final content with diff highlighting
          if (removalsHtml) {
            diffSectionStart += removalsHtml;
          }
          
          // Insert the diff section at the beginning of the document
          processedContent = diffSectionStart + diffSectionEnd + processedContent;
          
          // Update the improved content with highlighted diffs
          improved = processedContent;
        }
        
        // Add summary if available
        if (diff.summary && diff.summary.length > 0) {
          summary += `#### Summary\n${diff.summary.join('\n')}\n`;
        }
      } else {
        // Fallback to the old summary format if no diff details
        const changesMade = data.changes_made || data.changesMade || [];
        if (changesMade.length) {
          summary = `### ${changesMade.length} Improvement${changesMade.length > 1 ? 's' : ''} Applied\n\n`;
          summary += '```diff\n';
          changesMade.forEach((change: string) => {
            summary += `+ ${change}\n`;
          });
          summary += '```\n\n';
        } else {
          summary = data.message || '### Changes Applied';
        }
        
        if (data.suggestions && data.suggestions.length) {
          summary += `\n\n#### Suggestions for Further Improvement\n`;
          data.suggestions.forEach((suggestion: string) => {
            summary += `- ${suggestion}\n`;
          });
        }
      }

      // Apply the improved content with diff highlighting
      if (improved) {
        setContent(improved);
      }

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
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4 transition-colors duration-300">Review & Edit Document</h2>
              <p className="text-gray-600 dark:text-gray-400 transition-colors duration-300">Loading document...</p>
              <div className="mt-6">
                <div className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg h-64 w-full max-w-2xl mx-auto transition-all duration-300" />
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
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/list')}
              className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-all duration-200 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 hover:shadow-sm transform hover:-translate-x-0.5"
              aria-label="Back to List"
            >
              ← Back to List
            </button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white truncate max-w-md transition-colors duration-300">{title || 'Untitled Document'}</h1>
              {lastUpdatedAt && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Last saved: {new Date(lastUpdatedAt).toLocaleString()}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden shadow-sm">
              <button
                onClick={() => setViewMode('edit')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors duration-200 ${
                  viewMode === 'edit'
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Edit3 className="w-4 h-4 inline mr-1" />
                Edit
              </button>
              <button
                onClick={() => setViewMode('split')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors duration-200 ${
                  viewMode === 'split'
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Columns className="w-4 h-4 inline mr-1" />
                Split
              </button>
              <button
                onClick={() => setViewMode('preview')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors duration-200 ${
                  viewMode === 'preview'
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Eye className="w-4 h-4 inline mr-1" />
                Preview
              </button>
            </div>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 hover:shadow-sm transform hover:scale-110"
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen mode"}
            >
              {isFullscreen ? 
                <Minimize2 className="w-4 h-4" /> : 
                <Maximize2 className="w-4 h-4" />
              }
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !isDirty}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg flex items-center shadow-sm transition-all duration-200 ${
                isSaving || !isDirty
                  ? 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 hover:shadow-md transform hover:-translate-y-0.5'
              }`}
            >
              {isSaving ? <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              Save
            </button>
          </div>
        </div>
        {saveMessage && (
          <div
            className={`mt-2 p-2 text-sm rounded-lg font-medium transition-all duration-300 ${
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
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all duration-200 hover:shadow-md transform hover:-translate-y-0.5"
              >
                Return to Document List
              </button>
            </div>
          </div>
        ) : (
          <div className={`flex w-full h-full ${isFullscreen ? 'fixed inset-0 z-50 bg-white dark:bg-gray-900' : ''}`}>
            {/* Document Editor - Left Side */}
            <div className={`${viewMode === 'split' ? 'w-1/2' : 'flex-1'} h-full overflow-hidden bg-gray-50 dark:bg-gray-900 shadow-inner transition-all duration-300 ${viewMode === 'split' ? 'animate-fadeIn' : ''}`}>
              {viewMode === 'edit' || viewMode === 'split' ? (
                <div className="h-full w-full overflow-hidden bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                  <style>
                    {Object.entries(editorStyles).map(([selector, styles]) => {
                      const cssRules = Object.entries(styles)
                        .map(([property, value]) => `${property}: ${value};`)
                        .join(' ');
                      return `${selector} { ${cssRules} }`;
                    }).join('\n')}
                  </style>
                  <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                      <div className="text-sm font-medium text-gray-600 dark:text-gray-300">
                        {title || 'Untitled Document'}
                      </div>
                      <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                        {lastUpdatedAt && (
                          <span>Last updated: {new Date(lastUpdatedAt).toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                    <MonacoEditor
                      value={content}
                      onChange={handleEditorChange}
                      theme={editorTheme}
                      height="100%"
                      width="100%"
                      options={{
                        wordWrap: 'on',
                        minimap: { enabled: true },
                        scrollBeyondLastLine: false,
                        lineNumbers: 'on',
                        renderLineHighlight: 'all',
                        fontFamily: '"Menlo", "Monaco", "Courier New", monospace',
                        fontSize: 14,
                        lineHeight: 21,
                        padding: { top: 16, bottom: 16 },
                      }}
                    />
                  </div>
                </div>
              ) : null}
            </div>
            
            {/* Preview - Right Side or Full */}
            {viewMode === 'preview' || viewMode === 'split' ? (
              <div className={`${viewMode === 'split' ? 'w-1/2' : 'flex-1'} h-full overflow-hidden bg-gray-50 dark:bg-gray-900 shadow-inner transition-all duration-300 ${viewMode === 'split' ? 'animate-fadeIn' : ''}`}>
                <div className="h-full w-full overflow-hidden bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                      <div className="text-sm font-medium text-gray-600 dark:text-gray-300">
                         {title || 'Untitled Document'} (Preview)
                       </div>
                      <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                        {lastUpdatedAt && (
                          <span>Last updated: {new Date(lastUpdatedAt).toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 overflow-auto p-6">
                      <div className="max-w-4xl mx-auto prose prose-lg dark:prose-invert prose-headings:font-semibold prose-a:text-blue-600 hover:prose-a:text-blue-700 prose-a:transition-colors prose-code:text-blue-600 prose-code:bg-blue-50 dark:prose-code:bg-gray-700 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-blockquote:border-l-4 prose-blockquote:border-blue-500 prose-blockquote:pl-4 prose-blockquote:italic transition-all duration-300">
                        {content ? (
                          <ReactMarkdown>
                            {content}
                          </ReactMarkdown>
                        ) : (
                          <div>
                            <p><strong>No content to preview</strong></p>
                            <p>Start editing to see your document here.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
            
            {/* AI Chat Section - Right Side Panel */}
            <div className={`${isFullscreen ? 'hidden' : 'w-1/3 min-w-[300px] max-w-[500px]'} h-full flex flex-col bg-gray-50 dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 resize-x overflow-hidden shadow-md transition-all duration-300 ${isFullscreen ? '' : 'animate-slideInRight'}`}>
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-800 shadow-sm">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
                  <MessageSquare className="w-5 h-5 mr-2 text-blue-500" />
                  AI Assistant
                </h2>
                <button
                  onClick={handleGeneralReview}
                  disabled={isReviewing || content.trim().length < 10}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg flex items-center transition-all duration-200 ${
                    isReviewing || content.trim().length < 10
                      ? 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400 cursor-not-allowed'
                      : 'bg-green-600 text-white hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 shadow-sm hover:shadow-md transform hover:-translate-y-0.5'
                  }`}
                >
                  {isReviewing ? (
                    <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-1.5" />
                  )}
                  Review
                </button>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4">
                {chat.length === 0 ? (
                  <div className="text-center text-gray-500 dark:text-gray-400 h-full flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 transition-all duration-300 animate-fadeIn">
                    <MessageSquare className="w-8 h-8 mb-2 opacity-50 text-blue-500" />
                    <p className="font-medium">No messages yet</p>
                    <p className="text-sm mt-1">Ask the AI assistant for help or click "Review Document".</p>
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
                          className={`max-w-[85%] rounded-lg p-3 shadow-sm transition-all duration-300 animate-fadeIn ${
                            msg.role === 'user'
                              ? 'bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100 hover:shadow-md'
                              : msg.role === 'system'
                              ? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 text-sm italic'
                              : 'bg-white text-gray-900 dark:bg-gray-700 dark:text-gray-100 border border-gray-200 dark:border-gray-600 hover:shadow-md'
                          }`}
                        >
                          {msg.role === 'assistant' && msg.text.includes('```diff') ? (
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                              <ReactMarkdown
                                components={{
                                  code({ node, className, children, ...props }: React.ComponentPropsWithoutRef<'code'> & {
                                    node?: any;
                                    className?: string;
                                    children?: React.ReactNode;
                                  }) {
                                    const match = /language-(\w+)/.exec(className || '');
                                    const language = match ? match[1] : '';
                                    
                                    if (language === 'diff') {
                                      return (
                                        <div className="bg-gray-50 dark:bg-gray-800 rounded-md p-3 overflow-x-auto border border-gray-200 dark:border-gray-700 shadow-sm">
                                          <div className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Changes:</div>
                                          {String(children)
                                            .split('\n')
                                            .map((line, i) => {
                                              if (line.startsWith('+ ')) {
                                                return (
                                                  <div key={i} className="text-green-600 dark:text-green-400 font-mono text-sm py-0.5 px-1 bg-green-50 dark:bg-green-900/20 rounded">
                                                    {line}
                                                  </div>
                                                );
                                              } else if (line.startsWith('- ')) {
                                                return (
                                                  <div key={i} className="text-red-600 dark:text-red-400 font-mono text-sm py-0.5 px-1 bg-red-50 dark:bg-red-900/20 rounded">
                                                    {line}
                                                  </div>
                                                );
                                              }
                                              return (
                                                <div key={i} className="text-gray-700 dark:text-gray-300 font-mono text-sm py-0.5">
                                                  {line}
                                                </div>
                                              );
                                            })}
                                        </div>
                                      );
                                    }
                                    
                                    return (
                                      <code className={className} {...props}>
                                        {children}
                                      </code>
                                    );
                                  },
                                  h3: ({ children }) => <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400 mt-2 mb-3 border-b border-blue-100 dark:border-blue-900 pb-1">{children}</h3>,
                                  h4: ({ children }) => <h4 className="text-md font-medium text-blue-500 dark:text-blue-300 mt-2 mb-2">{children}</h4>,
                                  p: ({ children }) => {
                                    const text = String(children);
                                    // Check if this paragraph contains text that looks like it's describing changes
                                    if (text.includes('removed') || text.includes('added') || text.includes('changed')) {
                                      // Process the text to highlight changes
                                      const processedText = text
                                        .replace(/removed ([^.,;]+)/g, 'removed <span class="text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-1 rounded">$1</span>')
                                        .replace(/added ([^.,;]+)/g, 'added <span class="text-green-500 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-1 rounded">$1</span>')
                                        .replace(/changed ([^.,;]+) to ([^.,;]+)/g, 'changed <span class="text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-1 rounded">$1</span> to <span class="text-green-500 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-1 rounded">$2</span>');
                                      
                                      return <p className="my-2" dangerouslySetInnerHTML={{ __html: processedText }} />;
                                    }
                                    return <p className="my-2">{children}</p>;
                                  },
                                }}
                              >
                                {msg.text}
                              </ReactMarkdown>
                            </div>
                          ) : (
                            <ReactMarkdown 
                              className="prose prose-sm dark:prose-invert max-w-none"
                              components={{
                                p: ({ children }) => {
                                  const text = String(children);
                                  // Check if this paragraph contains text that looks like it's describing changes
                                  if (text.includes('removed') || text.includes('added') || text.includes('changed')) {
                                    // Process the text to highlight changes
                                    const processedText = text
                                      .replace(/removed ([^.,;]+)/g, 'removed <span class="text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-1 rounded">$1</span>')
                                      .replace(/added ([^.,;]+)/g, 'added <span class="text-green-500 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-1 rounded">$1</span>')
                                      .replace(/changed ([^.,;]+) to ([^.,;]+)/g, 'changed <span class="text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-1 rounded">$1</span> to <span class="text-green-500 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-1 rounded">$2</span>');
                                    
                                    return <p className="my-2" dangerouslySetInnerHTML={{ __html: processedText }} />;
                                  }
                                  return <p className="my-2">{children}</p>;
                                },
                              }}
                            >
                              {msg.text}
                            </ReactMarkdown>
                          )}
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 shadow-inner">
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
                    className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white transition-all duration-200 shadow-sm hover:border-blue-300 dark:hover:border-blue-500"
                  />
                  <button
                    onClick={handleChatSubmit}
                    disabled={chatInput.trim() === '' || isReviewing}
                    className={`p-2 rounded-lg transition-all duration-200 ${
                      chatInput.trim() === '' || isReviewing
                        ? 'bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 shadow-sm hover:shadow-md transform hover:-translate-y-0.5'
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