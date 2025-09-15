import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { FileText, Upload, Edit3, List } from 'lucide-react';
import UploadPage from './pages/UploadPage';
import GeneratePage from './pages/GeneratePage';
import EditPage from './pages/EditPage';
import ListPage from './pages/ListPage';
// OCR functionality integrated into UploadPage

function App() {
  return (
    <div className={`min-h-screen transition-colors duration-300`}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <Router>
          <Header/>
          <main className="container mx-auto px-4 py-8 max-w-screen-2xl">
            <Routes>
              <Route path="/" element={<GeneratePage />} />
              <Route path="/upload" element={<UploadPage />} />
              <Route path="/generate" element={<GeneratePage />} />
              <Route path="/edit/:id?" element={<EditPage />} />
              <Route path="/review" element={<ListPage />} />
              <Route path="/review/:id" element={<EditPage />} />
              <Route path="/list" element={<ListPage />} />
            </Routes>
          </main>
        </Router>
      </div>
    </div>
  );
}

function Header() {
  const location = useLocation();

  const navItems = [
    { path: '/upload', label: 'Upload Documents', icon: Upload },
    { path: '/generate', label: 'Generate Doc', icon: FileText },
    { path: '/review', label: 'Review/Edit', icon: Edit3 },
    { path: '/list', label: 'Export/List', icon: List },
  ];

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="container mx-auto px-4 max-w-screen-2xl">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
              Agentic RAG Tool
            </h1>
          </Link>

          <nav className="hidden md:flex space-x-1">
            {navItems.map(({ path, label, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                  location.pathname === path
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{label}</span>
              </Link>
            ))}
          </nav>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden pb-4">
          <nav className="flex space-x-1 overflow-x-auto">
            {navItems.map(({ path, label, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 whitespace-nowrap ${
                  location.pathname === path
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}

export default App;