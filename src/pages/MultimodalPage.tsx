import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Upload, FileText, Image, Loader } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const API_BASE_URL = 'http://localhost:8000';

const MultimodalPage: React.FC = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);

    // Create preview for images
    if (selectedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    } else {
      setPreview(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE_URL}/api/multimodal`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to process file');
      }

      const data = await response.json();
      setExtractedText(data.text);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Multimodal Document Processing</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Upload className="mr-2" size={20} />
            Upload Image or Document
          </h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select File (Images, PDFs, etc.)
            </label>
            <input
              type="file"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100"
              accept="image/*,.pdf,.docx,.txt"
            />
          </div>

          {preview && (
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Preview:</p>
              <div className="border rounded-md p-2 bg-gray-50">
                <img src={preview} alt="Preview" className="max-h-64 mx-auto" />
              </div>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!file || isProcessing}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 flex items-center justify-center"
          >
            {isProcessing ? (
              <>
                <Loader className="animate-spin mr-2" size={18} />
                Processing...
              </>
            ) : (
              <>
                <Camera className="mr-2" size={18} />
                Process with EasyOCR
              </>
            )}
          </button>

          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md">
              {error}
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <FileText className="mr-2" size={20} />
            Extracted Text
          </h2>
          
          {extractedText ? (
            <div className="prose max-w-none">
              <ReactMarkdown>{extractedText}</ReactMarkdown>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Image className="mx-auto mb-4" size={48} />
              <p>Upload an image or document to extract text</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MultimodalPage;