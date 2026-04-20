import TurndownService from 'turndown';
import { Readability } from '@mozilla/readability';
import JSZip from 'jszip';
import mammoth from 'mammoth';
import html2pdf from 'html2pdf.js';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { GoogleGenAI, Type } from '@google/genai';
import { AIAnalysisReport } from '../types';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

async function generateAIReportFromImages(images: {base64: string, mimeType: string}[], retries: number = 2): Promise<AIAnalysisReport | undefined> {
    try {
        if (!process.env.GEMINI_API_KEY) {
            console.warn("No GEMINI_API_KEY found. AI scanned insights might fail.");
        }
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
        
        let parts: any[] = [
            { text: "Examine the following document(s) closely. You must return a strict JSON object that provides: 1. `suggestedNames`: An array of exactly 3 highly descriptive, succinct, smart file names for this document based on its semantics. 2. `summary`: A detailed, insightful summary reporting on the key semantics, values, and purpose of the uploaded document. 3. `mergeStrategies`: A paragraph suggesting how this document relates to, merges with, or correlates to standard project assets. Do not wrap JSON in markdown tags, output raw JSON." }
        ];

        for (const img of images) {
            parts.push({ inlineData: { data: img.base64, mimeType: img.mimeType } });
        }

        const response = await ai.models.generateContent({
            model: 'gemini-3.1-pro-preview',
            contents: [{
                role: 'user',
                parts: parts
            }],
            config: {
                maxOutputTokens: 8192,
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        suggestedNames: { type: Type.ARRAY, items: { type: Type.STRING } },
                        summary: { type: Type.STRING },
                        mergeStrategies: { type: Type.STRING }
                    }
                }
            }
        });
        
        let resultText = response.text || "{}";
        
        try {
            resultText = resultText.replace(/^```json/gi, '').replace(/```$/g, '').trim();
            return JSON.parse(resultText) as AIAnalysisReport;
        } catch (parseErr) {
            console.warn("JSON Parse Error on AI Report.");
            return undefined;
        }
    } catch (e: any) {
        if ((e?.status === 429 || String(e).includes('429')) && retries > 0) {
            console.warn("Rate limited (429), retrying AI format...");
            await new Promise(r => setTimeout(r, 4000));
            return generateAIReportFromImages(images, retries - 1);
        }
        console.error("Gemini report generation failed", e);
        return undefined;
    }
}

// Initialize Turndown service with GitHub-flavored markdown options
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
  bulletListMarker: '-',
  hr: '---'
});

// Add rules to strip unnecessary tags often found in raw HTML dumps
turndownService.addRule('script', {
  filter: ['script', 'style', 'iframe', 'svg', 'nav', 'footer', 'aside', 'noscript'],
  replacement: () => ''
});

// Strip inline base64 images (like logos or trackers) to keep markdown clean
turndownService.addRule('inline-images', {
  filter: function (node) {
    if (node.nodeName === 'IMG') {
      const src = (node as HTMLElement).getAttribute('src');
      if (src && src.startsWith('data:image')) {
        return true;
      }
    }
    return false;
  },
  replacement: () => ''
});

export const convertHtmlToMarkdown = (htmlContent: string, smartExtract: boolean = false): string => {
  try {
    let contentToConvert = htmlContent;
    
    if (smartExtract) {
      // Create a DOM document from the HTML string
      const doc = new DOMParser().parseFromString(htmlContent, 'text/html');
      
      // Try to use Mozilla Readability to extract the core content
      const reader = new Readability(doc);
      const article = reader.parse();
      
      if (article && article.content) {
        contentToConvert = article.content;
      } else {
        // Fallback: if Readability fails to find an article, we can try to manually strip common noise elements
        const fallbackDoc = new DOMParser().parseFromString(htmlContent, 'text/html');
        const noiseSelectors = ['nav', 'footer', 'aside', 'header', '.sidebar', '#sidebar', '.menu', '.navigation'];
        noiseSelectors.forEach(selector => {
          fallbackDoc.querySelectorAll(selector).forEach(el => el.remove());
        });
        contentToConvert = fallbackDoc.body.innerHTML;
      }
    }

    return turndownService.turndown(contentToConvert);
  } catch (error) {
    console.error("Conversion failed:", error);
    throw new Error("Failed to parse HTML content.");
  }
};

export const convertJsonToMarkdown = (jsonContent: string): string => {
  try {
    const data = JSON.parse(jsonContent);
    return jsonToMarkdownRecursive(data);
  } catch (error) {
    console.error("JSON Conversion failed:", error);
    throw new Error("Failed to parse JSON content.");
  }
};

const jsonToMarkdownRecursive = (data: any, depth: number = 0): string => {
  const indent = '  '.repeat(depth);
  
  if (data === null) return 'null';
  if (data === undefined) return 'undefined';
  
  if (Array.isArray(data)) {
    if (data.length === 0) return '(empty array)';
    return data.map(item => {
      if (typeof item === 'object' && item !== null) {
        return `\n${indent}- ${jsonToMarkdownRecursive(item, depth + 1).trim()}`;
      }
      return `\n${indent}- ${item}`;
    }).join('');
  }
  
  if (typeof data === 'object') {
    if (Object.keys(data).length === 0) return '(empty object)';
    return Object.entries(data).map(([key, value]) => {
      const valueStr = jsonToMarkdownRecursive(value, depth + 1);
      // If the value starts with a newline (array or object), don't add extra space
      const separator = (typeof value === 'object' && value !== null) ? '' : ' ';
      return `\n${indent}- **${key}**: ${separator}${valueStr.trim()}`;
    }).join('');
  }
  
  return String(data);
};

export const getSmartFilename = (originalName: string, content: string): string => {
  try {
    let baseName = '';
    
    if (originalName.toLowerCase().endsWith('.json')) {
      // For JSON, try to find a "name" or "title" field in the top level
      try {
        const data = JSON.parse(content);
        if (data.title && typeof data.title === 'string') baseName = data.title;
        else if (data.name && typeof data.name === 'string') baseName = data.name;
      } catch (e) {
        // invalid json, ignore
      }
    } else if (originalName.toLowerCase().endsWith('.html') || originalName.toLowerCase().endsWith('.htm')) {
      // For HTML
      const doc = new DOMParser().parseFromString(content, 'text/html');
      const title = doc.querySelector('title')?.textContent;
      if (title) baseName = title.trim();
    }

    // Fallback to filename without extension if no internal title found
    if (!baseName) {
      baseName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
    }
    
    // Sanitize: allow alphanumeric, spaces, hyphens, underscores, dots, parentheses
    baseName = baseName.replace(/[^a-z0-9 \-_().]/gi, '').trim();
    
    // Collapse multiple spaces
    baseName = baseName.replace(/\s+/g, ' ');
    
    // Fallback if sanitization left it empty
    if (!baseName) baseName = 'untitled';

    return `${baseName}.md`;
  } catch (e) {
    // Fallback in case of error
    const nameWithoutExt = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
    return `${nameWithoutExt}.md`;
  }
};

const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
    reader.onerror = (e) => reject(e);
    reader.readAsArrayBuffer(file);
  });
};

const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
};

export const processUniversalFile = async (file: File, action: string = 'markdown_raw'): Promise<{ markdown?: string, smartName: string, pdfUrl?: string, images?: string[], fillablePdfUrl?: string, formFields?: any[], aiReport?: AIAnalysisReport }> => {
  const name = file.name.toLowerCase();
  const smartName = getSmartFilename(file.name, "");

  // 1. Handle HTML
  if (name.endsWith('.html') || name.endsWith('.htm')) {
    const text = await readFileAsText(file);
    const sn = getSmartFilename(file.name, text);
    const markdown = convertHtmlToMarkdown(text, action === 'markdown_smart');
    return { markdown, smartName: sn };
  }
  
  // 2. Handle JSON
  if (name.endsWith('.json')) {
    const text = await readFileAsText(file);
    const sn = getSmartFilename(file.name, text);
    const markdown = convertJsonToMarkdown(text);
    return { markdown, smartName: sn };
  }
  
  // 3. Handle CSV
  if (name.endsWith('.csv')) {
    const text = await readFileAsText(file);
    const markdown = `\`\`\`csv\n${text}\n\`\`\``;
    return { markdown, smartName };
  }

  // 4. Handle ZIP and CRX (Chrome Extensions)
  if (name.endsWith('.zip') || name.endsWith('.crx')) {
    const buffer = await readFileAsArrayBuffer(file);
    let zipBuffer = buffer;
    
    // CRX files have a header before the ZIP archive starts.
    // The ZIP archive starts with 'PK\x03\x04' (50 4B 03 04).
    if (name.endsWith('.crx')) {
      const view = new Uint8Array(buffer);
      let zipStart = -1;
      for (let i = 0; i < view.length - 3; i++) {
        if (view[i] === 0x50 && view[i+1] === 0x4B && view[i+2] === 0x03 && view[i+3] === 0x04) {
          zipStart = i;
          break;
        }
      }
      if (zipStart !== -1) {
        zipBuffer = buffer.slice(zipStart);
      }
    }

    const zip = await JSZip.loadAsync(zipBuffer);
    let combinedMarkdown = `# Extracted Archive: ${file.name}\n\n`;
    
    const textExtensions = ['.txt', '.md', '.js', '.ts', '.jsx', '.tsx', '.json', '.html', '.css', '.csv'];
    
    for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
      if (zipEntry.dir) continue;
      
      const ext = relativePath.substring(relativePath.lastIndexOf('.')).toLowerCase();
      if (textExtensions.includes(ext) || relativePath.includes('manifest.json')) {
        const content = await zipEntry.async('string');
        combinedMarkdown += `## File: \`${relativePath}\`\n\n\`\`\`${ext.replace('.', '')}\n${content}\n\`\`\`\n\n`;
      }
    }
    
    const smartName = getSmartFilename(file.name, "");
    return { markdown: combinedMarkdown, smartName };
  }
  
  // 5. Handle DOCX
  if (name.endsWith('.docx')) {
    const buffer = await readFileAsArrayBuffer(file);
    
    // Extract HTML using mammoth
    const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
    const html = result.value;
    const sn = getSmartFilename(file.name, html);
    
    // Generate PDF from the HTML if requested
    if (action === 'docx_to_pdf') {
      let pdfUrl: string | undefined;
      try {
        // Create a temporary container for html2pdf
        const container = document.createElement('div');
        container.innerHTML = html;
        
        // Basic styling for the PDF
        container.style.padding = '40px';
        container.style.fontFamily = 'Arial, sans-serif';
        container.style.lineHeight = '1.6';
        container.style.color = '#000';
        container.style.background = '#fff';
        
        const opt = {
          margin:       10,
          filename:     file.name.replace(/\.docx$/i, '.pdf'),
          image:        { type: 'jpeg' as const, quality: 0.98 },
          html2canvas:  { scale: 2 },
          jsPDF:        { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
        };
        
        const pdfBlob = await html2pdf().set(opt).from(container).output('blob');
        pdfUrl = URL.createObjectURL(pdfBlob);
      } catch (err) {
        console.error("Failed to generate PDF:", err);
      }
      return { smartName: sn, pdfUrl, markdown: `*Converted ${file.name} to PDF*` };
    }

    // Otherwise standard markdown return
    const markdown = convertHtmlToMarkdown(html, false);
    return { markdown, smartName: sn };
  }

  // Handle PDF
  if (name.endsWith('.pdf')) {
    const buffer = await readFileAsArrayBuffer(file);
    const pdfJsBuffer = buffer.slice(0); // clone the buffer to avoid detached ArrayBuffer
    const pdf = await pdfjsLib.getDocument({ data: pdfJsBuffer }).promise;
    const numPages = pdf.numPages;

    if (action === 'extract_images') {
      const images: string[] = [];
      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (context) {
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          await page.render({ canvasContext: context, viewport } as any).promise;
          images.push(canvas.toDataURL('image/png'));
        }
      }
      pdf.destroy();
      return { smartName, images, markdown: `*Extracted ${numPages} pages as PNG images from ${file.name}*` };
    }

    if (action === 'ai_analysis') {
      const pageImages: {base64: string, mimeType: string}[] = [];
      const numExtract = Math.min(numPages, 10);
      try {
        for (let i = 1; i <= numExtract; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (context) {
              canvas.height = viewport.height;
              canvas.width = viewport.width;
              await page.render({ canvasContext: context, viewport } as any).promise;
              const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
              pageImages.push({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' });
            }
        }
        pdf.destroy();
        
        const aiReport = await generateAIReportFromImages(pageImages);
        let markdownOutput = "";
        if (aiReport) {
            markdownOutput = `# AI Analysis Report\n\n## Smart Names\n- ${aiReport.suggestedNames.join('\n- ')}\n\n## Summary\n${aiReport.summary}\n\n## Merge Strategies\n${aiReport.mergeStrategies}\n\n---\n\n`;
        }
        return { smartName: aiReport?.suggestedNames?.[0] || smartName, markdown: markdownOutput, aiReport };
      } catch (err) {
        pdf.destroy();
        console.error(err);
      }
      return { smartName, markdown: "" };
    }

    // Default action fallback
    return { smartName, markdown: `*Processed ${file.name} as standard PDF*` };
  }

  // 6. Handle Images (jpg, png, webp)
  if (name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.webp')) {
      if (action === 'ai_analysis') {
        try {
            const img = new Image();
            const objUrl = URL.createObjectURL(file);
            img.src = objUrl;
            await new Promise(r => { img.onload = r; });
            URL.revokeObjectURL(objUrl);

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            let base64 = "";
            let mimeType = 'image/jpeg';

            if (ctx) {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                base64 = dataUrl.split(',')[1];
            } else {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                await new Promise((resolve) => { reader.onload = () => resolve(reader.result) });
                base64 = (reader.result as string).split(',')[1];
                mimeType = file.type || 'image/jpeg';
            }

            const aiReport = await generateAIReportFromImages([{ base64, mimeType }]);
            let markdownOutput = `*Scanned properties for ${file.name}*`;
            if (aiReport) {
                markdownOutput = `# AI Analysis Report\n\n## Smart Names\n- ${aiReport.suggestedNames.join('\n- ')}\n\n## Summary\n${aiReport.summary}\n\n## Merge Strategies\n${aiReport.mergeStrategies}`;
            }

            return { smartName: aiReport?.suggestedNames?.[0] || smartName, markdown: markdownOutput, aiReport };
        } catch (e) {
            console.warn("Could not structure image via AI", e);
        }
      }
      
      return { markdown: `*Image uploaded: ${file.name}*`, smartName };
  }

  // 7. Fallback for any other text-like file (TXT, MD, JS, etc.)
  const text = await readFileAsText(file);
  const sn = getSmartFilename(file.name, text);
  const ext = name.substring(name.lastIndexOf('.') + 1);
  const markdown = `\`\`\`${ext}\n${text}\n\`\`\``;
  
  return { markdown, smartName: sn };
};

export const generateFinalFilledPDF = async (file: File, formFields: any[], values: Record<string, any>, fillablePdfUrl?: string): Promise<{ url: string, errors: string[] }> => {
  const errors: string[] = [];

  // If we already generated an AcroForm, we can just fill it and flatten it
  if (fillablePdfUrl) {
      try {
        const res = await fetch(fillablePdfUrl);
        const buffer = await res.arrayBuffer();
        const { PDFDocument, StandardFonts } = await import('pdf-lib');
        const pdfDoc = await PDFDocument.load(buffer);
        const form = pdfDoc.getForm();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        
        for (const field of formFields) {
            const val = values[field.id];
            if (!val && val !== false) continue;
            try {
                if (field.type === 'checkbox') {
                    const cb = form.getCheckBox(field.id);
                    if (val) cb.check();
                } else {
                    const tf = form.getTextField(field.id);
                    const widgets = tf.acroField.getWidgets();
                    
                    if (widgets && widgets.length > 0) {
                        const rect = widgets[0].getRectangle();
                        const fw = rect.width;
                        const fh = rect.height;
                        
                        let baseFontSize = Math.floor(fh * 0.7);
                        if (baseFontSize > 14) baseFontSize = 14;
                        if (baseFontSize < 6) baseFontSize = 6;
                        
                        let textWidth = font.widthOfTextAtSize(String(val), baseFontSize);
                        let finalFontSize = baseFontSize;
                        
                        if (textWidth > fw - 4) {
                            finalFontSize = Math.max(6, Math.floor((fw - 4) / String(val).length * 1.8));
                            if (finalFontSize === 6) {
                                tf.enableMultiline();
                                errors.push(`The text for "${field.label || field.id}" exceeded the visual capacity of the field and may be wrapped or cut off.`);
                            }
                        }
                        
                        tf.setFontSize(finalFontSize);
                    }
                    tf.setText(String(val));
                }
            } catch(e) {}
        }
        form.flatten(); // Lock in the values, flatten the form
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        return { url: URL.createObjectURL(blob), errors };
      } catch (e) {
          console.error("Flatten generation failed, falling back to raw draw...", e);
      }
  }

  // Fallback to manual drawing
  const buffer = await readFileAsArrayBuffer(file);
  const pdfLibBuffer = buffer.slice(0);
  const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
  
  let pdfDoc;
  if (file.name.toLowerCase().endsWith('.pdf')) {
     pdfDoc = await PDFDocument.load(pdfLibBuffer);
  } else {
     pdfDoc = await PDFDocument.create();
     // match drawing of images
     let image;
     if (file.name.toLowerCase().endsWith('.png')) image = await pdfDoc.embedPng(pdfLibBuffer);
     else image = await pdfDoc.embedJpg(pdfLibBuffer);
     const { width, height } = image.scale(1);
     const page = pdfDoc.addPage([width, height]);
     page.drawImage(image, { x: 0, y: 0, width, height });
  }

  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  for (const field of formFields) {
    const val = values[field.id];
    if (!val && val !== false) continue;

    const page = pages[field.pageIndex || 0];

    if (field.type === 'checkbox') {
       if (val) {
           page.drawText('X', {
             x: field.x + 2,
             y: field.y + 2,
             size: Math.min(field.height * 0.8, 16),
             color: rgb(0,0,0)
           });
       }
    } else {
       const ft = field.type === 'signature' ? fontBold : font;
       let fontSize = Math.floor(field.height * 0.7);
       if (fontSize > 14) fontSize = 14;
       if (fontSize < 6) fontSize = 6;
       
       const textStr = String(val);
       let textWidth = ft.widthOfTextAtSize(textStr, fontSize);
       
       if (textWidth > field.width - 4) {
           fontSize = Math.max(6, Math.floor((field.width - 4) / textStr.length * 1.8));
           if (fontSize === 6) {
               errors.push(`The text for "${field.label || field.id}" exceeded the visual capacity of the field and may be cut off on the page.`);
           }
       }

       page.drawText(textStr, {
         x: field.x + 4,
         y: field.y + Math.max(4, field.height / 2 - fontSize / 2),
         size: fontSize,
         font: ft,
         color: rgb(0.1, 0.2, 0.6)
       });
    }
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  return { url: URL.createObjectURL(blob), errors };
};
