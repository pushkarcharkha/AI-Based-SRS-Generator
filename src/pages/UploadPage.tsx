import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File as FileIcon, CheckCircle, AlertCircle, X } from 'lucide-react';

const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';

type UploadStatus = 'queued' | 'uploading' | 'processing' | 'completed' | 'error';

interface UploadedFile {
  id: string;              // local client id
  name: string;
  size: number;
  type: string;
  status: UploadStatus;
  progress: number;        // 0-100
  serverMessage?: string;  // message from backend
  serverDocId?: string;    // created/ingested document id (if any)
}

function UploadPage() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setError(null);

    const toAdd: UploadedFile[] = acceptedFiles.map((file) => ({
      id: Math.random().toString(36).slice(2),
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'queued',
      progress: 0,
    }));

    setFiles((prev) => [...prev, ...toAdd]);

    // Start uploads
    toAdd.forEach((f, idx) => {
      const raw = acceptedFiles[idx];
      uploadOne(f.id, raw);
    });
  }, []);

  const uploadOne = (localId: string, file: File) => {
    // Use XMLHttpRequest to report upload progress
    try {
      const xhr = new XMLHttpRequest();
      const url = `${API_BASE}/api/upload`;
      const form = new FormData();
      form.append('file', file, file.name);

      // Progress
      xhr.upload.onprogress = (evt) => {
        if (!evt.lengthComputable) return;
        const pct = Math.min(100, Math.round((evt.loaded / evt.total) * 100));
        setFiles((prev) =>
          prev.map((f) =>
            f.id === localId ? { ...f, status: pct >= 100 ? 'processing' as const : 'uploading', progress: pct } : f,
          ),
        );
      };

      xhr.onreadystatechange = () => {
        if (xhr.readyState !== XMLHttpRequest.DONE) return;

        if (xhr.status >= 200 && xhr.status < 300) {
          // Success
          let data: any = {};
          try {
            data = JSON.parse(xhr.responseText || '{}');
          } catch {
            // ignore
          }
          setFiles((prev) =>
            prev.map((f) =>
              f.id === localId
                ? {
                    ...f,
                    status: 'completed',
                    progress: 100,
                    serverMessage:
                      data?.message ||
                      data?.status ||
                      'Ingestion complete',
                    serverDocId: data?.document_id || data?.id,
                  }
                : f,
            ),
          );
        } else {
          // Error
          let msg = 'Upload failed';
          try {
            const parsed = JSON.parse(xhr.responseText || '{}');
            msg = parsed.detail || parsed.message || msg;
          } catch {
            // ignore
          }
          setFiles((prev) =>
            prev.map((f) => (f.id === localId ? { ...f, status: 'error', serverMessage: msg } : f)),
          );
        }
      };

      // Kick off
      setFiles((prev) => prev.map((f) => (f.id === localId ? { ...f, status: 'uploading' } : f)));
      xhr.open('POST', url);
      xhr.send(form);
    } catch (e: any) {
      setFiles((prev) =>
        prev.map((f) => (f.id === localId ? { ...f, status: 'error', serverMessage: e?.message || 'Upload error' } : f)),
      );
    }
  };

  const removeFile = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
    },
    multiple: true,
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status: UploadStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'processing':
      case 'uploading':
      case 'queued':
      default:
        return <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Upload Documents</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Upload your historical SRS/SOW/Docs to build the knowledge base for LLM-powered generation and editing.
        </p>
      </div>

      {/* Upload Area */}
      <div className="mb-8">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 cursor-pointer ${
            isDragActive
              ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800'
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <div className="space-y-2">
            <p className="text-lg font-medium text-gray-900 dark:text-white">
              {isDragActive ? 'Drop files here' : 'Click to upload or drag and drop'}
            </p>
            <p className="text-gray-500 dark:text-gray-400">Supports PDF, DOCX, TXT, and MD files</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Uploaded Files</h3>
          </div>
          <div className="p-6 space-y-4">
            {files.map((file) => (
              <div key={file.id} className="flex items-center space-x-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <FileIcon className="w-8 h-8 text-blue-600 flex-shrink-0" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-900 dark:text-white truncate">{file.name}</p>
                    {file.serverDocId && (
                      <span className="text-xs text-gray-500 dark:text-gray-300">Doc ID: {file.serverDocId.slice(0, 8)}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {formatFileSize(file.size)} •{' '}
                    {file.status === 'uploading'
                      ? 'Uploading...'
                      : file.status === 'processing'
                      ? 'Processing...'
                      : file.status === 'completed'
                      ? 'Completed'
                      : file.status === 'queued'
                      ? 'Queued'
                      : 'Error'}
                  </p>

                  {/* Progress bar during upload */}
                  {(file.status === 'uploading' || file.status === 'processing') && (
                    <div className="mt-2">
                      <div className="bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-200"
                          style={{ width: `${file.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Server message if present */}
                  {file.serverMessage && (
                    <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">{file.serverMessage}</div>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  {getStatusIcon(file.status)}
                  <button
                    onClick={() => removeFile(file.id)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    title="Remove"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Documents</h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {files.filter((f) => f.status === 'completed').length}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Processing</h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {files.filter((f) => f.status === 'processing' || f.status === 'uploading').length}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Knowledge Base</h3>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">Active</p>
        </div>
      </div>
    </div>
  );
}

export default UploadPage;