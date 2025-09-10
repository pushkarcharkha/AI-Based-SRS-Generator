import React, { useRef, useEffect, useState } from 'react';
import Editor, { Monaco } from '@monaco-editor/react';
import { editor } from 'monaco-editor';
import { defineTheme } from '../utils/editorThemes';

interface MonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  theme?: 'vs-dark' | 'light' | 'modern-dark' | 'modern-light';
  height?: string;
  width?: string;
  options?: editor.IStandaloneEditorConstructionOptions;
}

const MonacoEditor: React.FC<MonacoEditorProps> = ({
  value,
  onChange,
  language = 'markdown',
  theme = 'vs-dark',
  height = '100%',
  width = '100%',
  options = {},
}) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [isEditorReady, setIsEditorReady] = useState(false);

  // Configure Monaco editor on mount
  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor, monaco: Monaco) => {
    editorRef.current = editor;
    setIsEditorReady(true);
    
    // Define custom themes
    defineTheme(monaco);
    
    // Configure markdown syntax highlighting
    monaco.languages.setMonarchTokensProvider('markdown', {
      tokenizer: {
        root: [
          // Headers
          [/^\s*#+\s+.*$/, 'keyword'],
          // Bold
          [/\*\*([^\*]+)\*\*/, 'strong'],
          // Italic
          [/\*([^\*]+)\*/, 'emphasis'],
          [/_([^_]+)_/, 'emphasis'],
          // Lists
          [/^\s*[\*\-\+]\s+.*$/, 'variable'],
          [/^\s*\d+\.\s+.*$/, 'variable'],
          // Links
          [/\[([^\]]+)\]\(([^\)]+)\)/, 'string'],
          // Code blocks
          [/```[\s\S]*?```/, 'comment'],
          [/`[^`]+`/, 'comment'],
          // Tables
          [/^\s*\|(.+)\|\s*$/, 'type'],
          [/^\s*\|\s*[-:]+[-\s|:]*[-:]\s*\|\s*$/, 'type'],
        ],
      },
    });

    // Normalize dashes on content change
    editor.onDidChangeModelContent(() => {
      const value = editor.getValue();
      // Only trigger onChange when content actually changes to avoid loops
      onChange(normalizeDashes(value));
    });
  };

  // Function to normalize dashes for export
  const normalizeDashes = (text: string): string => {
    return text
      .replace(/[–—−■]/g, '-') // Replace various dash types with standard ASCII dash
      .replace(/[•]/g, '*');    // Replace bullet points with asterisk
  };

  // Default editor options with good defaults for markdown editing
  const defaultOptions: editor.IStandaloneEditorConstructionOptions = {
    wordWrap: 'on',
    minimap: { enabled: true },
    scrollBeyondLastLine: false,
    lineNumbers: 'on',
    renderLineHighlight: 'all',
    fontFamily: '"Menlo", "Monaco", "Courier New", monospace',
    fontSize: 14,
    lineHeight: 21,
    padding: { top: 16, bottom: 16 },
    scrollbar: {
      useShadows: false,
      verticalScrollbarSize: 10,
      horizontalScrollbarSize: 10,
    },
    ...options,
  };

  return (
    <div style={{ height, width, border: '1px solid #30363d', borderRadius: '6px', overflow: 'hidden', transition: 'all 0.3s ease' }}>
      <Editor
        height={height}
        width={width}
        language={language}
        value={value}
        theme={theme === 'vs-dark' ? 'modern-dark' : theme === 'light' ? 'modern-light' : theme}
        options={defaultOptions}
        onMount={handleEditorDidMount}
      />
    </div>
  );
};

export default MonacoEditor;