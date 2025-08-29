import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Sparkles, Settings } from 'lucide-react';
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
  const [generatedContent, setGeneratedContent] = useState('');
  const [generatedId, setGeneratedId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doc_type: formData.docType,
          summary: formData.summary,
          requirements: formData.requirements,
          style: formData.style
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Generation failed with ${res.status}`);
      }

      const data: { id: string; content: string; title: string; created_at: string } = await res.json();
      setGeneratedId(data.id);
      setGeneratedContent(data.content);
      setShowPreview(true);
    } catch (e: any) {
      setError(e.message || 'Failed to generate document');
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
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Generate Document</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Create professional documents using AI-powered generation based on your knowledge base.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form Section */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
              <Settings className="w-5 h-5 mr-2" />
              Document Configuration
            </h3>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Document Type
                </label>
                <select
                  value={formData.docType}
                  onChange={(e) => handleInputChange('docType', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="SRS">Software Requirements Specification (SRS)</option>
                  <option value="SOW">Statement of Work (SOW)</option>
                  <option value="Proposal">Project Proposal</option>
                  <option value="Technical">Technical Documentation</option>
                  <option value="Business">Business Plan</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Project Summary
                </label>
                <input
                  type="text"
                  value={formData.summary}
                  onChange={(e) => handleInputChange('summary', e.target.value)}
                  placeholder="E.g., E-commerce Platform Development"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Requirements & Specifications
                </label>
                <textarea
                  value={formData.requirements}
                  onChange={(e) => handleInputChange('requirements', e.target.value)}
                  rows={6}
                  placeholder="Enter key requirements, features, or specifications..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Writing Style
                </label>
                <select
                  value={formData.style}
                  onChange={(e) => handleInputChange('style', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="professional">Professional</option>
                  <option value="technical">Technical</option>
                  <option value="business">Business</option>
                  <option value="academic">Academic</option>
                </select>
              </div>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating || !formData.summary.trim() || !formData.requirements.trim()}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {isGenerating ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Generating Document...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>Generate Document</span>
              </>
            )}
          </button>
        </div>

        {/* Preview Section */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                Document Preview
              </h3>
              {generatedContent && (
                <button
                  onClick={() => setShowPreview((s) => !s)}
                  className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
                >
                  {showPreview ? 'Hide' : 'Show'} Preview
                </button>
              )}
            </div>

            <div className="p-6">
              {!generatedContent ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Generate a document to see the preview</p>
                </div>
              ) : showPreview ? (
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown>{generatedContent}</ReactMarkdown>
                </div>
              ) : (
                <div className="text-sm text-gray-500 dark:text-gray-400">Preview hidden</div>
              )}
            </div>
          </div>

          {generatedContent && (
            <div className="flex space-x-3">
              <button
                onClick={goToEdit}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                Save Draft
              </button>
              <button
                onClick={goToEdit}
                className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-700 transition-colors"
              >
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