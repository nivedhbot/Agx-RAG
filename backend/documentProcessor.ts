import { PDFParse } from 'pdf-parse';

interface Chunk {
  text: string;
  source: string;
  page: number;
}

const CHUNK_SIZE = 2000;
const OVERLAP = 250;
const MIN_CHUNK_LENGTH = 50;
const MAX_CHUNKS = 2000;

export async function processPdf(buffer: Buffer, filename: string): Promise<Chunk[]> {
  let parser: PDFParse | null = null;
  try {
    parser = new PDFParse({ data: buffer });
    const result = await parser.getText();

    const pages = (result.pages ?? []).map(p => ({
      num: p.num,
      text: p.text ?? '',
    }));

    if (pages.length === 0 && result.text) {
      pages.push({ num: 1, text: result.text });
    }

    // Build a flat string with a parallel index → page-number map so chunks
    // crossing page boundaries can report their starting page.
    let flat = '';
    const pageOfOffset: number[] = [];
    for (const { num, text } of pages) {
      for (let i = 0; i < text.length; i++) pageOfOffset.push(num);
      flat += text;
      // Separator between pages so chunks don't accidentally merge words.
      if (!text.endsWith('\n')) {
        flat += '\n';
        pageOfOffset.push(num);
      }
    }

    const chunks: Chunk[] = [];
    let start = 0;

    while (start < flat.length) {
      const end = Math.min(start + CHUNK_SIZE, flat.length);
      const text = flat.substring(start, end).trim();

      if (text.length >= MIN_CHUNK_LENGTH) {
        chunks.push({
          text,
          source: filename,
          page: pageOfOffset[start] ?? 1,
        });
      }

      const next = start + (CHUNK_SIZE - OVERLAP);
      if (next <= start) break;
      start = next;
      if (chunks.length >= MAX_CHUNKS) break;
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
