"""
RAG Knowledge Base: loads, chunks, embeds, and indexes curated medical documents.

Uses:
- sentence-transformers for local embeddings (no API key)
- ChromaDB as a lightweight file-based vector store

Documents are curated educational references, NOT fabricated research papers.
"""

import os
import logging
import hashlib
from pathlib import Path
from typing import Optional

logger = logging.getLogger("rag.knowledge_base")

DOCUMENTS_DIR = os.path.join(os.path.dirname(__file__), "documents")
CHROMA_PERSIST_DIR = os.path.join(os.path.dirname(__file__), "chroma_store")
COLLECTION_NAME = "medical_knowledge"
EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"
CHUNK_SIZE = 500  # approximate tokens (chars / 4)
CHUNK_OVERLAP = 80


def _chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split text into overlapping chunks by character count (approx 4 chars/token)."""
    char_size = chunk_size * 4
    char_overlap = overlap * 4
    chunks = []
    start = 0
    while start < len(text):
        end = start + char_size
        chunk = text[start:end]
        # Try to break at paragraph or sentence boundary
        if end < len(text):
            # Look for last paragraph break
            last_para = chunk.rfind("\n\n")
            if last_para > char_size // 2:
                end = start + last_para + 2
                chunk = text[start:end]
            else:
                # Look for last sentence break
                last_period = chunk.rfind(". ")
                if last_period > char_size // 2:
                    end = start + last_period + 2
                    chunk = text[start:end]
        chunks.append(chunk.strip())
        start = end - char_overlap
    return [c for c in chunks if len(c) > 50]


def _compute_docs_hash(docs_dir: str) -> str:
    """Compute a hash of all document files to detect changes."""
    hasher = hashlib.md5()
    doc_path = Path(docs_dir)
    if not doc_path.exists():
        return ""
    for fp in sorted(doc_path.glob("*.md")):
        hasher.update(fp.read_bytes())
    return hasher.hexdigest()


class MedicalKnowledgeBase:
    """Manages the RAG vector store for curated medical knowledge documents."""

    def __init__(self):
        self._client = None
        self._collection = None
        self._embed_fn = None
        self._initialized = False

    def _get_embedding_function(self):
        """Lazy-load the embedding function."""
        if self._embed_fn is None:
            try:
                from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction
                self._embed_fn = SentenceTransformerEmbeddingFunction(
                    model_name=EMBEDDING_MODEL_NAME,
                )
                logger.info(f"✓ Loaded embedding model: {EMBEDDING_MODEL_NAME}")
            except Exception as e:
                logger.error(f"Failed to load embedding model: {e}")
                raise
        return self._embed_fn

    def initialize(self, force_reindex: bool = False):
        """
        Initialize the knowledge base: load ChromaDB, index documents if needed.
        Safe to call multiple times — only indexes once unless documents change.
        """
        if self._initialized and not force_reindex:
            return

        try:
            import chromadb
        except ImportError:
            logger.warning("chromadb not installed — RAG features will be unavailable")
            return

        os.makedirs(CHROMA_PERSIST_DIR, exist_ok=True)

        self._client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)
        embed_fn = self._get_embedding_function()

        # Check if we need to re-index
        current_hash = _compute_docs_hash(DOCUMENTS_DIR)
        hash_file = os.path.join(CHROMA_PERSIST_DIR, ".docs_hash")
        existing_hash = ""
        if os.path.exists(hash_file):
            existing_hash = open(hash_file).read().strip()

        needs_reindex = force_reindex or (current_hash != existing_hash)

        if needs_reindex:
            # Delete old collection if exists
            try:
                self._client.delete_collection(COLLECTION_NAME)
            except Exception:
                pass

            self._collection = self._client.get_or_create_collection(
                name=COLLECTION_NAME,
                embedding_function=embed_fn,
                metadata={"hnsw:space": "cosine", "description": "Curated medical knowledge for clinical decision support"},
            )
            self._index_documents()

            # Save hash
            with open(hash_file, "w") as f:
                f.write(current_hash)
            logger.info("✓ RAG knowledge base indexed successfully")
        else:
            self._collection = self._client.get_or_create_collection(
                name=COLLECTION_NAME,
                embedding_function=embed_fn,
                metadata={"hnsw:space": "cosine"},
            )
            count = self._collection.count()
            logger.info(f"✓ RAG knowledge base loaded from disk ({count} chunks)")

        self._initialized = True

    def _index_documents(self):
        """Read all .md files from documents/ dir, chunk, and add to vector store."""
        docs_path = Path(DOCUMENTS_DIR)
        if not docs_path.exists():
            logger.warning(f"Documents directory not found: {DOCUMENTS_DIR}")
            return

        all_ids = []
        all_docs = []
        all_meta = []

        for fp in sorted(docs_path.glob("*.md")):
            text = fp.read_text(encoding="utf-8")
            source_name = fp.stem.replace("_", " ").title()
            chunks = _chunk_text(text)
            logger.info(f"  Indexing {fp.name}: {len(chunks)} chunks")

            for i, chunk in enumerate(chunks):
                doc_id = f"{fp.stem}__chunk_{i}"
                all_ids.append(doc_id)
                all_docs.append(chunk)
                all_meta.append({
                    "source_file": fp.name,
                    "source_title": source_name,
                    "document_type": "Curated Educational Reference",
                    "chunk_index": i,
                    "total_chunks": len(chunks),
                })

        if all_docs:
            # ChromaDB batch add (max 5461 per batch)
            batch_size = 500
            for start in range(0, len(all_docs), batch_size):
                end = start + batch_size
                self._collection.add(
                    ids=all_ids[start:end],
                    documents=all_docs[start:end],
                    metadatas=all_meta[start:end],
                )
            logger.info(f"  Total: {len(all_docs)} chunks indexed from {len(list(docs_path.glob('*.md')))} documents")

    @property
    def is_available(self) -> bool:
        return self._initialized and self._collection is not None

    @property
    def chunk_count(self) -> int:
        if self._collection is None:
            return 0
        return self._collection.count()

    def query(self, query_text: str, top_k: int = 5) -> list[dict]:
        """
        Retrieve the most relevant chunks for a query.

        Returns list of dicts with keys: content, source_file, source_title,
        document_type, relevance_score.
        """
        if not self.is_available:
            return []

        try:
            results = self._collection.query(
                query_texts=[query_text],
                n_results=min(top_k, self.chunk_count or 1),
                include=["documents", "metadatas", "distances"],
            )
        except Exception as e:
            logger.error(f"RAG query failed: {e}")
            return []

        retrieved = []
        if results and results["documents"] and results["documents"][0]:
            for doc, meta, dist in zip(
                results["documents"][0],
                results["metadatas"][0],
                results["distances"][0],
            ):
                # With cosine distance in ChromaDB, dist = 1 - cosine_similarity
                cosine_sim = 1.0 - dist
                retrieved.append({
                    "content": doc,
                    "source_file": meta.get("source_file", ""),
                    "source_title": meta.get("source_title", ""),
                    "document_type": meta.get("document_type", "Curated Educational Reference"),
                    "relevance_score": round(max(0.0, cosine_sim), 4),
                })

        return retrieved


# Module-level singleton
knowledge_base = MedicalKnowledgeBase()
