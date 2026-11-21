import { useState } from 'react';
import { Check, Download } from 'lucide-react';
import { BrowserSimulator } from './components/BrowserSimulator';
import { ExtensionInspector } from './components/ExtensionInspector';
import { InstallGuide } from './components/InstallGuide';
import { downloadChromeExtensionZip } from './extension/zipBuilder';

type AppView = 'preview' | 'files' | 'install';

export default function App() {
  const [view, setView] = useState<AppView>('preview');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadDone, setDownloadDone] = useState(false);

  const handleDownloadZip = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      await downloadChromeExtensionZip();
      setDownloadDone(true);
      window.setTimeout(() => setDownloadDone(false), 3000);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => setView('preview')}
            className="text-lg font-bold tracking-tight text-slate-950 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-md"
          >
            Cadence
          </button>

          {/* Zone 2: Concise single-line navigation links */}
          <nav
            aria-label="Primary navigation"
            className="flex items-center gap-6 sm:gap-8 text-sm font-medium"
          >
            {(
              [
                { id: 'preview', label: 'Live Preview' },
                { id: 'files', label: 'Extension Files' },
                { id: 'install', label: 'Install Guide' },
              ] as const
            ).map((item) => {
              const isActive = view === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setView(item.id)}
                  className={`py-1 whitespace-nowrap shrink-0 transition-colors border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                    isActive
                      ? 'text-slate-950 border-blue-600'
                      : 'text-slate-600 border-transparent hover:text-slate-950 hover:border-slate-300'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={handleDownloadZip}
              disabled={isDownloading}
              className="h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              {downloadDone ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Downloaded ZIP</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>{isDownloading ? 'Packaging...' : 'Download Extension'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1">
        {view === 'preview' && <BrowserSimulator />}
        {view === 'files' && (
          <ExtensionInspector
            onDownloadZip={handleDownloadZip}
            isDownloading={isDownloading}
          />
        )}
        {view === 'install' && (
          <InstallGuide
            onDownloadZip={handleDownloadZip}
            isDownloading={isDownloading}
          />
        )}
      </main>
    </div>
  );
}
