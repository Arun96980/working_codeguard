import { useState, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { dracula } from '@uiw/codemirror-theme-dracula';
import { cpp } from '@codemirror/lang-cpp';
import axios from 'axios';
import { FiAlertTriangle, FiCheckCircle, FiCode, FiSun, FiMoon } from 'react-icons/fi';
import './App.css';

function App() {
  const [code, setCode] = useState('');
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [darkMode, setDarkMode] = useState(true);
  const examples = [
    {
      name: "Buffer Overflow",
      code: `void unsafe_copy(char *dest, char *src) {
  while(*src) *dest++ = *src++;
}`
    },
    {
      name: "Secure Copy",
      code: `void safe_copy(char *dest, char *src, size_t size) {
  strncpy(dest, src, size);
  dest[size-1] = '\\0';
}`
    }
  ];

 const analyzeCode = async () => {
  if (!code.trim()) {
    setError('Please enter some code to analyze');
    return;
  }

  try {
    setIsLoading(true);
    setError('');
    // Use the environment variable, with a fallback if not set (for local dev)
    const backendUrl = process.env.REACT_APP_RENDER_BACKEND_URL || "https://working-codeguard-1.onrender.com";
    const response = await axios.post(`${backendUrl}/analyze`, { code });
    setResults(response.data);
  } catch (err) {
    setError(err.response?.data?.error || 'Analysis failed. Please try again.');
  } finally {
    setIsLoading(false);
  }
};


  const loadExample = (exampleCode) => {
    setCode(exampleCode);
    setResults(null);
    setError('');
  };

  return (
    <div className={`app-container ${darkMode ? 'dark' : 'light'}`}>
      <header className="app-header">
        <h1><FiCode /> CodeGuard </h1>
        <button 
          onClick={() => setDarkMode(!darkMode)}
          className="theme-toggle"
        >
          {darkMode ? <FiSun /> : <FiMoon />}
        </button>
      </header>

      <div className="main-content">
        <div className="editor-section">
          <div className="toolbar">
            <div className="example-buttons">
              {examples.map((ex, index) => (
                <button
                  key={index}
                  onClick={() => loadExample(ex.code)}
                  className="example-btn"
                >
                  {ex.name}
                </button>
              ))}
            </div>
            
            <button 
              onClick={analyzeCode}
              disabled={isLoading}
              className="analyze-btn"
            >
              {isLoading ? <div className="spinner"></div> : 'Analyze Code'}
            </button>
          </div>

          <CodeMirror
            value={code}
            height="500px"
            theme={darkMode ? dracula : 'light'}
            extensions={[cpp()]}
            onChange={(value) => {
              setCode(value);
              setResults(null);
            }}
            placeholder="Enter your C/C++ code here..."
          />

          {error && (
            <div className="error-message">
              <FiAlertTriangle /> {error}
            </div>
          )}
        </div>

        {results && (
          <div className="results-section">
            <div className="results-header">
              <h2>
                {results.vulnerable ? (
                  <><FiAlertTriangle className="danger-icon" /> Vulnerability Found!</>
                ) : (
                  <><FiCheckCircle className="safe-icon" /> Code Secure</>
                )}
              </h2>
              <div className="confidence-badge">
                Confidence: {Math.round(results.confidence * 100)}%
              </div>
            </div>

            <div className="results-grid">
              <div className="code-panel original">
                <h3>Original Code</h3>
                <pre>{results.original}</pre>
              </div>

              <div className="code-panel corrected">
                <h3>Suggested Fixes</h3>
                <pre>{results.corrected}</pre>
              </div>
            </div>

            <div className="stats-panel">
              <h3>Security Analysis</h3>
              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-label">Detected Issues</span>
                  <span className="stat-value danger">{results.issues.length}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Severity</span>
                  <span className="stat-value danger">High Risk</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Complexity</span>
                  <span className="stat-value">Medium</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
