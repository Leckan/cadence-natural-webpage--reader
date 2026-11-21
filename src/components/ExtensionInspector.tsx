import { useState } from 'react';
import { Check, Copy, Download, FileCode2 } from 'lucide-react';
import { EXTENSION_FILES } from '../extension/extensionFiles';

interface ExtensionInspectorProps {
  onDownloadZip: () => void;
  isDownloading: boolean;
}

export function ExtensionInspector({
  onDownloadZip,
  isDownloading,
}: ExtensionInspectorProps) {
  const [selectedPath, setSelectedPath] = useState<string>(EXTENSION_FILES[0].path);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const activeFile =
    EXTENSION_FILES.find((f) => f.path === selectedPath) ?? EXTENSION_FILES[0];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeFile.content);
      setCopiedPath(activeFile.path);
      window.setTimeout(() => setCopiedPath(null), 1800);
    } catch {
      // Clipboard blocked in restricted contexts
    }
  };

  const lineCount = activeFile.content.split('\n').length;
  const sizeKb = (new Blob([activeFile.content]).size / 1024).toFixed(1);

  return (
    <div className="w-full max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Manifest V3 Extension Source
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Inspect every file included in the downloadable Chrome extension package. PNG icons (16px, 48px, 128px) are automatically generated and bundled inside the ZIP archive.
          </p>
        </div>
        <button
          type="button"
          onClick={onDownloadZip}
          disabled={isDownloading}
          className="h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors disabled:opacity-60"
        >
          <Download className="w-4 h-4" />
          <span>{isDownloading ? 'Packaging...' : 'Download Extension (.zip)'}</span>
        </button>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white overflow-hidden grid grid-cols-1 lg:grid-cols-[260px_1fr]">
        {/* File Tree Sidebar */}
        <nav
          aria-label="Extension files"
          className="border-b lg:border-b-0 lg:border-r border-slate-200 bg-slate-50/70 p-3 space-y-1"
        >
          <div className="px-2.5 py-1.5 text-xs font-medium text-slate-500">
            cadence-chrome-extension/
          </div>
          {EXTENSION_FILES.map((file) => {
            const isSelected = file.path === activeFile.path;
            return (
              <button
                key={file.path}
                type="button"
                onClick={() => setSelectedPath(file.path)}
                className={`w-full px-3 py-2 rounded-lg text-left text-sm flex items-center gap-2.5 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                  isSelected
                    ? 'bg-white text-slate-900 font-medium shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900'
                }`}
              >
                <FileCode2 className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate font-mono text-[13px]">{file.label}</span>
              </button>
            );
          })}
          <div className="pt-3 mt-3 border-t border-slate-200 px-3 text-xs text-slate-500 space-y-1">
            <div className="font-mono text-[12px] text-slate-600">icons/icon16.png</div>
            <div className="font-mono text-[12px] text-slate-600">icons/icon48.png</div>
            <div className="font-mono text-[12px] text-slate-600">icons/icon128.png</div>
            <p className="text-[11px] text-slate-400 pt-1">
              Auto-rendered when downloading ZIP
            </p>
          </div>
        </nav>

        {/* Source Viewer */}
        <div className="min-w-0 flex flex-col">
          <div className="px-5 py-3.5 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-mono font-medium text-slate-900">
                <span>{activeFile.path}</span>
                <span className="text-slate-300" aria-hidden="true">·</span>
                <span className="text-xs font-sans font-normal text-slate-500 tabular-nums">
                  {lineCount} lines · {sizeKb} KB
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{activeFile.summary}</p>
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className="h-9 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              {copiedPath === activeFile.path ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy File</span>
                </>
              )}
            </button>
          </div>

          <div className="flex-1 overflow-auto bg-slate-950 text-slate-100 p-5 max-h-[620px]">
            <pre className="font-mono text-[12.5px] leading-relaxed whitespace-pre">
              <code>{activeFile.content}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
