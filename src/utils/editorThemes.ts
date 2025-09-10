import { Monaco } from '@monaco-editor/react';

/**
 * Define custom Monaco Editor themes for the application
 */
export const defineTheme = (monaco: Monaco) => {
  // Modern Dark Theme - High contrast, better readability
  monaco.editor.defineTheme('modern-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'C586C0', fontStyle: 'bold' },
      { token: 'string', foreground: 'CE9178' },
      { token: 'number', foreground: 'B5CEA8' },
      { token: 'regexp', foreground: 'D16969' },
      { token: 'operator', foreground: 'D4D4D4' },
      { token: 'namespace', foreground: 'D4D4D4' },
      { token: 'type', foreground: '4EC9B0' },
      { token: 'struct', foreground: '4EC9B0' },
      { token: 'class', foreground: '4EC9B0', fontStyle: 'bold' },
      { token: 'interface', foreground: '4EC9B0' },
      { token: 'enum', foreground: '4EC9B0' },
      { token: 'typeParameter', foreground: '4EC9B0' },
      { token: 'function', foreground: 'DCDCAA' },
      { token: 'member', foreground: 'DCDCAA' },
      { token: 'macro', foreground: 'DCDCAA' },
      { token: 'variable', foreground: '9CDCFE' },
      { token: 'parameter', foreground: '9CDCFE' },
      { token: 'property', foreground: '9CDCFE' },
      { token: 'enumMember', foreground: '9CDCFE' },
      { token: 'event', foreground: '9CDCFE' },
      { token: 'label', foreground: '9CDCFE' },
      
      // Markdown specific
      { token: 'emphasis', fontStyle: 'italic' },
      { token: 'strong', fontStyle: 'bold', foreground: 'DCDCAA' },
      { token: 'keyword.md', foreground: '569CD6', fontStyle: 'bold' }, // Headers
      { token: 'string.md', foreground: '4EC9B0' },  // Links
      { token: 'variable.md', foreground: 'CE9178' }, // Lists
      { token: 'comment.md', foreground: '608B4E' },  // Code blocks
      { token: 'type.md', foreground: '9CDCFE' },     // Tables
    ],
    colors: {
      'editor.background': '#1E1E1E',
      'editor.foreground': '#D4D4D4',
      'editorCursor.foreground': '#FFFFFF',
      'editor.lineHighlightBackground': '#2D2D30',
      'editorLineNumber.foreground': '#858585',
      'editor.selectionBackground': '#264F78',
      'editor.inactiveSelectionBackground': '#3A3D41',
      'editorIndentGuide.background': '#404040',
      'editorIndentGuide.activeBackground': '#707070',
      'editor.selectionHighlightBackground': '#ADD6FF26',
      'editor.wordHighlightBackground': '#575757B8',
      'editor.wordHighlightStrongBackground': '#004972B8',
      'editorSuggestWidget.background': '#252526',
      'editorSuggestWidget.border': '#454545',
      'editorSuggestWidget.foreground': '#D4D4D4',
      'editorSuggestWidget.highlightForeground': '#18A3FF',
      'editorSuggestWidget.selectedBackground': '#062F4A',
      'editorWidget.background': '#252526',
      'editorWidget.border': '#454545',
      'input.background': '#3C3C3C',
      'input.border': '#5F5F5F',
      'input.foreground': '#CCCCCC',
    },
  });

  // Modern Light Theme - Better contrast and readability
  monaco.editor.defineTheme('modern-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '008000', fontStyle: 'italic' },
      { token: 'keyword', foreground: '0000FF', fontStyle: 'bold' },
      { token: 'string', foreground: 'A31515' },
      { token: 'number', foreground: '098658' },
      { token: 'regexp', foreground: '811F3F' },
      { token: 'operator', foreground: '000000' },
      { token: 'namespace', foreground: '000000' },
      { token: 'type', foreground: '267F99' },
      { token: 'struct', foreground: '267F99' },
      { token: 'class', foreground: '267F99', fontStyle: 'bold' },
      { token: 'interface', foreground: '267F99' },
      { token: 'enum', foreground: '267F99' },
      { token: 'typeParameter', foreground: '267F99' },
      { token: 'function', foreground: '795E26' },
      { token: 'member', foreground: '795E26' },
      { token: 'macro', foreground: '795E26' },
      { token: 'variable', foreground: '001080' },
      { token: 'parameter', foreground: '001080' },
      { token: 'property', foreground: '001080' },
      { token: 'enumMember', foreground: '001080' },
      { token: 'event', foreground: '001080' },
      { token: 'label', foreground: '001080' },
      
      // Markdown specific
      { token: 'emphasis', fontStyle: 'italic' },
      { token: 'strong', fontStyle: 'bold', foreground: '0000FF' },
      { token: 'keyword.md', foreground: '0000FF', fontStyle: 'bold' }, // Headers
      { token: 'string.md', foreground: '267F99' },  // Links
      { token: 'variable.md', foreground: 'A31515' }, // Lists
      { token: 'comment.md', foreground: '008000' },  // Code blocks
      { token: 'type.md', foreground: '001080' },     // Tables
    ],
    colors: {
      'editor.background': '#FFFFFF',
      'editor.foreground': '#000000',
      'editorCursor.foreground': '#000000',
      'editor.lineHighlightBackground': '#F3F3F3',
      'editorLineNumber.foreground': '#237893',
      'editor.selectionBackground': '#ADD6FF',
      'editor.inactiveSelectionBackground': '#E5EBF1',
      'editorIndentGuide.background': '#D3D3D3',
      'editorIndentGuide.activeBackground': '#939393',
      'editor.selectionHighlightBackground': '#ADD6FF80',
      'editor.wordHighlightBackground': '#57575740',
      'editor.wordHighlightStrongBackground': '#0E639C40',
      'editorSuggestWidget.background': '#F3F3F3',
      'editorSuggestWidget.border': '#C8C8C8',
      'editorSuggestWidget.foreground': '#000000',
      'editorSuggestWidget.highlightForeground': '#0066BF',
      'editorSuggestWidget.selectedBackground': '#D6EBFF',
      'editorWidget.background': '#F3F3F3',
      'editorWidget.border': '#C8C8C8',
      'input.background': '#FFFFFF',
      'input.border': '#858585',
      'input.foreground': '#000000',
    },
  });
};