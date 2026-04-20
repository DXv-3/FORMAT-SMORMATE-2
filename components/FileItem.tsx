import React, { useState, useEffect } from 'react';
import { Check, Download, FileText, ChevronDown, ChevronUp, Trash2, FileType, Image as ImageIcon, Sparkles, Clock, Code2, AlignLeft, Braces } from 'lucide-react';
import { ProcessedFile, ConversionStatus } from '../types';
import JSZip from 'jszip';
import DotLoader from './DotLoader';
import { marked } from 'marked';

interface FileItemProps {
  file: ProcessedFile;
  onRemove: (id: string) => void;
  onProcess: (id: string, action: string) => void;
}

const FileItem: React.FC<FileItemProps> = ({ file, onRemove, onProcess }) => {
  const [expanded, setExpanded] = useState(false);
  const [simulatedProgress, setSimulatedProgress] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(25);

  useEffect(() => {
    if (file.status === ConversionStatus.PROCESSING) {
      setSimulatedProgress(0);
      setTimeRemaining(25);
      
      const interval = setInterval(() => {
        setSimulatedProgress(prev => {
          // Asymptotic progress towards 95%
          if (prev >= 95) return 95;
          return prev + (95 - prev) * 0.1;
        });
        setTimeRemaining(prev => Math.max(1, prev - 1));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [file.status]);

  const handleDownload = () => {
    const blob = new Blob([file.content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.markdownName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadHtml = async () => {
    const htmlContent = await marked.parse(file.content);
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${file.originalName}</title><style>body{font-family:sans-serif;max-width:800px;margin:0 auto;padding:2rem;line-height:1.6;}</style></head><body>${htmlContent}</body></html>`;
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.markdownName.replace(/\.md$/i, '.html');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadTxt = () => {
    // Basic strip of markdown syntax for raw text
    let txtContent = file.content
      .replace(/[#*`_]/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\n{3,}/g, '\n\n');
      
    const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.markdownName.replace(/\.md$/i, '.txt');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadJson = () => {
    const jsonObj = {
       filename: file.originalName,
       extractedAt: new Date().toISOString(),
       data: file.content
    };
    const blob = new Blob([JSON.stringify(jsonObj, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.markdownName.replace(/\.md$/i, '.json');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = () => {
    if (!file.pdfUrl) return;
    const a = document.createElement('a');
    a.href = file.pdfUrl;
    a.download = file.originalName.replace(/\.docx$/i, '.pdf');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadFillable = () => {
    if (!file.fillablePdfUrl) return;
    const a = document.createElement('a');
    a.href = file.fillablePdfUrl;
    a.download = `Fillable_${file.originalName.replace(/\.pdf$/i, '.pdf')}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadPngs = async () => {
    if (!file.images || file.images.length === 0) return;
    
    if (file.images.length === 1) {
      const a = document.createElement('a');
      a.href = file.images[0];
      a.download = file.originalName.replace(/\.pdf$/i, '.png');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      const zip = new JSZip();
      const baseName = file.originalName.replace(/\.pdf$/i, '');
      
      file.images.forEach((dataUrl, index) => {
        const base64Data = dataUrl.split(',')[1];
        zip.file(`${baseName}_page_${index + 1}.png`, base64Data, { base64: true });
      });
      
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseName}_images.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const renderStatusIcon = () => {
    switch (file.status) {
      case ConversionStatus.AWAITING_ACTION:
        return <FileText className="w-4 h-4 text-zinc-400" />;
      case ConversionStatus.PROCESSING:
        return <DotLoader />;
      case ConversionStatus.READING:
        return <DotLoader />;
      case ConversionStatus.ERROR:
        return <FileText className="w-4 h-4" />; 
      case ConversionStatus.COMPLETED:
        return <Check className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getStatusColor = () => {
    switch (file.status) {
      case ConversionStatus.AWAITING_ACTION:
        return 'text-zinc-500 bg-zinc-100';
      case ConversionStatus.COMPLETED:
        return 'text-emerald-600 bg-emerald-50';
      case ConversionStatus.ERROR:
        return 'text-red-600 bg-red-50';
      case ConversionStatus.PROCESSING:
        return 'text-blue-600 bg-blue-50';
      case ConversionStatus.READING:
        return 'text-purple-600 bg-purple-50';
      default:
        return 'text-zinc-500 bg-zinc-100';
    }
  };

  const getStatusText = () => {
    switch (file.status) {
      case ConversionStatus.AWAITING_ACTION:
        return 'Action Required';
      case ConversionStatus.READING:
        return 'Reading...';
      case ConversionStatus.PROCESSING:
        return 'Converting...';
      case ConversionStatus.COMPLETED:
        return 'Finished';
      case ConversionStatus.ERROR:
        return 'Error';
      default:
        return 'Waiting';
    }
  };

  return (
    <div className={`bg-white border ${file.status === ConversionStatus.PROCESSING ? 'border-indigo-300 shadow-md ring-1 ring-indigo-100' : 'border-zinc-200 shadow-sm'} overflow-hidden transition-all duration-300 ${file.status !== ConversionStatus.PROCESSING && 'hover:border-zinc-300 group'}`}>
      
      {file.status === ConversionStatus.PROCESSING && file.performedAction === 'ai_analysis' && (
        <div className="bg-indigo-50/50 border-b border-indigo-100 p-4">
           <div className="flex justify-between items-center mb-2">
             <div className="flex items-center space-x-2 text-indigo-700 font-medium text-sm">
               <Sparkles className="w-4 h-4 animate-pulse" />
               <span>AI Vision Agent Scanning Document...</span>
             </div>
             <div className="flex items-center space-x-1.5 text-xs text-indigo-500 font-mono font-medium">
               <Clock className="w-3.5 h-3.5" />
               <span>Est. {timeRemaining}s</span>
             </div>
           </div>
           {/* Progress track */}
           <div className="w-full bg-indigo-100 rounded-full h-1.5 overflow-hidden">
             <div 
               className="bg-indigo-500 h-1.5 rounded-full transition-all duration-1000 ease-out" 
               style={{ width: `${simulatedProgress}%` }}
             ></div>
           </div>
           <p className="text-[10px] text-indigo-400 mt-2 uppercase tracking-wider font-semibold">Gemini API is performing deep semantic extraction and merging strategy generation</p>
        </div>
      )}

      <div className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        
        {/* Left: Icon & Info */}
        <div className="flex items-center space-x-4 flex-1 min-w-0">
          <div className={`
            w-8 h-8 flex items-center justify-center shrink-0 transition-colors duration-300 rounded-sm
            ${getStatusColor()}
          `}>
             {renderStatusIcon()}
          </div>
          
          <div className="flex flex-col min-w-0">
            <h4 className="text-sm font-medium text-zinc-900 truncate pr-4" title={file.status === ConversionStatus.AWAITING_ACTION ? 'Awaiting Action...' : file.markdownName}>
              {file.status === ConversionStatus.AWAITING_ACTION ? file.originalName : file.markdownName}
            </h4>
            <div className="flex items-center space-x-2 text-[11px] text-zinc-500 mt-0.5 uppercase tracking-wider">
              <span>{formatSize(file.originalSize)}</span>
              <span>&mdash;</span>
              <span className={file.status === ConversionStatus.READING || file.status === ConversionStatus.PROCESSING || file.status === ConversionStatus.AWAITING_ACTION ? "text-zinc-800 font-medium" : "text-zinc-500"}>
                {getStatusText()}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center space-x-3 shrink-0 flex-wrap gap-y-2 justify-end w-full md:w-auto">
          {file.status === ConversionStatus.AWAITING_ACTION && (
            <div className="flex flex-wrap items-center gap-2">
              {(() => {
                const ext = file.originalName.split('.').pop()?.toLowerCase();
                if (ext === 'pdf') {
                  return (
                    <>
                      <button onClick={() => onProcess(file.id, 'ai_analysis')} className="flex items-center space-x-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium text-xs px-3 py-1.5 transition-colors border border-indigo-200">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>AI Scan & Report</span>
                      </button>
                      <button onClick={() => onProcess(file.id, 'extract_images')} className="flex items-center space-x-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 px-3 py-1.5 font-medium text-xs transition-colors border border-zinc-200">
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>Extract Images</span>
                      </button>
                      <button onClick={() => onProcess(file.id, 'markdown_raw')} className="flex items-center space-x-1.5 bg-zinc-900 hover:bg-zinc-800 text-white px-3 py-1.5 font-medium text-xs transition-colors">
                        <FileText className="w-3.5 h-3.5" />
                        <span>Markdown</span>
                      </button>
                    </>
                  );
                }
                if (['jpg', 'jpeg', 'png', 'webp'].includes(ext || '')) {
                  return (
                    <>
                      <button onClick={() => onProcess(file.id, 'ai_analysis')} className="flex items-center space-x-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium text-xs px-3 py-1.5 transition-colors border border-indigo-200">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>AI Scan & Report</span>
                      </button>
                      <button onClick={() => onProcess(file.id, 'markdown_raw')} className="flex items-center space-x-1.5 bg-zinc-900 hover:bg-zinc-800 text-white px-3 py-1.5 font-medium text-xs transition-colors">
                        <Check className="w-3.5 h-3.5" />
                        <span>Raw Extract</span>
                      </button>
                    </>
                  );
                }
                if (ext === 'html' || ext === 'htm') {
                  return (
                    <>
                      <button onClick={() => onProcess(file.id, 'markdown_smart')} className="flex items-center space-x-1.5 bg-zinc-900 hover:bg-zinc-800 text-white px-3 py-1.5 font-medium text-xs transition-colors">
                        <span>Extract Article (Clean)</span>
                      </button>
                      <button onClick={() => onProcess(file.id, 'markdown_raw')} className="flex items-center space-x-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 px-3 py-1.5 font-medium text-xs transition-colors border border-zinc-200">
                        <span>Raw HTML</span>
                      </button>
                    </>
                  );
                }
                if (ext === 'docx') {
                  return (
                    <>
                      <button onClick={() => onProcess(file.id, 'markdown_raw')} className="flex items-center space-x-1.5 bg-zinc-900 hover:bg-zinc-800 text-white px-3 py-1.5 font-medium text-xs transition-colors">
                        <span>Extract Markdown</span>
                      </button>
                      <button onClick={() => onProcess(file.id, 'docx_to_pdf')} className="flex items-center space-x-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 px-3 py-1.5 font-medium text-xs transition-colors border border-zinc-200">
                        <FileType className="w-3.5 h-3.5" />
                        <span>Convert to PDF</span>
                      </button>
                    </>
                  );
                }
                return (
                  <button onClick={() => onProcess(file.id, 'markdown_raw')} className="flex items-center space-x-1.5 bg-zinc-900 hover:bg-zinc-800 text-white px-3 py-1.5 font-medium text-xs transition-colors">
                    <Check className="w-3.5 h-3.5" />
                    <span>Process</span>
                  </button>
                );
              })()}
            </div>
          )}

          {file.status === ConversionStatus.COMPLETED && (
            <>
              {file.content && (
                <div className="flex items-center space-x-1.5 border border-zinc-200 rounded overflow-hidden">
                  <button 
                    onClick={() => setExpanded(!expanded)}
                    className="p-1.5 bg-zinc-50 hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 transition-colors hidden sm:block border-r border-zinc-200"
                    title="Preview Output"
                  >
                    {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  
                  <button 
                    onClick={handleDownload}
                    className="flex flex-1 items-center space-x-1 hover:bg-zinc-100 text-zinc-900 px-2 py-1.5 font-medium text-xs transition-colors border-r border-zinc-200"
                    title="Export Markdown"
                  >
                    <Download className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="hidden sm:inline">MD</span>
                  </button>

                  <button 
                    onClick={handleDownloadHtml}
                    className="flex items-center space-x-1 hover:bg-zinc-100 text-zinc-900 px-2 py-1.5 font-medium text-xs transition-colors border-r border-zinc-200"
                    title="Export HTML"
                  >
                    <Code2 className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="hidden sm:inline">HTML</span>
                  </button>

                  <button 
                    onClick={handleDownloadTxt}
                    className="flex items-center space-x-1 hover:bg-zinc-100 text-zinc-900 px-2 py-1.5 font-medium text-xs transition-colors border-r border-zinc-200"
                    title="Export Text"
                  >
                    <AlignLeft className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="hidden sm:inline">TXT</span>
                  </button>

                  <button 
                    onClick={handleDownloadJson}
                    className="flex items-center space-x-1 hover:bg-zinc-100 text-zinc-900 px-2 py-1.5 font-medium text-xs transition-colors"
                    title="Export JSON"
                  >
                    <Braces className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="hidden sm:inline">JSON</span>
                  </button>
                </div>
              )}
              
              {file.pdfUrl && (
                <button 
                  onClick={handleDownloadPdf}
                  className="flex items-center space-x-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 px-3 py-1.5 font-medium text-xs transition-colors border border-zinc-200"
                  title="Download as PDF"
                >
                  <FileType className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">PDF</span>
                </button>
              )}

              {file.images && file.images.length > 0 && (
                <button 
                  onClick={handleDownloadPngs}
                  className="flex items-center space-x-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 px-3 py-1.5 font-medium text-xs transition-colors border border-zinc-200"
                  title="Download PNGs"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">PNGs</span>
                </button>
              )}
            </>
          )}

          <button 
            onClick={() => onRemove(file.id)}
            className="p-1.5 hover:bg-red-50 text-zinc-400 hover:text-red-600 transition-colors ml-2"
            title="Remove"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* AI Report Highlights Section */}
      {file.aiReport && (
        <div className="border-t border-indigo-200 bg-[#f8fafc] p-6 lg:p-8 animate-fade-in shadow-inner">
           <div className="flex flex-col mb-6 border-b border-indigo-100 pb-4">
               <h4 className="text-xl font-serif text-indigo-900 tracking-tight flex items-center space-x-2">
                 <Sparkles className="w-5 h-5 text-indigo-600" />
                 <span>AI Document Analysis</span>
               </h4>
               <p className="text-sm text-zinc-600 mt-2 leading-relaxed">{file.aiReport.summary}</p>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
             <div className="flex flex-col">
               <label className="mb-2 text-xs font-bold text-indigo-500 uppercase tracking-wide">Suggested Renames</label>
               <ul className="space-y-2">
                  {file.aiReport.suggestedNames.map((name, i) => (
                      <li key={i} className="text-sm bg-white border border-indigo-100 text-indigo-800 px-3 py-2 rounded-md shadow-sm select-all">
                        {name}
                      </li>
                  ))}
               </ul>
             </div>
             <div className="flex flex-col">
               <label className="mb-2 text-xs font-bold text-emerald-500 uppercase tracking-wide">Merge Strategy & Context</label>
               <div className="text-sm text-zinc-700 bg-white border border-emerald-100 p-4 rounded-md shadow-sm leading-relaxed h-full">
                  {file.aiReport.mergeStrategies}
               </div>
             </div>
           </div>
        </div>
      )}

      {/* Preview Section */}
      {expanded && file.status === ConversionStatus.COMPLETED && (
        <div className="border-t border-zinc-200 bg-zinc-50 p-4 sm:p-6">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Markdown Preview</span>
            <span className="text-[10px] text-zinc-400">First 500 chars</span>
          </div>
          <pre className="text-xs leading-relaxed text-zinc-700 font-mono whitespace-pre-wrap break-all bg-white p-4 border border-zinc-200 max-h-48 overflow-y-auto mb-6 shadow-sm">
            {file.content.slice(0, 500)}
            {file.content.length > 500 && '...'}
          </pre>
          
          {file.images && file.images.length > 0 && (
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Extracted Images ({file.images.length})</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-64 overflow-y-auto p-4 bg-white border border-zinc-200 shadow-sm">
                {file.images.map((img, idx) => (
                  <div key={idx} className="relative aspect-[3/4] overflow-hidden border border-zinc-200 bg-zinc-50 group-hover:border-zinc-300 transition-colors">
                    <img src={img} alt={`Page ${idx + 1}`} className="w-full h-full object-contain" />
                    <div className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm p-1.5 text-center border-t border-zinc-200">
                      <span className="text-[9px] font-medium text-zinc-600 uppercase tracking-wider">Page {idx + 1}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FileItem;