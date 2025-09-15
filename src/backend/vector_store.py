# vector_store.py
"""Vector store implementation supporting Pinecone (primary) and FAISS (fallback) via LangChain"""

import os
import json
import pickle
import logging
from typing import List, Dict, Any, Optional, Tuple

# FAISS stack
import faiss
import numpy as np
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.docstore import InMemoryDocstore
from langchain.schema import Document

# App settings
from .config import settings

# Pinecone (optional)
try:
    from langchain_pinecone import PineconeVectorStore
    from pinecone import Pinecone, ServerlessSpec
except ImportError:
    PineconeVectorStore = None
    Pinecone = None
    ServerlessSpec = None

import asyncio

logger = logging.getLogger(__name__)

class VectorStoreWrapper:
    def __init__(self):
        self.embedding_model = HuggingFaceEmbeddings(
            model_name=settings.embedding_model,
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True},
        )
        self.vs = None
        self.type = None
        self.namespace = settings.pinecone_namespace
        self._initialize()

    def _initialize(self):
        try:
            if settings.pinecone_api_key and Pinecone:
                pc = Pinecone(api_key=settings.pinecone_api_key)
                index_name = settings.pinecone_index_name
                if index_name not in pc.list_indexes().names():
                    pc.create_index(
                        name=index_name,
                        dimension=settings.vector_dimension,
                        metric=settings.pinecone_metric,
                        spec=ServerlessSpec(cloud=settings.pinecone_cloud, region=settings.pinecone_region)
                    )
                self.vs = PineconeVectorStore.from_existing_index(
                    index_name=index_name,
                    embedding=self.embedding_model,
                    namespace=self.namespace
                )
                self.type = "pinecone"
            else:
                raise ImportError("Pinecone not available")
        except Exception as e:
            logger.warning(f"Pinecone init failed: {e}, falling back to FAISS")
            dimension = len(self.embedding_model.embed_query("test"))
            index = faiss.IndexFlatL2(dimension)
            self.vs = FAISS(
                embedding_function=self.embedding_model,
                index=index,
                docstore=InMemoryDocstore({}),
                index_to_docstore_id={}
            )
            self.type = "faiss"

    async def async_add_documents(self, documents: List[Document]) -> List[str]:
        loop = asyncio.get_running_loop()
        if self.type == "pinecone":
            return await loop.run_in_executor(None, lambda: self.vs.add_documents(documents))
        else:
            return await loop.run_in_executor(None, lambda: self.vs.add_documents(documents))

    async def async_update_metadata(self, id: str, metadata: Dict[str, Any]):
        loop = asyncio.get_running_loop()
        if self.type == "pinecone":
            await loop.run_in_executor(None, lambda: self.vs._index.update(id=id, set_metadata=metadata, namespace=self.namespace))
            return True
        else:
            for doc_id in list(self.vs.docstore._dict.keys()):
                if doc_id == id:
                    self.vs.docstore._dict[doc_id].metadata.update(metadata)
                    return True
            return False
