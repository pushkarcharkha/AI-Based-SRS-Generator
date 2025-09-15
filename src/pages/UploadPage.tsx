import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File as FileIcon, CheckCircle, AlertCircle, X, FileText, FileImage, FileArchive, FilePlus, Camera } from 'lucide-react';

const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';

// Define OCR processing mode
type ProcessingMode = 'regular' | 'ocr';

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
  const [processingMode, setProcessingMode] = useState<ProcessingMode>('regular');

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
      // Use different endpoint based on processing mode
      const url = processingMode === 'ocr' 
        ? `${API_BASE}/api/multimodal` 
        : `${API_BASE}/api/upload`;
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
    <div className="container mx-auto p-6 max-w-5xl animate-fade-in">
      <div className="mb-8">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent mb-4 flex items-center border-b pb-3">
          <Upload className="w-8 h-8 mr-3 text-primary-500" />
          Document Management
        </h2>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl">
          Upload your historical SRS/SOW/Docs to build the knowledge base for LLM-powered generation and editing.
        </p>
      </div>

      {/* Processing Mode Selection */}
      <div className="mb-8 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg transition-all duration-300 hover:shadow-xl">
        <h2 className="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-300">Select Processing Mode</h2>
        <div className="flex flex-wrap gap-4">
          <button
            onClick={() => setProcessingMode('regular')}
            className={`flex items-center px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
              processingMode === 'regular' 
                ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-md' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <FileText className="mr-2 h-5 w-5" />
            <span>Regular Document Upload</span>
          </button>
          
          <button
            onClick={() => setProcessingMode('ocr')}
            className={`flex items-center px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
              processingMode === 'ocr' 
                ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-md' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <Camera className="mr-2 h-5 w-5" />
            <span>Image OCR Processing</span>
          </button>
        </div>
      </div>

      {/* Upload Area */}
      <div className="mb-8">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-10 sm:p-12 text-center transition-all duration-300 cursor-pointer group ${
            isDragActive
              ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20 scale-[1.02] shadow-lg'
              : 'border-gray-300 dark:border-gray-600 hover:border-primary-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:scale-[1.01] hover:shadow-md'
          }`}
        >
          <input {...getInputProps()} />
          
          {/* Upload Illustration */}
          <div className="mb-6 relative mx-auto w-32 h-32 flex items-center justify-center">
            {isDragActive ? (
              <div className="absolute inset-0 flex items-center justify-center animate-pulse-slow">
                {processingMode === 'ocr' ? (
                  <Camera className="w-20 h-20 text-primary-500" />
                ) : (
                  <Upload className="w-20 h-20 text-primary-500" />
                )}
              </div>
            ) : (
              <div className="relative">
                <div className="absolute inset-0 flex items-center justify-center opacity-10 group-hover:opacity-5 transition-opacity">
                  {processingMode === 'ocr' ? (
                    <Camera className="w-32 h-32 text-gray-400" />
                  ) : (
                    <Upload className="w-32 h-32 text-gray-400" />
                  )}
                </div>
                <div className="relative z-10 grid grid-cols-2 gap-2">
                  {processingMode === 'ocr' ? (
                    <>
                      <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded-lg transition-all group-hover:scale-105 group-hover:-rotate-3">
                        <FileImage className="w-8 h-8 text-primary-600" />
                      </div>
                      <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded-lg transition-all group-hover:scale-105 group-hover:rotate-3">
                        <Camera className="w-8 h-8 text-red-500" />
                      </div>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <div className="space-y-3">
            <p className="text-xl font-medium text-gray-900 dark:text-white">
              {isDragActive ? 'Drop files here' : 'Click to upload or drag and drop'}
            </p>
            <p className="text-gray-500 dark:text-gray-400">
              {processingMode === 'ocr' ? 'Supports PNG, JPG, and other image formats' : 'Supports PDF, DOCX, TXT, and MD files'}
            </p>
            
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
        <div className="mt-8">
          <h3 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200 flex items-center">
            <FileText className="mr-2 h-5 w-5 text-primary-500" />
            Uploaded Files
          </h3>
          <div className="space-y-4">
            {files.map((file) => (
              <div 
                key={file.id} 
                className="border dark:border-gray-700 rounded-lg p-4 flex items-center bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-all duration-200"
              >
                <div className="mr-4 p-3 rounded-full bg-gray-100 dark:bg-gray-700">
                  {getFileIcon(file.type)}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <div className="font-medium text-gray-900 dark:text-gray-100 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">{file.name}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 px-3 py-1 rounded-full shadow-sm">
                      {formatFileSize(file.size)}
                    </div>
                  </div>
                  
                  {/* Progress bar */}
                  {file.status === 'uploading' && (
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mt-3">
                      <div 
                        className="bg-primary-500 h-3 rounded-full transition-all duration-300" 
                        style={{ width: `${file.progress}%` }}
                      ></div>
                    </div>
                  )}
                  
                  {/* Status message */}
                  <div className="text-sm mt-2 flex items-center">
                    {file.status === 'queued' && (
                      <span className="text-gray-500 dark:text-gray-400 flex items-center">
                        <span className="w-2 h-2 bg-gray-400 rounded-full mr-2"></span>
                        Queued
                      </span>
                    )}
                    {file.status === 'uploading' && (
                      <span className="text-primary-500 dark:text-primary-400 flex items-center">
                        <span className="w-2 h-2 bg-primary-500 rounded-full mr-2 animate-pulse"></span>
                        Uploading ({file.progress}%)
                      </span>
                    )}
                    {file.status === 'processing' && (
                      <span className="text-yellow-500 flex items-center">
                        <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2 animate-pulse"></span>
                        Processing
                      </span>
                    )}
                    {file.status === 'completed' && (
                      <span className="text-green-500 flex items-center">
                        <CheckCircle size={16} className="mr-2" /> 
                        {file.serverMessage || 'Completed'}
                      </span>
                    )}
                    {file.status === 'error' && (
                      <span className="text-red-500 flex items-center">
                        <AlertCircle size={16} className="mr-2" /> 
                        {file.serverMessage || 'Error'}
                      </span>
                    )}
                  </div>
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