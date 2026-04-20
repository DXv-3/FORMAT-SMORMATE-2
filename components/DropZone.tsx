import React, { useCallback, useState } from 'react';
import { Upload, FileCode, FileWarning } from 'lucide-react';

interface DropZoneProps {
  onFilesDropped: (files: File[]) => void;
  acceptAllFiles?: boolean;
}

const DropZone: React.FC<DropZoneProps> = ({ onFilesDropped, acceptAllFiles = false }) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    setErrorMsg(null);

    const droppedFiles: File[] = Array.from(e.dataTransfer.files);
    
    let validFiles = droppedFiles;
    
    if (!acceptAllFiles) {
      // Filter for HTML/HTM, JSON, and PDF files only
      validFiles = droppedFiles.filter(file => 
        file.type === 'text/html' || 
        file.name.endsWith('.html') || 
        file.name.endsWith('.htm') ||
        file.type === 'application/json' ||
        file.name.endsWith('.json') ||
        file.type === 'application/pdf' ||
        file.name.endsWith('.pdf') ||
        file.type.startsWith('image/') ||
        ['.docx', '.csv', '.txt', '.md', '.jpg', '.jpeg', '.png', '.webp'].some(ext => file.name.toLowerCase().endsWith(ext))
      );

      if (validFiles.length === 0 && droppedFiles.length > 0) {
        setErrorMsg("Only standard document and image files are supported in standard mode.");
        return;
      }
    }

    if (validFiles.length > 0) {
      onFilesDropped(validFiles);
    }
  }, [onFilesDropped, acceptAllFiles]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      onFilesDropped(selectedFiles);
    }
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`
        relative group cursor-pointer transition-all duration-300 ease-out
        border p-12 flex flex-col items-center justify-center text-center
        min-h-[280px] w-full bg-white
        ${isDragActive 
          ? 'border-zinc-900 bg-zinc-50' 
          : 'border-zinc-200 hover:border-zinc-400'
        }
      `}
    >
      <input 
        type="file" 
        multiple 
        accept={acceptAllFiles ? "*" : ".html,.htm,.json,.pdf,.csv,.docx,.txt,.md,.jpg,.jpeg,.png,.webp"} 
        onChange={handleFileInput}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      
      <div className={`transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${isDragActive ? 'scale-110' : 'scale-100'}`}>
        {errorMsg ? (
          <div className="mb-6 text-red-600">
             <FileWarning className="w-8 h-8 mx-auto" strokeWidth={1.5} />
          </div>
        ) : (
          <div className={`mb-6 transition-colors duration-300 ${isDragActive ? 'text-zinc-900' : 'text-zinc-400 group-hover:text-zinc-600'}`}>
             <Upload className="w-8 h-8 mx-auto" strokeWidth={1.5} />
          </div>
        )}
      </div>

      <h3 className="text-xl font-serif text-zinc-900 mb-2">
        {isDragActive ? 'Drop files to convert' : (acceptAllFiles ? 'Drag & Drop Any File' : 'Drag & Drop HTML, JSON, or PDF files')}
      </h3>
      
      <p className="text-sm text-zinc-500 max-w-sm">
        {errorMsg ? (
          <span className="text-red-600">{errorMsg}</span>
        ) : (
          acceptAllFiles ? "Supports DOCX, CSV, MD, TXT, CRX, ZIP, HTML, JSON, PDF, etc." : "Supports .html, .htm, .json, and .pdf files. Multiple file selection allowed."
        )}
      </p>

      {!isDragActive && !errorMsg && (
        <div className="mt-8 flex items-center space-x-2 text-xs text-zinc-400 uppercase tracking-widest font-medium">
          <FileCode className="w-3.5 h-3.5" />
          <span>{acceptAllFiles ? 'Omni Mode Active' : 'Powered by Turndown Engine'}</span>
        </div>
      )}
    </div>
  );
};

export default DropZone;