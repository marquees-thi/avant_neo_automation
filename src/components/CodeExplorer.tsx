import React, { useState } from 'react';
import { PYTHON_FILES, PythonFileItem } from '../data/pythonFiles';
import { FileCode, Download, Copy, Check, Folder, ChevronRight, FileText, Settings, Play } from 'lucide-react';
import JSZip from 'jszip';

interface CodeExplorerProps {
  onDownloadZip: () => void;
  isDownloadingZip: boolean;
}

export const CodeExplorer: React.FC<CodeExplorerProps> = ({
  onDownloadZip,
  isDownloadingZip,
}) => {
  const [selectedFile, setSelectedFile] = useState<PythonFileItem>(PYTHON_FILES[2]); // main.py
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getFileIcon = (file: PythonFileItem) => {
    if (file.name.endsWith('.py')) return <FileCode className="w-4 h-4 text-sky-400" />;
    if (file.name.endsWith('.yaml') || file.name.endsWith('.txt')) return <Settings className="w-4 h-4 text-amber-400" />;
    if (file.name.endsWith('.bat') || file.name.endsWith('.vbs')) return <Play className="w-4 h-4 text-emerald-400" />;
    return <FileText className="w-4 h-4 text-neutral-400" />;
  };

  return (
    <div className="rounded-2xl bg-neutral-900 border border-neutral-800 p-6 space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-white">Arquitetura de Código Python Modular</h2>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
              Python 3.10+ · Windows 11
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Código completo, tipado (Type Hints) e pronto para produção com desacoplamento multithread
          </p>
        </div>

        <button
          onClick={onDownloadZip}
          disabled={isDownloadingZip}
          className="px-4 py-2 text-xs font-semibold text-neutral-950 bg-amber-400 rounded-lg hover:bg-amber-300 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50 self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{isDownloadingZip ? 'Compactando...' : 'Baixar Todo o Projeto (.zip)'}</span>
        </button>
      </div>

      {/* Main Grid: File Tree + Code Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[580px]">
        {/* Left: File Tree */}
        <div className="lg:col-span-4 bg-neutral-950 rounded-xl p-4 border border-neutral-800 space-y-4">
          <span className="text-xs font-semibold text-neutral-300 block">Arquivos do Software</span>

          <div className="space-y-1 font-mono text-xs">
            {PYTHON_FILES.map((file) => {
              const isSelected = selectedFile.path === file.path;
              return (
                <button
                  key={file.path}
                  onClick={() => setSelectedFile(file)}
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2.5 transition-colors ${
                    isSelected
                      ? 'bg-neutral-800 text-white font-medium shadow-sm border border-neutral-700/80'
                      : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'
                  }`}
                >
                  {getFileIcon(file)}
                  <span className="truncate">{file.path}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-3 border-t border-neutral-800/80 text-[11px] text-neutral-500 font-mono">
            {PYTHON_FILES.length} arquivos prontos para execução em segundo plano.
          </div>
        </div>

        {/* Right: Code Viewer */}
        <div className="lg:col-span-8 bg-neutral-950 rounded-xl border border-neutral-800 flex flex-col overflow-hidden">
          {/* Code Viewer Header */}
          <div className="px-4 py-3 bg-neutral-900/90 border-b border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-white">{selectedFile.path}</span>
              <span className="text-xs text-neutral-400 hidden sm:inline">· {selectedFile.description}</span>
            </div>

            <button
              onClick={handleCopyCode}
              className="px-2.5 py-1 text-xs text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-md border border-neutral-700 flex items-center gap-1.5 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span>Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copiar Código</span>
                </>
              )}
            </button>
          </div>

          {/* Code Content with Line Numbers */}
          <div className="flex-1 p-4 font-mono text-xs overflow-auto bg-neutral-950 text-neutral-300 max-h-[500px]">
            <pre className="leading-relaxed">
              {selectedFile.content.split('\n').map((line, idx) => (
                <div key={idx} className="flex">
                  <span className="w-10 select-none text-neutral-600 text-right pr-4 shrink-0">
                    {idx + 1}
                  </span>
                  <span className="whitespace-pre">{line}</span>
                </div>
              ))}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
