import JSZip from 'jszip';

/**
 * Der Export eines installierten Systems als Original-Archiv, aus
 * `useImporter.js` herausgeschnitten (Issue 0176). Das Herunterladen ist
 * Browserarbeit, keine Zustandsführung — der Hook meldet nur, was dabei
 * herauskam.
 */

/**
 * Ein System ohne die rohen XML-Dateien lässt sich nicht zurückgeben, wie es
 * hereinkam.
 */
export function hasRawXmls(system) {
  return !!system?.rawXmls;
}

/**
 * Packt die rohen XML-Dateien des Systems und reicht sie dem Browser als
 * Download durch.
 */
export async function downloadSystemArchive(system) {
  const zip = new JSZip();
  system.rawXmls.gst?.forEach(file => zip.file(file.name, file.content));
  system.rawXmls.cat?.forEach(file => zip.file(file.name, file.content));

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${system.name}_original.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
