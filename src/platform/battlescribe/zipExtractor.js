import JSZip from 'jszip';

/**
 * Extracts XML files (.cat, .gst) from a uploaded ZIP file.
 * @param {File} file - The uploaded ZIP file
 * @returns {Promise<{gstFiles: Array<{name: string, content: string}>, catFiles: Array<{name: string, content: string}>}>}
 */
export async function extractZipFiles(file) {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(file);
  
  const gstFiles = [];
  const catFiles = [];
  
  for (const [filename, zipEntry] of Object.entries(loadedZip.files)) {
    if (zipEntry.dir) continue;
    
    // Ignore OS metadata files like __MACOSX
    if (filename.includes('__MACOSX') || filename.startsWith('.')) continue;

    if (filename.endsWith('.gst')) {
      const content = await zipEntry.async('string');
      // Normalize basename
      const name = filename.substring(filename.lastIndexOf('/') + 1);
      gstFiles.push({ name, content });
    } else if (filename.endsWith('.cat')) {
      const content = await zipEntry.async('string');
      const name = filename.substring(filename.lastIndexOf('/') + 1);
      catFiles.push({ name, content });
    }
  }

  return { gstFiles, catFiles };
}
