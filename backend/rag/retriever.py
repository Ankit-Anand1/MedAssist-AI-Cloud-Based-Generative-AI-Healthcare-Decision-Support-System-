"""
RAG Retriever: wraps the knowledge base to provide evidence retrieval
for patient findings and copilot queries.

Only returns actually retrieved content. If nothing relevant is found,
returns an empty list — never fabricates evidence.
"""

import logging
from rag.knowledge_base import knowledge_base

logger = logging.getLogger("rag.retriever")

# Minimum relevance score to include a result (cosine similarity)
MIN_RELEVANCE = 0.25


def retrieve_evidence(query: str, top_k: int = 5) -> list[dict]:
    """
    Retrieve relevant medical knowledge chunks for a given query.

    Returns list of dicts with: content, source_file, source_title,
    document_type, relevance_score.

    Returns empty list if RAG is unavailable or no relevant results found.
    """
    if not knowledge_base.is_available:
        logger.warning("RAG knowledge base not available")
        return []

    if not query or not query.strip():
        return []

    results = knowledge_base.query(query_text=query.strip(), top_k=top_k)

    # Filter by minimum relevance
    filtered = [r for r in results if r.get("relevance_score", 0) >= MIN_RELEVANCE]

    if not filtered:
        logger.info(f"No relevant evidence found for query: {query[:80]}...")
        return []

    logger.info(f"Retrieved {len(filtered)} evidence chunks for query: {query[:80]}...")
    return filtered


def retrieve_evidence_for_findings(findings: list[str], top_k_per_finding: int = 3) -> list[dict]:
    """
    Retrieve evidence for multiple AI findings. De-duplicates results.

    Args:
        findings: List of finding strings (e.g., AI analysis summaries)
        top_k_per_finding: Max results per finding query

    Returns:
        De-duplicated list of evidence chunks.
    """
    seen_ids = set()
    all_evidence = []

    for finding in findings:
        if not finding or not finding.strip():
            continue
        chunks = retrieve_evidence(finding.strip(), top_k=top_k_per_finding)
        for chunk in chunks:
            # De-duplicate by source_file + first 100 chars
            chunk_id = f"{chunk.get('source_file', '')}:{chunk.get('content', '')[:100]}"
            if chunk_id not in seen_ids:
                seen_ids.add(chunk_id)
                all_evidence.append(chunk)

    # Sort by relevance score descending
    all_evidence.sort(key=lambda x: x.get("relevance_score", 0), reverse=True)
    return all_evidence


def get_knowledge_base_status() -> dict:
    """Get the status of the RAG knowledge base."""
    return {
        "available": knowledge_base.is_available,
        "chunk_count": knowledge_base.chunk_count,
    }
