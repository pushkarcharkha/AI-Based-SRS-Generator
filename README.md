# Agentic RAG Document Generation Tool

A professional document generation system that leverages AI agents to create high-quality documents (SRS, SOW, Proposals) using historical context and advanced retrieval techniques.

## Features

### Frontend
- **Professional Interface**: Clean, modern UI with dark mode support
- **Monaco Editor**: VS Code-like editing experience with syntax highlighting
- **Document Management**: Upload, generate, edit, and export documents
- **Real-time Preview**: Live markdown preview during editing
- **AI Suggestions**: Contextual improvements and recommendations
- **Responsive Design**: Optimized for desktop, tablet, and mobile

### Backend Architecture
- **Multi-Agent System**: Specialized AI agents for different tasks
- **Langchain Integration**: Enhanced retrieval and generation chains
- **Vector Search**: Semantic document retrieval
- **FastAPI Backend**: Modern, async API with automatic documentation

## AI Agents

1. **DocumentIngestionAgent**: Parses and processes uploaded documents
2. **StyleProfileBuilderAgent**: Analyzes writing styles and creates profiles
3. **RetrieverAgent**: Performs semantic search with query expansion
4. **DocGenerationAgent**: Generates documents using LLM chains
5. **ReviewEditingAgent**: Reviews and improves document quality
6. **AgenticRAGWorkflow**: Orchestrates multi-agent workflows

## Technology Stack

### Frontend
- React 18 with TypeScript
- Tailwind CSS for styling
- Monaco Editor for code editing
- React Router for navigation
- Axios for API communication

### Backend
- FastAPI (Python)
- Langchain & Langgraph
- SQLAlchemy with SQLite
- SentenceTransformers for embeddings
- Optional: Pinecone/pgvector for vector storage

## Getting Started

### Prerequisites
- Node.js 18+ 
- Python 3.9+
- pip or conda

### Installation

1. **Clone and install frontend dependencies:**
   ```bash
   npm install
   ```

2. **Install backend dependencies:**
   ```bash
   cd src/backend
   pip install -r requirements.txt
   ```

3. **Start the development servers:**
   
   Frontend:
   ```bash
   npm i
   npm run dev
   ```
   
   Backend (in another terminal):
   for first time:
   ```bash
   cd src/backend
   python -m venv venv
   source venv/bin/activate  # On Windows use `venv\Scripts\activate
   pip install -r requirements.txt
   cd ..
   uvicorn backend.main:app --reload
   ```
   then later:
   ```bash
   cd src/backend
   venv\Scripts\activate
   cd ..
   uvicorn backend.main:app --reload
   ```

4. **Open your browser:**
   - Frontend: http://localhost:5173
   - API Documentation: http://localhost:8000/docs

## Usage

### 1. Upload Documents
- Navigate to the Upload tab
- Drag and drop or select PDF, DOCX, or TXT files
- Documents are automatically processed and indexed

### 2. Generate Documents
- Go to the Generate tab
- Select document type (SRS, SOW, Proposal, etc.)
- Provide project summary and requirements
- Click "Generate Document" for AI-powered creation

### 3. Edit and Review
- Use the Monaco Editor for advanced editing
- Get AI suggestions for improvements
- Submit feedback for targeted revisions
- Preview changes in real-time

### 4. Export and Manage
- Export documents in multiple formats (PDF, DOCX, Markdown)
- View document library with filtering and search
- Track document status and versions

## API Endpoints

### Core Operations
- `POST /api/upload` - Upload and process documents
- `POST /api/generate` - Generate new documents
- `POST /api/review` - Review and improve documents
- `GET /api/documents` - List all documents
- `GET /api/agents/status` - Check agent status

## Architecture

### Multi-Agent Workflow
```
Upload → Ingestion → Style Analysis → Retrieval → Generation → Review → Export
```

### Key Components
- **BaseAgent**: Abstract class for all agents
- **Langchain Integration**: Advanced retrieval and generation
- **Vector Storage**: Semantic search capabilities
- **Workflow Orchestration**: Coordinated multi-agent execution

## Development

### Project Structure
```
src/
├── components/          # Reusable UI components
├── pages/              # Main application pages
├── backend/            # Python FastAPI backend
│   ├── main.py        # Main FastAPI application
│   └── requirements.txt # Python dependencies
└── ...
```

### Extending the System

1. **Add New Agents**: Inherit from `BaseAgent` and implement `execute()` method
2. **Custom Document Types**: Update templates and generation logic  
3. **New Export Formats**: Extend the ExportAgent capabilities
4. **Enhanced Retrieval**: Integrate additional vector stores or retrieval methods

## Configuration

### Environment Variables
Create a `.env` file with:
```
GROQ_API_KEY=your_groq_key  
PINECONE_API_KEY=your_pinecone_key
DATABASE_URL=sqlite:///./documents.db
```

### Customization
- **Templates**: Modify document templates in the TemplateAgent
- **Styles**: Customize Tailwind configuration
- **AI Models**: Switch between Groq, or other LLM providers

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For questions or issues:
- Check the API documentation at `/docs`
- Review the agent status at `/api/agents/status`
- Open an issue on GitHub

---

Built with ❤️ for professional document generation