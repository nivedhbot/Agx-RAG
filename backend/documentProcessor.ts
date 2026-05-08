import pdf from 'pdf-parse';

interface Chunk {
  text: string;
  source: string;
  page: number;
}

/**
 * TASK 2: Document Processor
 * Extracts text from PDF and splits into overlapping chunks.
 */
export async function processPdf(buffer: Buffer, filename: string): Promise<Chunk[]> {
  try {
    const data = await pdf(buffer);
    const fullText = data.text;
    
    // Simple chunking logic (512 tokens approx = 2000 chars)
    // 64 tokens overlap approx = 250 chars
    const CHUNK_SIZE = 2000; 
    const OVERLAP = 250;
    
    const chunks: Chunk[] = [];
    let start = 0;

    while (start < fullText.length) {
      const end = Math.min(start + CHUNK_SIZE, fullText.length);
      const text = fullText.substring(start, end).trim();
      
      if (text.length > 50) { // Skip tiny fragments
        chunks.push({
          text,
          source: filename,
          page: 1 // pdf-parse combined text doesn't easily map back to pages without more complex parsing
        });
      }

      start += (CHUNK_SIZE - OVERLAP);
      
      // Safety break
      if (start >= fullText.length && chunks.length === 0) break;
      if (chunks.length > 1000) break; // Limit for demo safety
    }

    return chunks;
  } catch (error) {
    console.error('PDF Processing Error:', error);
    throw new Error('Failed to process PDF document');
  }
}
