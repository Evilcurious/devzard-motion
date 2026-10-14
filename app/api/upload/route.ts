import { guard, errorResponse } from '@/lib/security';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    await guard(request);
    if (Number(request.headers.get('content-length')) > 4_000_000)
      throw new Error('Please choose a file smaller than 3 MB.');
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new Error('No file selected.');
    if (file.size > 3_000_000) throw new Error('Please choose a file smaller than 3 MB.');
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'txt', 'csv', 'md', 'json'].includes(extension || ''))
      throw new Error('Supported files: PDF, TXT, CSV, Markdown and JSON.');
    const buffer = Buffer.from(await file.arrayBuffer());
    let text = '';
    let pages: number | undefined;
    if (extension === 'pdf') {
      if (!buffer.subarray(0, 5).equals(Buffer.from('%PDF-')))
        throw new Error('This file is not a valid PDF.');
      // Import implementation directly: package index runs a test fixture in some bundled runtimes.
      const pdf = (await import('pdf-parse/lib/pdf-parse.js')).default;
      const parsed = await pdf(buffer, { max: 50 });
      text = parsed.text;
      pages = parsed.numpages;
    } else text = buffer.toString('utf8');
    text = text.replace(/\u0000/g, '').trim();
    if (!text) throw new Error('No selectable text found. Scanned PDFs need OCR first.');
    return Response.json({
      name: file.name.slice(0, 150),
      text: text.slice(0, 40000),
      pages,
      truncated: text.length > 40000 || (pages || 0) > 50,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
