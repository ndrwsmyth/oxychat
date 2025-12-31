"""Vector store service using ChromaDB for RAG."""

from __future__ import annotations

import hashlib
import logging
import os
from pathlib import Path
from typing import Optional

import chromadb
from chromadb.config import Settings
from openai import OpenAI

logger = logging.getLogger(__name__)

# Store Chroma data in a persistent directory
CHROMA_DIR = Path(__file__).parent.parent.parent / "chroma_data"


class VectorStore:
    """ChromaDB-backed vector store for transcript search."""

    def __init__(self) -> None:
        self.openai = OpenAI()
        self.embedding_model = "text-embedding-3-small"

        # Initialize persistent ChromaDB client
        CHROMA_DIR.mkdir(parents=True, exist_ok=True)
        self.client = chromadb.PersistentClient(
            path=str(CHROMA_DIR),
            settings=Settings(anonymized_telemetry=False),
        )

        # Get or create the transcripts collection
        self.collection = self.client.get_or_create_collection(
            name="transcripts",
            metadata={"hnsw:space": "cosine"},
        )
        logger.info(f"Vector store initialized with {self.collection.count()} documents")

    def _get_embedding(self, text: str) -> list[float]:
        """Generate embedding for text using OpenAI."""
        response = self.openai.embeddings.create(
            model=self.embedding_model,
            input=text,
        )
        return response.data[0].embedding

    def _chunk_text(self, text: str, chunk_size: int = 1000, overlap: int = 200) -> list[str]:
        """Split text into overlapping chunks."""
        if len(text) <= chunk_size:
            return [text]

        chunks = []
        start = 0
        while start < len(text):
            end = start + chunk_size
            chunk = text[start:end]
            chunks.append(chunk)
            start = end - overlap

        return chunks

    def add_transcript(
        self,
        doc_id: str,
        title: str,
        date: str,
        content: str,
    ) -> int:
        """
        Add or update a transcript in the vector store.

        Returns the number of chunks created.
        """
        # Remove existing documents for this transcript
        self.delete_transcript(doc_id)

        # Create chunks from the content
        chunks = self._chunk_text(content)

        if not chunks:
            logger.warning(f"No chunks created for transcript {doc_id}")
            return 0

        # Generate IDs, embeddings, and metadata for each chunk
        ids = []
        embeddings = []
        documents = []
        metadatas = []

        for i, chunk in enumerate(chunks):
            chunk_id = f"{doc_id}_chunk_{i}"
            ids.append(chunk_id)
            embeddings.append(self._get_embedding(chunk))
            documents.append(chunk)
            metadatas.append({
                "doc_id": doc_id,
                "title": title,
                "date": date,
                "chunk_index": i,
                "total_chunks": len(chunks),
            })

        # Add to collection
        self.collection.add(
            ids=ids,
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas,
        )

        logger.info(f"Added transcript {doc_id} with {len(chunks)} chunks")
        return len(chunks)

    def delete_transcript(self, doc_id: str) -> None:
        """Remove all chunks for a transcript."""
        try:
            # Get all chunk IDs for this document
            results = self.collection.get(
                where={"doc_id": doc_id},
                include=[],
            )
            if results["ids"]:
                self.collection.delete(ids=results["ids"])
                logger.info(f"Deleted {len(results['ids'])} chunks for transcript {doc_id}")
        except Exception as e:
            logger.warning(f"Error deleting transcript {doc_id}: {e}")

    def search(
        self,
        query: str,
        n_results: int = 5,
        doc_ids: Optional[list[str]] = None,
    ) -> list[dict]:
        """
        Search for relevant transcript chunks.

        Args:
            query: Search query
            n_results: Maximum number of results
            doc_ids: Optional list of doc_ids to filter by

        Returns:
            List of results with doc_id, title, date, content, and score
        """
        if self.collection.count() == 0:
            return []

        query_embedding = self._get_embedding(query)

        # Build where filter if doc_ids specified
        where_filter = None
        if doc_ids:
            if len(doc_ids) == 1:
                where_filter = {"doc_id": doc_ids[0]}
            else:
                where_filter = {"doc_id": {"$in": doc_ids}}

        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results,
            where=where_filter,
            include=["documents", "metadatas", "distances"],
        )

        # Format results
        formatted = []
        if results["ids"] and results["ids"][0]:
            for i, doc_id in enumerate(results["ids"][0]):
                formatted.append({
                    "chunk_id": doc_id,
                    "doc_id": results["metadatas"][0][i]["doc_id"],
                    "title": results["metadatas"][0][i]["title"],
                    "date": results["metadatas"][0][i]["date"],
                    "content": results["documents"][0][i],
                    "distance": results["distances"][0][i],
                })

        return formatted

    def get_context_for_query(
        self,
        query: str,
        n_results: int = 3,
        doc_ids: Optional[list[str]] = None,
    ) -> str:
        """
        Get formatted context string for a query.

        Args:
            query: User's question
            n_results: Number of chunks to include
            doc_ids: Optional list of doc_ids to filter by (from @mentions)

        Returns:
            Formatted context string for the LLM
        """
        results = self.search(query, n_results=n_results, doc_ids=doc_ids)

        if not results:
            return ""

        context_parts = ["Here is relevant context from meeting transcripts:\n"]

        for r in results:
            context_parts.append(f"--- From \"{r['title']}\" ({r['date']}) ---")
            context_parts.append(r["content"])
            context_parts.append("")

        return "\n".join(context_parts)

    def get_stats(self) -> dict:
        """Get statistics about the vector store."""
        count = self.collection.count()

        # Get unique doc_ids
        if count == 0:
            return {"total_chunks": 0, "total_documents": 0}

        all_metadata = self.collection.get(include=["metadatas"])
        doc_ids = set()
        for meta in all_metadata["metadatas"]:
            doc_ids.add(meta["doc_id"])

        return {
            "total_chunks": count,
            "total_documents": len(doc_ids),
        }


# Singleton instance (lazily initialized)
_vector_store: Optional[VectorStore] = None


def get_vector_store() -> VectorStore:
    """Get the singleton vector store instance."""
    global _vector_store
    if _vector_store is None:
        _vector_store = VectorStore()
    return _vector_store
