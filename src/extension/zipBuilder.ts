import JSZip from 'jszip';
import { EXTENSION_FILES } from './extensionFiles';

/**
 * Programmatically draws a crisp PNG extension icon at the requested pixel size
 * so the downloaded Chrome extension loads cleanly with zero missing icon warnings.
 */
function renderExtensionIconPng(size: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Canvas context unavailable'));
      return;
    }

    const r = Math.round(size * 0.24);

    // Rounded square cobalt tile
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(size - r, 0);
    ctx.quadraticCurveTo(size, 0, size, r);
    ctx.lineTo(size, size - r);
    ctx.quadraticCurveTo(size, size, size - r, size);
    ctx.lineTo(r, size);
    ctx.quadraticCurveTo(0, size, 0, size - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, '#2563EB');
    grad.addColorStop(1, '#1E40AF');
    ctx.fillStyle = grad;
    ctx.fill();

    // Draw 5 balanced acoustic waveform bars
    const barHeights = [0.28, 0.54, 0.72, 0.46, 0.24];
    const totalBars = barHeights.length;
    const barWidth = Math.max(1.5, size * 0.085);
    const gap = Math.max(1, size * 0.065);
    const groupWidth = totalBars * barWidth + (totalBars - 1) * gap;
    const startX = (size - groupWidth) / 2;

    ctx.fillStyle = '#FFFFFF';
    barHeights.forEach((hRatio, i) => {
      const barH = Math.max(2, size * hRatio * 0.76);
      const x = startX + i * (barWidth + gap);
      const y = (size - barH) / 2;
      const br = barWidth / 2;

      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barH, br);
      ctx.fill();
    });

    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to export PNG icon'));
    }, 'image/png');
  });
}

/**
 * Generates and triggers a browser download of the complete Manifest V3 Chrome extension ZIP.
 */
export async function downloadChromeExtensionZip(): Promise<void> {
  const zip = new JSZip();

  for (const file of EXTENSION_FILES) {
    zip.file(file.path, file.content);
  }

  const iconSizes = [16, 48, 128];
  const iconsFolder = zip.folder('icons');
  if (iconsFolder) {
    for (const size of iconSizes) {
      const pngBlob = await renderExtensionIconPng(size);
      iconsFolder.file(`icon${size}.png`, pngBlob);
    }
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(zipBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'cadence-chrome-extension.zip';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
