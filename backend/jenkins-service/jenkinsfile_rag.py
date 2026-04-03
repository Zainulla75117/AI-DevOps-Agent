"""
Jenkinsfile RAG Module
Retrieval-Augmented Generation for Jenkinsfile examples using ChromaDB
"""

import os
import zipfile
import logging
from pathlib import Path
from typing import List, Dict, Optional, Tuple
import chromadb
from chromadb.config import Settings
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# ChromaDB configuration
CHROMA_DB_PATH = os.getenv("CHROMA_DB_PATH", "./chroma_db")
CHROMA_COLLECTION_NAME = "jenkinsfile_examples"

# Global ChromaDB client and collection
_chroma_client = None
_chroma_collection = None


def get_chroma_client():
    """Get or create ChromaDB client"""
    global _chroma_client
    if _chroma_client is None:
        try:
            _chroma_client = chromadb.PersistentClient(
                path=CHROMA_DB_PATH,
                settings=Settings(anonymized_telemetry=False)
            )
            logger.info(f"ChromaDB client initialized at: {CHROMA_DB_PATH}")
        except Exception as e:
            logger.error(f"Failed to initialize ChromaDB client: {e}")
            raise
    return _chroma_client


def get_chroma_collection():
    """Get or create ChromaDB collection"""
    global _chroma_collection
    if _chroma_collection is None:
        try:
            client = get_chroma_client()
            # Try to get existing collection or create new one
            try:
                _chroma_collection = client.get_collection(name=CHROMA_COLLECTION_NAME)
                logger.info(f"Loaded existing ChromaDB collection: {CHROMA_COLLECTION_NAME}")
            except Exception:
                _chroma_collection = client.create_collection(
                    name=CHROMA_COLLECTION_NAME,
                    metadata={"description": "Jenkinsfile examples for RAG"}
                )
                logger.info(f"Created new ChromaDB collection: {CHROMA_COLLECTION_NAME}")
        except Exception as e:
            logger.error(f"Failed to get/create ChromaDB collection: {e}")
            raise
    return _chroma_collection


def extract_jenkinsfiles_from_zip(zip_path: str) -> List[Dict[str, str]]:
    """
    Extract Jenkinsfiles from a zip file and return as list of documents.
    
    Args:
        zip_path: Path to the zip file containing Jenkinsfiles
    
    Returns:
        List of dicts with 'content', 'filename', and 'metadata' keys
    """
    documents = []
    
    if not os.path.exists(zip_path):
        logger.error(f"Zip file not found: {zip_path}")
        return documents
    
    try:
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            # Get all file names in the zip
            file_list = zip_ref.namelist()
            
            for filename in file_list:
                # Only process Jenkinsfile files (case-insensitive)
                if filename.lower().endswith('jenkinsfile') or 'jenkinsfile' in filename.lower():
                    try:
                        # Read file content
                        content = zip_ref.read(filename).decode('utf-8', errors='ignore')
                        
                        # Determine complexity based on filename or content
                        complexity = "mid-level"  # default
                        filename_lower = filename.lower()
                        if any(word in filename_lower for word in ['simple', 'basic', 'minimal']):
                            complexity = "simple"
                        elif any(word in filename_lower for word in ['advanced', 'complex', 'enterprise', 'production']):
                            complexity = "advanced"
                        
                        # Extract metadata from content
                        tech_stack = []
                        if 'node' in content.lower() or 'npm' in content.lower() or 'yarn' in content.lower():
                            tech_stack.append('nodejs')
                        if 'python' in content.lower() or 'pip' in content.lower() or 'poetry' in content.lower():
                            tech_stack.append('python')
                        if 'maven' in content.lower() or 'mvn' in content.lower():
                            tech_stack.append('java-maven')
                        if 'gradle' in content.lower():
                            tech_stack.append('java-gradle')
                        if 'docker' in content.lower():
                            tech_stack.append('docker')
                        
                        documents.append({
                            'content': content,
                            'filename': filename,
                            'metadata': {
                                'complexity': complexity,
                                'tech_stack': tech_stack,
                                'filename': filename
                            }
                        })
                        
                        logger.info(f"Extracted Jenkinsfile: {filename} (complexity: {complexity}, tech: {tech_stack})")
                    except Exception as e:
                        logger.warning(f"Failed to process file {filename} in zip: {e}")
                        continue
        
        logger.info(f"Extracted {len(documents)} Jenkinsfiles from {zip_path}")
        return documents
        
    except Exception as e:
        logger.error(f"Failed to extract Jenkinsfiles from zip: {e}")
        return documents


def chunk_jenkinsfile(content: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
    """
    Split Jenkinsfile content into chunks for better retrieval.
    
    Args:
        content: Jenkinsfile content
        chunk_size: Maximum size of each chunk
        overlap: Overlap between chunks
    
    Returns:
        List of text chunks
    """
    lines = content.split('\n')
    chunks = []
    current_chunk = []
    current_length = 0
    
    for line in lines:
        line_length = len(line) + 1  # +1 for newline
        
        if current_length + line_length > chunk_size and current_chunk:
            # Save current chunk
            chunks.append('\n'.join(current_chunk))
            
            # Start new chunk with overlap
            overlap_lines = current_chunk[-overlap//50:] if len(current_chunk) > overlap//50 else current_chunk
            current_chunk = overlap_lines + [line]
            current_length = sum(len(l) + 1 for l in current_chunk)
        else:
            current_chunk.append(line)
            current_length += line_length
    
    # Add remaining chunk
    if current_chunk:
        chunks.append('\n'.join(current_chunk))
    
    return chunks


def load_jenkinsfiles_to_chromadb(zip_path: str, clear_existing: bool = False) -> bool:
    """
    Load Jenkinsfiles from zip file into ChromaDB.
    
    Args:
        zip_path: Path to zip file containing Jenkinsfiles
        clear_existing: If True, clear existing collection before loading
    
    Returns:
        True if successful, False otherwise
    """
    try:
        collection = get_chroma_collection()
        
        # Clear existing data if requested
        if clear_existing:
            try:
                client = get_chroma_client()
                client.delete_collection(name=CHROMA_COLLECTION_NAME)
                collection = client.create_collection(
                    name=CHROMA_COLLECTION_NAME,
                    metadata={"description": "Jenkinsfile examples for RAG"}
                )
                logger.info("Cleared existing collection")
            except Exception as e:
                logger.warning(f"Failed to clear collection (may not exist): {e}")
        
        # Extract Jenkinsfiles from zip
        documents = extract_jenkinsfiles_from_zip(zip_path)
        
        if not documents:
            logger.warning("No Jenkinsfiles found in zip file")
            return False
        
        # Process and add to ChromaDB
        all_ids = []
        all_contents = []
        all_metadatas = []
        
        for doc_idx, doc in enumerate(documents):
            # Chunk the content
            chunks = chunk_jenkinsfile(doc['content'])
            
            for chunk_idx, chunk in enumerate(chunks):
                doc_id = f"{doc['filename']}_{chunk_idx}"
                all_ids.append(doc_id)
                all_contents.append(chunk)
                
                # Create metadata
                # ChromaDB only accepts primitive types (str, int, float, bool) in metadata
                # Convert lists to comma-separated strings
                metadata = doc['metadata'].copy()
                metadata['chunk_index'] = chunk_idx
                metadata['total_chunks'] = len(chunks)
                
                # Convert tech_stack list to comma-separated string
                if 'tech_stack' in metadata and isinstance(metadata['tech_stack'], list):
                    metadata['tech_stack'] = ','.join(metadata['tech_stack'])
                
                all_metadatas.append(metadata)
        
        # Add to ChromaDB in batches
        batch_size = 100
        for i in range(0, len(all_ids), batch_size):
            batch_ids = all_ids[i:i+batch_size]
            batch_contents = all_contents[i:i+batch_size]
            batch_metadatas = all_metadatas[i:i+batch_size]
            
            collection.add(
                ids=batch_ids,
                documents=batch_contents,
                metadatas=batch_metadatas
            )
        
        logger.info(f"Successfully loaded {len(all_ids)} chunks from {len(documents)} Jenkinsfiles into ChromaDB")
        return True
        
    except Exception as e:
        logger.error(f"Failed to load Jenkinsfiles to ChromaDB: {e}")
        return False


def retrieve_relevant_jenkinsfiles(
    query: str,
    tech_stack: Optional[List[str]] = None,
    complexity: Optional[str] = None,
    n_results: int = 3
) -> List[Dict[str, any]]:
    """
    Retrieve relevant Jenkinsfile examples from ChromaDB based on query.
    
    Args:
        query: Search query (e.g., tech stack description, requirements)
        tech_stack: Optional list of tech stack keywords to filter by
        complexity: Optional complexity level to filter by ('simple', 'mid-level', 'advanced')
        n_results: Number of results to return
    
    Returns:
        List of dicts with 'content', 'metadata', and 'distance' keys
    """
    try:
        collection = get_chroma_collection()
        
        # Build where clause for filtering
        where_clause = None
        
        # ChromaDB filtering: tech_stack is a list in metadata, so we check if any tech matches
        # For simplicity, we'll filter by complexity if provided, and let the query handle tech stack matching
        if complexity:
            where_clause = {"complexity": complexity}
        
        # Query ChromaDB
        # Note: ChromaDB's text search will naturally match tech stack keywords in the content
        # We filter by complexity if specified
        if where_clause:
            results = collection.query(
                query_texts=[query],
                n_results=n_results,
                where=where_clause
            )
        else:
            results = collection.query(
                query_texts=[query],
                n_results=n_results
            )
        
        # Format results
        retrieved_docs = []
        if results['ids'] and len(results['ids'][0]) > 0:
            for idx in range(len(results['ids'][0])):
                doc_id = results['ids'][0][idx]
                content = results['documents'][0][idx]
                metadata = results['metadatas'][0][idx].copy()
                distance = results['distances'][0][idx] if 'distances' in results else None
                
                # Convert tech_stack string back to list for consistency
                if 'tech_stack' in metadata and isinstance(metadata['tech_stack'], str):
                    metadata['tech_stack'] = [tech.strip() for tech in metadata['tech_stack'].split(',') if tech.strip()]
                
                retrieved_docs.append({
                    'content': content,
                    'metadata': metadata,
                    'distance': distance,
                    'id': doc_id
                })
        
        logger.info(f"Retrieved {len(retrieved_docs)} relevant Jenkinsfile examples")
        return retrieved_docs
        
    except Exception as e:
        logger.error(f"Failed to retrieve Jenkinsfiles from ChromaDB: {e}")
        return []


def is_rag_available() -> bool:
    """Check if RAG system is available and has data"""
    try:
        collection = get_chroma_collection()
        count = collection.count()
        return count > 0
    except Exception as e:
        logger.warning(f"RAG system not available: {e}")
        return False


def get_rag_status() -> Dict[str, any]:
    """Get status of RAG system"""
    try:
        collection = get_chroma_collection()
        count = collection.count()
        return {
            'available': True,
            'collection_name': CHROMA_COLLECTION_NAME,
            'document_count': count,
            'db_path': CHROMA_DB_PATH
        }
    except Exception as e:
        return {
            'available': False,
            'error': str(e)
        }

