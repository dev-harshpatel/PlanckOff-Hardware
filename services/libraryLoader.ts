
/**
 * Service to handle dynamic loading of external libraries (PDF.js, SheetJS).
 * This acts as a fallback or primary loader depending on app configuration.
 */

const PDFJS_VERSION = '3.11.174';
const CDN_BASE = 'https://cdn.jsdelivr.net/npm';

interface Library {
  name: string;
  globalVar: string;
  url: string;
  workerUrl?: string;
}

const LIBRARIES: Library[] = [
  {
    name: 'pdfjs',
    globalVar: 'pdfjsLib',
    url: `${CDN_BASE}/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.js`,
    workerUrl: `${CDN_BASE}/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.js`
  },
  {
    name: 'xlsx',
    globalVar: 'XLSX',
    url: `${CDN_BASE}/xlsx/dist/xlsx.full.min.js`
  }
];

/**
 * Loads a script tag into the DOM
 */
const loadScript = (url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        // Check if script already exists to prevent duplicates
        if (document.querySelector(`script[src="${url}"]`)) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = url;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
        document.body.appendChild(script);
    });
};

/**
 * Checks if libraries are loaded and attempts to load them if missing.
 */
export const ensureLibrariesLoaded = async (): Promise<void> => {
  const loadPromises = LIBRARIES.map(async (lib) => {
    if ((window as any)[lib.globalVar]) {
      return; // Already loaded
    }

    try {
      console.log(`Loading ${lib.name} dynamically...`);
      await loadScript(lib.url);
      
      // Post-load configuration for PDF.js
      if (lib.name === 'pdfjs') {
          if ((window as any).pdfjsLib && lib.workerUrl) {
             (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = lib.workerUrl;
          }
          window.pdfJsFailedToLoad = false;
      }
      
      if (lib.name === 'xlsx') {
          window.sheetJsFailedToLoad = false;
      }
      
    } catch (error) {
      console.error(`Error loading ${lib.name}:`, error);
      if (lib.name === 'pdfjs') window.pdfJsFailedToLoad = true;
      if (lib.name === 'xlsx') window.sheetJsFailedToLoad = true;
      
      throw new Error(`Failed to load required library: ${lib.name}. Please check your internet connection.`);
    }
  });

  await Promise.all(loadPromises);
};