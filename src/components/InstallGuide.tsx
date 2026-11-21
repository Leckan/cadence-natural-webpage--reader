import { Download } from 'lucide-react';

interface InstallGuideProps {
  onDownloadZip: () => void;
  isDownloading: boolean;
}

const STEPS = [
  {
    number: '01',
    title: 'Download and extract the extension folder',
    body: 'Click Download Extension to save cadence-chrome-extension.zip, then unzip it to a permanent folder on your computer.',
  },
  {
    number: '02',
    title: 'Open Chrome Extensions management',
    body: 'Type chrome://extensions in your Google Chrome address bar and press Enter. Toggle Developer mode on in the upper-right corner.',
  },
  {
    number: '03',
    title: 'Load the unpacked extension',
    body: 'Click Load unpacked in the top-left toolbar and choose the extracted cadence-chrome-extension folder containing manifest.json.',
  },
  {
    number: '04',
    title: 'Pin Cadence and start listening',
    body: 'Click the Extensions puzzle icon next to the Chrome address bar and pin Cadence. Open any article, click the Cadence icon, and press Read Page.',
  },
];

const SHORTCUTS = [
  { key: 'Alt + Shift + R', action: 'Play or pause reading the current webpage in Chrome' },
  { key: 'Right-click selection', action: 'Choose "Read selection aloud with Cadence" from the context menu' },
  { key: 'Click any sentence', action: 'Jump directly to that sentence while reading is active' },
  { key: 'Space (Preview)', action: 'Play or pause inside this interactive browser preview' },
];

const PERMISSIONS = [
  {
    permission: 'activeTab',
    purpose: 'Reads text content strictly on the tab you choose to listen to—never in the background.',
  },
  {
    permission: 'scripting',
    purpose: 'Injects sentence and word highlight wrappers and restores the original DOM when stopped.',
  },
  {
    permission: 'storage',
    purpose: 'Saves your preferred natural voice, playback speed, highlight color, and auto-scroll setting.',
  },
  {
    permission: 'contextMenus',
    purpose: 'Adds the right-click "Read selection aloud with Cadence" option for highlighted passages.',
  },
];

export function InstallGuide({ onDownloadZip, isDownloading }: InstallGuideProps) {
  return (
    <div className="w-full max-w-[1040px] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-8 border-b border-slate-200">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 [text-wrap:balance]">
            Install Cadence in Google Chrome
          </h1>
          <p className="text-base text-slate-600 mt-2 leading-relaxed">
            Cadence runs locally using Chrome&apos;s built-in Speech Synthesis voices. No API keys, accounts, or external servers are required.
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

      {/* 4 Installation Steps */}
      <section aria-labelledby="install-steps-heading" className="space-y-6">
        <h2 id="install-steps-heading" className="text-lg font-semibold text-slate-900">
          Setup Steps
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {STEPS.map((step) => (
            <div
              key={step.number}
              className="p-6 rounded-xl bg-white border border-slate-200 space-y-2"
            >
              <div className="text-xs font-mono font-medium text-blue-600 tabular-nums">
                Step {step.number}
              </div>
              <h3 className="text-base font-semibold text-slate-900">
                {step.title}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Shortcuts & Permissions Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-2">
        <section aria-labelledby="shortcuts-heading" className="space-y-4">
          <h2 id="shortcuts-heading" className="text-lg font-semibold text-slate-900">
            Shortcuts &amp; Interactions
          </h2>
          <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-2.5 px-4">Trigger</th>
                  <th className="py-2.5 px-4">Behavior</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {SHORTCUTS.map((item) => (
                  <tr key={item.key}>
                    <td className="py-3 px-4 font-mono text-xs text-slate-900 whitespace-nowrap align-top">
                      {item.key}
                    </td>
                    <td className="py-3 px-4 text-slate-600 leading-snug">
                      {item.action}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="permissions-heading" className="space-y-4">
          <h2 id="permissions-heading" className="text-lg font-semibold text-slate-900">
            Minimal Permissions
          </h2>
          <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-2.5 px-4">Permission</th>
                  <th className="py-2.5 px-4">Why it is used</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {PERMISSIONS.map((item) => (
                  <tr key={item.permission}>
                    <td className="py-3 px-4 font-mono text-xs text-slate-900 whitespace-nowrap align-top">
                      {item.permission}
                    </td>
                    <td className="py-3 px-4 text-slate-600 leading-snug">
                      {item.purpose}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
