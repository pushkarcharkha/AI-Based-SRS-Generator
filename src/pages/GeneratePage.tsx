import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Sparkles, Settings, ChevronRight, Book, Layers, PenTool, Palette, Zap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

type DocStatus = 'draft' | 'review' | 'final';

const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';

function GeneratePage() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    docType: 'SRS',
    summary: '',
    requirements: '',
    style: 'professional'
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const [generatedId, setGeneratedId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamProgress, setStreamProgress] = useState(0);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setIsStreaming(true);
    setStreamProgress(0);
    setError(null);
    setGeneratedContent('');
    setShowPreview(true);

    try {
      // Use the streaming endpoint
      const response = await fetch(`${API_BASE}/api/generate/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doc_type: formData.docType,
          summary: formData.summary,
          requirements: formData.requirements,
          style: formData.style
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || `Generation failed with ${response.status}`);
      }

      // Get the reader from the response body
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to get stream reader');
      }

      // Read the stream
      const decoder = new TextDecoder();
      let documentId: string | null = null;
      let chunkCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // Decode the chunk and parse JSON
        const chunk = decoder.decode(value, { stream: true });
        try {
          const jsonChunks = chunk.split('\n').filter(line => line.trim());
          
          for (const jsonChunk of jsonChunks) {
            const data = JSON.parse(jsonChunk);
            
            // Handle different message types
            if (data.type === 'content') {
              setGeneratedContent(prev => prev + data.content);
              chunkCount++;
              // Update progress indicator (simulated progress)
              setStreamProgress(prev => Math.min(95, prev + 1));
            } else if (data.type === 'complete') {
              documentId = data.id;
              setGeneratedId(data.id);
              setStreamProgress(100);
              setIsStreaming(false);
            } else if (data.type === 'error') {
              throw new Error(data.message || 'Error during generation');
            }
          }
        } catch (e) {
          console.error('Error parsing stream chunk:', e);
        }
      }
    } catch (e: any) {
      setError(e.message || 'Failed to generate document');
      setShowPreview(false);
      setIsStreaming(false);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const goToEdit = () => {
    if (generatedId) {
      navigate(`/edit/${generatedId}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 animate-fade-in">
      <div className="mb-8">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent mb-4 flex items-center">
          <Sparkles className="w-8 h-8 mr-3 text-primary-500" />
          Generate Document
        </h2>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl">
          Create professional documents using AI-powered generation based on your knowledge base.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form Section */}
        <div className="space-y-6">
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <Book className="w-5 h-5 mr-2 text-primary-500" />
                Project Information
              </h3>
            </div>
            <div className="card-body space-y-5">
              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 text-sm">
                  {error}
                </div>
              )}
              
              <div>
                <label className="form-label">
                  Document Type
                </label>
                <select
                  value={formData.docType}
                  onChange={(e) => handleInputChange('docType', e.target.value)}
                  className="form-select"
                >
                  <option value="SRS">Software Requirements Specification (SRS)</option>
                  <option value="SOW">Statement of Work (SOW)</option>
                  <option value="Proposal">Project Proposal</option>
                  <option value="Technical">Technical Documentation</option>
                  <option value="Business">Business Plan</option>
                </select>
              </div>

              <div>
                <label className="form-label">
                  Project Summary
                </label>
                <textarea
                  value={formData.summary}
                  onChange={(e) => handleInputChange('summary', e.target.value)}
                  placeholder="E.g., E-commerce Platform Development"
                  className="form-textarea resize-vertical"
                  rows={4}
                />
              </div>
            </div>
          </div>
          
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <Layers className="w-5 h-5 mr-2 text-primary-500" />
                Requirements & Content
              </h3>
            </div>
            <div className="card-body space-y-5">
              <div>
                <label className="form-label">
                  Requirements & Specifications
                </label>
                <textarea
                  value={formData.requirements}
                  onChange={(e) => handleInputChange('requirements', e.target.value)}
                  rows={6}
                  placeholder="Enter key requirements, features, or specifications..."
                  className="form-textarea resize-vertical"
                />
              </div>

              <div>
                <label className="form-label">
                  Writing Style
                </label>
                <div className="relative">
                  <select
                    value={formData.style}
                    onChange={(e) => handleInputChange('style', e.target.value)}
                    className="form-select pr-10"
                  >
                    <option value="professional">Professional</option>
                    <option value="technical">Technical</option>
                    <option value="business">Business</option>
                    <option value="academic">Academic</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <Palette className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating || !formData.summary.trim() || !formData.requirements.trim()}
            className="btn-primary w-full group"
          >
            {isGenerating ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Generating Document...</span>
              </>
            ) : (
              <>
                <Zap className="w-5 h-5 mr-2 group-hover:animate-pulse" />
                <span>Generate Document</span>
              </>
            )}
          </button>
        </div>

        {/* Preview Section */}
        <div className="space-y-6">
          <div className="card overflow-hidden">
            <div className="card-header bg-gray-50 dark:bg-gray-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <FileText className="w-5 h-5 mr-2 text-primary-500" />
                Document Preview
                {isStreaming && (
                  <div className="ml-3 flex items-center">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-600 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Streaming... {streamProgress}%
                    </span>
                  </div>
                )}
              </h3>
              {generatedContent && (
                <button
                  onClick={() => setShowPreview((s) => !s)}
                  className="btn-secondary text-sm px-3 py-1.5"
                >
                  {showPreview ? 'Hide' : 'Show'} Preview
                </button>
              )}
            </div>
            {isStreaming && (
              <div className="w-full bg-gray-200 h-1 dark:bg-gray-700">
                <div 
                  className="bg-primary-500 h-1 transition-all duration-300 ease-in-out" 
                  style={{ width: `${streamProgress}%` }}
                ></div>
              </div>
            )}

            <div className="p-6 bg-white dark:bg-gray-800 min-h-[400px] max-h-[600px] overflow-auto">
              {!generatedContent ? (
                <div className="flex flex-col items-center justify-center h-full py-12 text-gray-500 dark:text-gray-400">
                  <div className="w-24 h-24 mb-6 relative">
                    <div className="absolute inset-0 bg-gray-100 dark:bg-gray-700 rounded-lg transform rotate-3"></div>
                    <div className="absolute inset-0 bg-gray-200 dark:bg-gray-600 rounded-lg transform -rotate-3"></div>
                    <div className="absolute inset-0 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center">
                      <FileText className="w-12 h-12 text-gray-400" />
                    </div>
                  </div>
                  <p className="text-lg font-medium">{isGenerating ? "Generating Document..." : "No Document Generated Yet"}</p>
                  <p className="text-sm mt-2 max-w-xs text-center">{isGenerating ? "Please wait while we create your document" : "Fill out the form and click the Generate Document button to create your document"}</p>
                </div>
              ) : showPreview ? (
                <div className="prose prose-sm max-w-none dark:prose-invert animate-fade-in">
                  <ReactMarkdown>{generatedContent}</ReactMarkdown>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-gray-500 dark:text-gray-400">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Preview hidden</p>
                    <button 
                      onClick={() => setShowPreview(true)}
                      className="mt-4 text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium"
                    >
                      Show Preview
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {generatedContent && (
            <div className="flex flex-col sm:flex-row gap-3 animate-slide-up">
              <button
                onClick={goToEdit}
                className="btn-primary flex-1 py-3"
              >
                <FileText className="w-5 h-5 mr-2" />
                Save Draft
              </button>
              <button
                onClick={goToEdit}
                className="btn-secondary flex-1 py-3"
              >
                <PenTool className="w-5 h-5 mr-2" />
                Edit Document
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default GeneratePage;