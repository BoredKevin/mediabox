/**
 * Lightweight, low-overhead dominant color extractor optimized for Smart TVs.
 * Samples a thumbnail into a tiny offscreen canvas and computes an eye-pleasing,
 * deep atmospheric background color with caching to avoid CPU/GPU strain.
 */

const colorCache = new Map<string, { dominant: string; gradient: string }>();

const DEFAULT_COLOR = {
  dominant: '#1a101f',
  gradient: 'radial-gradient(circle at 65% 45%, #24132b 0%, #0d0612 100%)',
};

export const extractDominantColor = async (
  imageUrl: string
): Promise<{ dominant: string; gradient: string }> => {
  if (!imageUrl) return DEFAULT_COLOR;

  const cached = colorCache.get(imageUrl);
  if (cached) return cached;

  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) {
            resolve(DEFAULT_COLOR);
            return;
          }

          // Sample down to 8x8 to minimize processing
          canvas.width = 8;
          canvas.height = 8;
          ctx.drawImage(img, 0, 0, 8, 8);

          const { data } = ctx.getImageData(0, 0, 8, 8);
          let r = 0;
          let g = 0;
          let b = 0;
          let count = 0;

          for (let i = 0; i < data.length; i += 4) {
            // Ignore near-black and near-white pixels
            const pr = data[i];
            const pg = data[i + 1];
            const pb = data[i + 2];
            const maxVal = Math.max(pr, pg, pb);
            const minVal = Math.min(pr, pg, pb);

            if (maxVal > 25 && minVal < 240) {
              r += pr;
              g += pg;
              b += pb;
              count++;
            }
          }

          if (count === 0) {
            colorCache.set(imageUrl, DEFAULT_COLOR);
            resolve(DEFAULT_COLOR);
            return;
          }

          r = Math.round(r / count);
          g = Math.round(g / count);
          b = Math.round(b / count);

          // Deepen/darken for high contrast against white text (target 20-30% luminance)
          const factor = Math.min(0.65, 80 / Math.max(r, g, b, 1));
          const darkR = Math.round(r * factor);
          const darkG = Math.round(g * factor);
          const darkB = Math.round(b * factor);

          // Deep base for bottom/edges
          const edgeR = Math.round(darkR * 0.4);
          const edgeG = Math.round(darkG * 0.4);
          const edgeB = Math.round(darkB * 0.4);

          const dominant = `rgb(${darkR}, ${darkG}, ${darkB})`;
          const edge = `rgb(${edgeR}, ${edgeG}, ${edgeB})`;
          const gradient = `radial-gradient(circle at 70% 35%, ${dominant} 0%, ${edge} 100%)`;

          const result = { dominant, gradient };
          colorCache.set(imageUrl, result);
          resolve(result);
        } catch {
          resolve(DEFAULT_COLOR);
        }
      };

      img.onerror = () => {
        resolve(DEFAULT_COLOR);
      };

      img.src = imageUrl;
    } catch {
      resolve(DEFAULT_COLOR);
    }
  });
};
