import React, { useState, useCallback, useRef } from 'react';
import { Settings2, Github, Sparkles, FileDiff, Download, Copy, Check, Menu, X } from 'lucide-react';
import DropZone from './components/DropZone';
import FileItem from './components/FileItem';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { ProcessedFile, ConversionStatus } from './types';
import { convertHtmlToMarkdown, convertJsonToMarkdown, getSmartFilename, processUniversalFile } from './services/converter';

const App: React.FC = () => {
  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"]
  });

  const textXLeft = useTransform(scrollYProgress, [0, 1], ["0vw", "-50vw"]);
  const textXRight = useTransform(scrollYProgress, [0, 1], ["0vw", "50vw"]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const subtitleY = useTransform(scrollYProgress, [0, 1], ["0px", "100px"]);

  const handleProcessFile = useCallback(async (id: string, action: string, rawFileArgs?: File) => {
    let rawFile = rawFileArgs;
    if (!rawFile) {
       const fileEntry = files.find(f => f.id === id);
       rawFile = fileEntry?.rawFile;
    }
    
    if (!rawFile) return;

    setFiles(current => current.map(f => f.id === id ? { ...f, status: ConversionStatus.PROCESSING, performedAction: action } : f));

    try {
      const result = await processUniversalFile(rawFile, action);
      
      setFiles(current => current.map(f => f.id === id ? { 
        ...f, 
        status: ConversionStatus.COMPLETED,
        content: result.markdown || '',
        markdownName: result.smartName || f.originalName || 'file',
        pdfUrl: result.pdfUrl,
        images: result.images,
        fillablePdfUrl: result.fillablePdfUrl,
        formFields: result.formFields,
        aiReport: result.aiReport
      } : f));
    } catch (err) {
      console.error(err);
      setFiles(current => current.map(f => f.id === id ? { ...f, status: ConversionStatus.ERROR, errorMessage: 'Processing failed' } : f));
    }
  }, [files]);

  const processFiles = useCallback((incomingFiles: File[]) => {
    const newEntries: ProcessedFile[] = incomingFiles.map(file => ({
      id: crypto.randomUUID(),
      originalName: file.name,
      markdownName: file.name,
      content: '',
      originalSize: file.size,
      status: ConversionStatus.AWAITING_ACTION,
      timestamp: Date.now(),
      rawFile: file
    }));

    setFiles(prev => [...newEntries, ...prev]);

    // Automatically trigger processing for common files so users don't have to manually click the "Action required" buttons
    setTimeout(() => {
        newEntries.forEach(entry => {
            const ext = entry.originalName.split('.').pop()?.toLowerCase();
            if (['jpg', 'jpeg', 'png', 'webp', 'pdf'].includes(ext || '')) {
                handleProcessFile(entry.id, 'ai_analysis', entry.rawFile);
            } else if (['html', 'htm'].includes(ext || '')) {
                handleProcessFile(entry.id, 'markdown_smart', entry.rawFile);
            } else if (ext === 'docx') {
                handleProcessFile(entry.id, 'markdown_raw', entry.rawFile);
            } else {
                handleProcessFile(entry.id, 'markdown_raw', entry.rawFile); // fallback defaults
            }
        });
    }, 100);
  }, [handleProcessFile]);

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const clearAll = () => {
    if (confirm('Are you sure you want to clear all converted files?')) {
      setFiles([]);
    }
  };

  const generateMergedContent = () => {
    const completedFiles = files.filter(f => f.status === ConversionStatus.COMPLETED);
    if (completedFiles.length === 0) return '';

    let mergedContent = `# Merged Output\n\n`;
    completedFiles.forEach(file => {
      mergedContent += `## Source: ${file.originalName}\n\n${file.content}\n\n---\n\n`;
    });
    return mergedContent;
  };

  const handleDownloadAll = () => {
    const mergedContent = generateMergedContent();
    if (!mergedContent) return;

    const blob = new Blob([mergedContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `merged_output_${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyAll = async () => {
    const mergedContent = generateMergedContent();
    if (!mergedContent) return;

    try {
      await navigator.clipboard.writeText(mergedContent);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="relative w-full min-h-screen bg-[#F9F9F7] text-[#111111] font-sans selection:bg-zinc-200">
      
      {/* Refined Navigation Menu */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#F9F9F7]/90 backdrop-blur-md border-b border-zinc-200/60">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-6 h-6 bg-black text-white flex items-center justify-center rounded-sm">
              <FileDiff className="w-3.5 h-3.5" />
            </div>
            <span className="text-sm font-semibold tracking-wide uppercase">Format Smormat</span>
          </div>
          
          <button 
            onClick={() => setMenuOpen(!menuOpen)}
            className="text-zinc-900 hover:text-zinc-500 transition-colors p-2"
            aria-label="Toggle Menu"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Full-screen Menu Overlay */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-40 bg-[#F9F9F7] pt-24 px-6 md:px-12"
          >
            <div className="max-w-6xl mx-auto">
              <nav className="flex flex-col space-y-8">
                <a href="#" className="group flex flex-col border-b border-zinc-200 pb-6">
                  <span className="text-3xl font-serif text-zinc-900 group-hover:text-zinc-500 transition-colors">Documentation</span>
                  <span className="text-sm text-zinc-500 mt-2">Read the technical specifications and API guidelines.</span>
                </a>
                <a href="#" className="group flex flex-col border-b border-zinc-200 pb-6">
                  <span className="text-3xl font-serif text-zinc-900 group-hover:text-zinc-500 transition-colors">Source Code</span>
                  <span className="text-sm text-zinc-500 mt-2">View the repository on GitHub.</span>
                </a>
                <a href="#" className="group flex flex-col border-b border-zinc-200 pb-6">
                  <span className="text-3xl font-serif text-zinc-900 group-hover:text-zinc-500 transition-colors">Settings</span>
                  <span className="text-sm text-zinc-500 mt-2">Configure default conversion behaviors.</span>
                </a>
              </nav>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scroll-linked Hero Section */}
      <div ref={heroRef} className="h-[150vh] relative z-10">
        <div className="sticky top-0 h-screen flex flex-col items-center justify-center overflow-hidden px-6">
          <motion.h1 
            style={{ opacity: textOpacity }}
            className="text-6xl md:text-8xl lg:text-9xl font-serif font-medium mb-6 tracking-tight cursor-default group flex space-x-4 md:space-x-8"
          >
            <motion.span
              style={{ x: textXLeft }}
              whileHover={{ scale: 1.03, y: -2 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="inline-block relative"
            >
              <span className="block relative z-10 bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 via-zinc-700 to-zinc-900 transition-opacity duration-700 group-hover:opacity-0">
                Format
              </span>
              <span className="block absolute left-0 top-0 z-20 bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity duration-700 animate-text-gradient whitespace-nowrap">
                Format
              </span>
            </motion.span>
            <motion.span
              style={{ x: textXRight }}
              whileHover={{ scale: 1.03, y: -2 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="inline-block relative"
            >
              <span className="block relative z-10 bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 via-zinc-700 to-zinc-900 transition-opacity duration-700 group-hover:opacity-0">
                Smormat
              </span>
              <span className="block absolute left-0 top-0 z-20 bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity duration-700 animate-text-gradient whitespace-nowrap">
                Smormat
              </span>
            </motion.span>
          </motion.h1>
          
          <motion.div style={{ opacity: textOpacity, y: subtitleY }} className="text-center">
            <p className="text-zinc-500 max-w-lg mx-auto text-lg leading-relaxed">
              A refined utility for document conversion. Scroll down to extract clean, structured markdown.
            </p>
            <div className="mt-6 flex items-center justify-center space-x-2 text-xs font-medium tracking-widest uppercase text-zinc-400">
              <motion.span whileHover={{ scale: 1.1, color: '#111' }} className="cursor-default transition-colors">HTML</motion.span>
              <span className="w-1 h-1 rounded-full bg-zinc-300"></span>
              <motion.span whileHover={{ scale: 1.1, color: '#111' }} className="cursor-default transition-colors">JSON</motion.span>
              <span className="w-1 h-1 rounded-full bg-zinc-300"></span>
              <motion.span whileHover={{ scale: 1.1, color: '#111' }} className="cursor-default transition-colors">DOCX</motion.span>
              <span className="w-1 h-1 rounded-full bg-zinc-300"></span>
              <motion.span whileHover={{ scale: 1.1, color: '#111' }} className="cursor-default transition-colors">PDF</motion.span>
              <span className="w-1 h-1 rounded-full bg-zinc-300"></span>
              <motion.span whileHover={{ scale: 1.1, color: '#111' }} className="cursor-default transition-colors">ZIP</motion.span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="pb-32 max-w-4xl mx-auto px-6 relative z-20 bg-[#F9F9F7] pt-12 min-h-screen">
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Drag & Drop Area */}
          <div className="mb-16 mt-8">
            <DropZone onFilesDropped={processFiles} acceptAllFiles={true} />
          </div>

          {/* Results List */}
          {files.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex items-center justify-between mb-6 border-b border-zinc-200 pb-4">
                <h3 className="text-lg font-serif font-medium text-zinc-900">Processed Files ({files.length})</h3>
                
                <div className="flex items-center space-x-4">
                  {files.some(f => f.status === ConversionStatus.COMPLETED) && (
                    <>
                      <button 
                        onClick={handleCopyAll}
                        className="flex items-center space-x-1.5 text-xs text-zinc-600 hover:text-zinc-900 transition-colors font-medium"
                      >
                        {copiedAll ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedAll ? 'Copied' : 'Copy All'}</span>
                      </button>
                      <button 
                        onClick={handleDownloadAll}
                        className="flex items-center space-x-1.5 text-xs bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2 rounded-sm transition-colors font-medium"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Merged</span>
                      </button>
                    </>
                  )}
                  <div className="w-px h-4 bg-zinc-300 mx-1"></div>
                  <button 
                    onClick={clearAll}
                    className="text-xs text-zinc-400 hover:text-red-600 transition-colors uppercase tracking-widest font-semibold"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {files.map(file => (
                  <FileItem 
                    key={file.id} 
                    file={file} 
                    onRemove={removeFile}
                    onProcess={handleProcessFile} 
                  />
                ))}
              </div>
            </motion.div>
          )}
          
        </motion.div>
      </main>
      
      {/* Footer */}
      <footer className="py-8 text-center text-zinc-400 text-xs tracking-widest uppercase border-t border-zinc-200">
        <p>Pure Client-Side Processing • 2026</p>
      </footer>
    </div>
  );
};

export default App;