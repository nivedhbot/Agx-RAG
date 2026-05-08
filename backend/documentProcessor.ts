import { PDFParse } from 'pdf-parse';

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
  let parser: PDFParse | null = null;
  try {
    // pdf-parse 2.4.5+ uses a class-based approach
    parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const fullText = result.text;
    
    // Simple chunking logic (512 tokens approx = 2000 chars)
    const CHUNK_SIZE = 2000; 
    const OVERLAP = 250;
    
    const chunks: Chunk[] = [];
    let start = 0;

    while (start < fullText.length) {
      const end = Math.min(start + CHUNK_SIZE, fullText.length);
      const text = fullText.substring(start, end).trim();
      
      if (text.length > 50) {
        chunks.push({
          text,
          source: filename,
          page: 1 // We could improve this by using result.pages if needed
        });
      }

      start += (CHUNK_SIZE - OVERLAP);
      if (start >= fullText.length && chunks.length === 0) break;
      if (chunks.length > 2000) break;
    }

    return chunks;
  } catch (error: any) {
    console.error('PDF Processing Error:', error);
    const errorMessage = error?.message || String(error);
    
    if (errorMessage.includes('InvalidPDFException') || errorMessage.includes('FormatError')) {
      throw new Error(`The file "${filename}" is corrupted or not a valid PDF.`);
    }
    if (errorMessage.includes('AbortException')) {
      throw new Error('Processing was aborted. The PDF may be too complex.');
    }
    
    throw new Error(`Failed to process PDF: ${errorMessage}`);
  } finally {
    if (parser) {
      await parser.destroy().catch(() => {});
    }
  }
}
