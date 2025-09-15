"""Retriever Agent - Advanced implementation for retrieving past SRS docs with LangChain integrations"""

from typing import Dict, Any, List, Optional
import asyncio
from concurrent.futures import ThreadPoolExecutor
import tenacity
import logging
import os

# LangChain imports
from langchain_groq import ChatGroq
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_pinecone import PineconeVectorStore
from langchain.chains import RetrievalQA
from langchain.prompts import PromptTemplate
from langchain.schema import Document

from .base_agent import BaseAgent
from ..vector_store import VectorStoreWrapper
from ..config import settings

logger = logging.getLogger(__name__)

class RetrieverAgent(BaseAgent):
    """Advanced Retriever Agent with LangChain integrations for Pinecone, Groq, and Hugging Face"""
    
    def __init__(self):
        super().__init__(name="retriever", description="Retrieves past SRS docs using LangChain integrations")
        self.executor = ThreadPoolExecutor(max_workers=4)
        
        # Initialize embeddings model from Hugging Face
        self.embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2"
        )
        
        # Initialize Pinecone vector store if API key is available
        if os.environ.get("PINECONE_API_KEY"):
            self.vector_store = PineconeVectorStore(
                index_name=settings.pinecone_index_name,
                embedding=self.embeddings,
                namespace=settings.pinecone_namespace or "default"
            )
        else:
            # Fallback to local vector store
            self.vector_store = VectorStoreWrapper()
        
        # Initialize Groq LLM if API key is available
        if os.environ.get("GROQ_API_KEY"):
            self.llm = ChatGroq(
                model_name="llama3-70b-8192",
                temperature=0.2,
                groq_api_key=os.environ.get("GROQ_API_KEY")
            )
        else:
            # Fallback to local LLM or mock
            self.llm = None
    
    def _create_pinecone_filter(self, doc_type: Optional[str], min_score: Optional[int] = None) -> Dict[str, Any]:
        """Create filter dictionary for Pinecone queries"""
        filter_dict = {}
        
        if doc_type:
            filter_dict["doc_type"] = {"$eq": doc_type}
        
        if min_score is not None:
            filter_dict["quality_score"] = {"$gte": min_score}
        
        return filter_dict
    
    def _create_retrieval_chain(self, query: str, filter_dict: Dict[str, Any] = None) -> RetrievalQA:
        """Create a LangChain retrieval chain with the configured vector store and LLM"""
        # Create retriever with metadata filters
        retriever = self.vector_store.as_retriever(
            search_kwargs={"filter": filter_dict, "k": 5}
        )
        
        # Define prompt template for the retrieval chain
        template = """
        You are an AI assistant specialized in software requirements specifications (SRS).
        Use the following retrieved documents to answer the question.
        
        Question: {question}
        
        Retrieved documents:
        {context}
        
        Answer:
        """
        
        prompt = PromptTemplate(
            template=template,
            input_variables=["question", "context"]
        )
        
        # Create the retrieval chain
        if self.llm:
            # Use Groq LLM if available
            chain = RetrievalQA.from_chain_type(
                llm=self.llm,
                chain_type="stuff",
                retriever=retriever,
                chain_type_kwargs={"prompt": prompt}
            )
        else:
            # Return just the retriever results if no LLM is available
            return retriever
            
        return chain
    
    async def retrieve_documents(self, query: str, doc_type: Optional[str] = None, min_score: Optional[int] = None) -> List[Dict]:
        """Retrieve relevant documents using LangChain integrations"""
        # Create filter for the query
        filter_dict = self._create_pinecone_filter(doc_type, min_score)
        
        # Get retriever or chain
        retrieval_chain = self._create_retrieval_chain(query, filter_dict)
        
        if isinstance(retrieval_chain, RetrievalQA):
            # Use the chain if LLM is available
            result = retrieval_chain.invoke({"query": query})
            return result
        else:
            # Just use the retriever if no LLM
            docs = retrieval_chain.get_relevant_documents(query)
            return [doc.metadata for doc in docs]
            
    async def process_query(self, query: str, **kwargs) -> Dict[str, Any]:
        """Process a query and return relevant documents with LangChain"""
        try:
            results = await self.retrieve_documents(
                query=query,
                doc_type=kwargs.get("doc_type"),
                min_score=kwargs.get("min_score")
            )
            return {
                "status": "success",
                "results": results,
                "query": query
            }
        except Exception as e:
            logger.error(f"Error in retriever agent: {str(e)}")
            return {
                "status": "error",
                "message": str(e),
                "query": query
            }
            filter_dict["doc_type"] = doc_type
        
        if min_feedback_score is not None:
            # FAISS filtering will be done post-retrieval
            filter_dict["min_feedback_score"] = min_feedback_score
        
        return filter_dict
    
    def _filter_documents_by_score(self, documents: List[Dict[str, Any]], min_feedback_score: int) -> List[Dict[str, Any]]:
        """Filter documents based on minimum feedback score (for FAISS post-filtering)"""
        filtered = []
        for doc in documents:
            metadata = doc.get("metadata", {})
            feedback_score = metadata.get("feedback_score", 0)
            
            # Handle different score formats
            try:
                score = int(float(feedback_score))
                if score >= min_feedback_score:
                    filtered.append(doc)
            except (ValueError, TypeError):
                # If score is invalid, include the document
                filtered.append(doc)
        
        return filtered
    
    def _rerank_documents(self, documents: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Rerank documents based on relevance score and feedback score"""
        def calculate_ranking_score(doc: Dict[str, Any]) -> float:
            metadata = doc.get("metadata", {})
            
            # Get relevance score (similarity score)
            relevance_score = doc.get("score", 0.0)
            if isinstance(relevance_score, str):
                try:
                    relevance_score = float(relevance_score)
                except ValueError:
                    relevance_score = 0.0
            
            # Get feedback score
            feedback_score = metadata.get("feedback_score", 0)
            try:
                feedback_score = int(float(feedback_score))
            except (ValueError, TypeError):
                feedback_score = 3  # Default neutral score
            
            # Normalize scores and combine
            # Relevance score is typically 0-1 for similarity
            # Feedback score is 1-5, normalize to 0-1
            normalized_feedback = (feedback_score - 1) / 4.0 if feedback_score > 0 else 0
            
            # Weighted combination: 70% relevance, 30% feedback
            final_score = 0.7 * relevance_score + 0.3 * normalized_feedback
            
            return final_score
        
        try:
            return sorted(documents, key=calculate_ranking_score, reverse=True)
        except Exception as e:
            logger.warning(f"Reranking failed: {e}, returning original order")
            return documents
    
    async def _similarity_search_with_score(self, query: str, k: int, filter_dict: Dict[str, Any]) -> List[tuple]:
        """Perform similarity search with proper async handling"""
        try:
            # Check if vector store supports async methods
            if hasattr(self.vector_store.vs, 'asimilarity_search_with_score'):
                return await self.vector_store.vs.asimilarity_search_with_score(
                    query=query, k=k, filter=filter_dict
                )
            elif hasattr(self.vector_store.vs, 'similarity_search_with_score'):
                # Use executor for sync methods
                loop = asyncio.get_running_loop()
                return await loop.run_in_executor(
                    self.executor,
                    lambda: self.vector_store.vs.similarity_search_with_score(
                        query, k=k, filter=filter_dict
                    )
                )
            else:
                # Fallback to basic similarity search
                if hasattr(self.vector_store.vs, 'asimilarity_search'):
                    docs = await self.vector_store.vs.asimilarity_search(
                        query=query, k=k, filter=filter_dict
                    )
                else:
                    loop = asyncio.get_running_loop()
                    docs = await loop.run_in_executor(
                        self.executor,
                        lambda: self.vector_store.vs.similarity_search(
                            query, k=k, filter=filter_dict
                        )
                    )
                # Return with default scores
                return [(doc, 0.5) for doc in docs]
                
        except Exception as e:
            logger.error(f"Similarity search failed: {e}")
            return []
    
    async def _fallback_retrieval(self, query: str, k: int) -> List[Dict[str, Any]]:
        """Fallback retrieval method without filters"""
        try:
            logger.info("Attempting fallback retrieval without filters")
            
            if hasattr(self.vector_store.vs, 'asimilarity_search'):
                docs = await self.vector_store.vs.asimilarity_search(query=query, k=k)
            else:
                loop = asyncio.get_running_loop()
                docs = await loop.run_in_executor(
                    self.executor,
                    lambda: self.vector_store.vs.similarity_search(query, k=k)
                )
            
            # Convert to standard format
            results = []
            for doc in docs:
                results.append({
                    "content": doc.page_content,
                    "metadata": doc.metadata,
                    "score": 0.5  # Default score
                })
            
            return results
            
        except Exception as e:
            logger.error(f"Fallback retrieval failed: {e}")
            return []
    
    @tenacity.retry(
        stop=tenacity.stop_after_attempt(3),
        wait=tenacity.wait_exponential(multiplier=1, min=4, max=10),
        retry=tenacity.retry_if_exception_type(Exception)
    )
    async def execute(
        self,
        query: str,
        top_k: int = None,
        doc_type: Optional[str] = None,
        min_feedback_score: Optional[int] = None
    ) -> Dict[str, Any]:
        """Retrieve relevant documents from vector store"""
        
        if not query or not query.strip():
            return {
                "status": "error",
                "message": "Empty query provided",
                "chunks": [],
                "total_results": 0
            }
        
        logger.info(f"RetrieverAgent executing with query: {query[:100]}{'...' if len(query) > 100 else ''}")
        
        try:
            # Set default top_k
            top_k = top_k or getattr(settings, 'max_retrieval_docs', 10)
            
            # Check vector store availability
            if not self.vector_store or not self.vector_store.vs:
                logger.warning("Vector store not available")
                return {
                    "status": "error",
                    "message": "Vector store not available",
                    "chunks": [],
                    "total_results": 0
                }
            
            # Determine vector store type and create appropriate filter
            vector_store_type = getattr(self.vector_store, 'type', 'unknown').lower()
            
            if 'pinecone' in vector_store_type:
                filter_dict = self._create_pinecone_filter(doc_type, min_feedback_score)
            else:
                filter_dict = self._create_faiss_filter(doc_type, min_feedback_score)
            
            # Retrieve more documents than needed for reranking
            search_k = min(top_k * 2, 20)
            
            # Perform similarity search
            search_results = await self._similarity_search_with_score(query, search_k, filter_dict)
            
            if not search_results:
                logger.info("No results from filtered search, trying fallback")
                # Try without filters as fallback
                doc_dicts = await self._fallback_retrieval(query, search_k)
            else:
                # Convert results to standard format
                doc_dicts = []
                for doc, score in search_results:
                    doc_dict = {
                        "content": doc.page_content,
                        "metadata": doc.metadata,
                        "score": float(score) if isinstance(score, (int, float)) else 0.5
                    }
                    doc_dicts.append(doc_dict)
            
            # Apply post-filtering for FAISS if needed
            if (vector_store_type == 'faiss' and 
                min_feedback_score is not None and 
                doc_dicts):
                doc_dicts = self._filter_documents_by_score(doc_dicts, min_feedback_score)
            
            # Filter by document type if not done by vector store
            if doc_type and doc_dicts:
                doc_dicts = [
                    doc for doc in doc_dicts 
                    if doc.get("metadata", {}).get("doc_type") == doc_type
                ]
            
            # Rerank documents
            if doc_dicts:
                doc_dicts = self._rerank_documents(doc_dicts)
            
            # Limit to requested number
            doc_dicts = doc_dicts[:top_k]
            
            # Add some variety if we have very few results
            if len(doc_dicts) < 2 and query.strip():
                try:
                    # Try a broader search with just the first few words
                    broad_query = " ".join(query.split()[:3])
                    if broad_query != query:
                        logger.info(f"Trying broader search with query: {broad_query}")
                        broader_results = await self._fallback_retrieval(broad_query, 5)
                        
                        # Add unique results
                        existing_content = {doc.get("content", "")[:100] for doc in doc_dicts}
                        
                        for result in broader_results:
                            content_preview = result.get("content", "")[:100]
                            if content_preview not in existing_content and len(doc_dicts) < top_k:
                                doc_dicts.append(result)
                                existing_content.add(content_preview)
                                
                except Exception as e:
                    logger.warning(f"Broader search failed: {e}")
            
            logger.info(f"Retrieved {len(doc_dicts)} documents")
            
            return {
                "status": "success",
                "chunks": doc_dicts,
                "total_results": len(doc_dicts),
                "query": query,
                "filters": {
                    "doc_type": doc_type,
                    "min_feedback_score": min_feedback_score
                }
            }
            
        except Exception as e:
            logger.error(f"RetrieverAgent execution failed: {e}")
            return {
                "status": "error",
                "message": str(e),
                "chunks": [],
                "total_results": 0,
                "query": query,
                "filters": {
                    "doc_type": doc_type,
                    "min_feedback_score": min_feedback_score
                }
            }