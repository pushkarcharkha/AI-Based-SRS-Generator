import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File as FileIcon, CheckCircle, AlertCircle, X, FileText, FileImage, FileArchive, FilePlus } from 'lucide-react';

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
    <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
          <Upload className="w-8 h-8 mr-3 text-primary-500" />
          Upload Documents
        </h2>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl">
          Upload your historical SRS/SOW/Docs to build the knowledge base for LLM-powered generation and editing.
        </p>
      </div>

      {/* Upload Area */}
      <div className="mb-8">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-8 sm:p-12 text-center transition-all duration-300 cursor-pointer group ${
            isDragActive
              ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20 scale-[1.02]'
              : 'border-gray-300 dark:border-gray-600 hover:border-primary-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:scale-[1.01]'
          }`}
        >
          <input {...getInputProps()} />
          
          {/* Upload Illustration */}
          <div className="mb-6 relative mx-auto w-32 h-32 flex items-center justify-center">
            {isDragActive ? (
              <div className="absolute inset-0 flex items-center justify-center animate-pulse-slow">
                <Upload className="w-20 h-20 text-primary-500" />
              </div>
            ) : (
              <div className="relative">
                <div className="absolute inset-0 flex items-center justify-center opacity-10 group-hover:opacity-5 transition-opacity">
                  <Upload className="w-32 h-32 text-gray-400" />
                </div>
                <div className="relative z-10 grid grid-cols-2 gap-2">
                  <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded-lg transition-all group-hover:scale-105 group-hover:-rotate-3">
                    <FileText className="w-8 h-8 text-primary-600" />
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded-lg transition-all group-hover:scale-105 group-hover:rotate-3">
                    <FileImage className="w-8 h-8 text-red-500" />
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded-lg transition-all group-hover:scale-105 group-hover:rotate-3">
                    <FileArchive className="w-8 h-8 text-yellow-500" />
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded-lg transition-all group-hover:scale-105 group-hover:-rotate-3">
                    <FilePlus className="w-8 h-8 text-green-500" />
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="space-y-3">
            <p className="text-xl font-medium text-gray-900 dark:text-white">
              {isDragActive ? 'Drop files here' : 'Click to upload or drag and drop'}
            </p>
            <p className="text-gray-500 dark:text-gray-400">Supports PDF, DOCX, TXT, and MD files</p>
            
            {/* File Type Icons */}
            <div className="flex items-center justify-center space-x-4 pt-2">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                  <FileText className="w-5 h-5 text-red-500" />
                </div>
                <span className="text-xs text-gray-500 mt-1">PDF</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-500" />
                </div>
                <span className="text-xs text-gray-500 mt-1">DOCX</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 bg-gray-50 dark:bg-gray-700 rounded-full flex items-center justify-center">
                  <FileText className="w-5 h-5 text-gray-500" />
                </div>
                <span className="text-xs text-gray-500 mt-1">TXT</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                  <FileText className="w-5 h-5 text-green-500" />
                </div>
                <span className="text-xs text-gray-500 mt-1">MD</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-lg bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 text-sm flex items-center space-x-2 animate-fade-in">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="card animate-slide-up">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <FileIcon className="w-5 h-5 mr-2 text-primary-500" />
              Uploaded Files
            </h3>
            <span className="text-sm text-gray-500 dark:text-gray-400">{files.length} file(s)</span>
          </div>
          <div className="p-4 sm:p-6 space-y-4">
            {files.map((file) => (
              <div 
                key={file.id} 
                className="flex items-center space-x-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-100 dark:border-gray-600 hover:shadow-sm transition-all duration-200"
              >
                <div className="w-10 h-10 bg-primary-50 dark:bg-primary-900/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <FileIcon className="w-5 h-5 text-primary-600 flex-shrink-0" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-900 dark:text-white truncate">{file.name}</p>
                    {file.serverDocId && (
                      <span className="text-xs bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 px-2 py-1 rounded-full">
                        ID: {file.serverDocId.slice(0, 8)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {formatFileSize(file.size)} •{' '}
                    <span className={
                      file.status === 'completed' ? 'text-green-600 dark:text-green-400' :
                      file.status === 'error' ? 'text-red-600 dark:text-red-400' :
                      'text-primary-600 dark:text-primary-400'
                    }>
                      {file.status === 'uploading'
                        ? 'Uploading...'
                        : file.status === 'processing'
                        ? 'Processing...'
                        : file.status === 'completed'
                        ? 'Completed'
                        : file.status === 'queued'
                        ? 'Queued'
                        : 'Error'}
                    </span>
                  </p>

                  {/* Progress bar during upload */}
                  {(file.status === 'uploading' || file.status === 'processing') && (
                    <div className="mt-3">
                      <div className="bg-gray-200 dark:bg-gray-600 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${file.status === 'processing' ? 'bg-yellow-500 animate-pulse' : 'bg-primary-600'}`}
                          style={{ width: `${file.progress}%` }}
                        />
                      </div>
                      <div className="mt-1 flex justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>{file.progress}%</span>
                        <span>{file.status === 'uploading' ? 'Uploading' : 'Processing'}</span>
                      </div>
                    </div>
                  )}

                  {/* Server message if present */}
                  {file.serverMessage && (
                    <div className={`mt-2 text-xs p-2 rounded ${file.status === 'error' ? 'bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400' : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                      {file.serverMessage}
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 flex items-center justify-center">
                    {getStatusIcon(file.status)}
                  </div>
                  <button
                    onClick={() => removeFile(file.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 hover:text-red-500 transition-colors"
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
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6 animate-slide-up" style={{ animationDelay: '100ms' }}>
        <div className="card hover:translate-y-[-2px] transition-all duration-300">
          <div className="p-6 flex items-center">
            <div className="mr-4 w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Documents</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {files.filter((f) => f.status === 'completed').length}
              </p>
            </div>
          </div>
        </div>

        <div className="card hover:translate-y-[-2px] transition-all duration-300">
          <div className="p-6 flex items-center">
            <div className="mr-4 w-12 h-12 bg-yellow-50 dark:bg-yellow-900/20 rounded-full flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Processing</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {files.filter((f) => f.status === 'processing' || f.status === 'uploading').length}
              </p>
            </div>
          </div>
        </div>

        <div className="card hover:translate-y-[-2px] transition-all duration-300">
          <div className="p-6 flex items-center">
            <div className="mr-4 w-12 h-12 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center">
              <div className="w-3 h-3 bg-green-500 rounded-full relative">
                <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-75" style={{ animationDuration: '2s' }}></div>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Knowledge Base</h3>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">Active</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UploadPage;