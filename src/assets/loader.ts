import { IMAGE_ASSETS } from './manifest';
import type { ImageAssetKey } from './types';

type AssetState = 'idle' | 'loading' | 'ready' | 'error';
const images = new Map<ImageAssetKey, HTMLImageElement>();
const states = new Map<ImageAssetKey, AssetState>();

function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`;
}

function loadImage(key: ImageAssetKey): Promise<void> {
  const def = IMAGE_ASSETS[key];
  states.set(key, 'loading');
  return new Promise(resolve => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      images.set(key, image);
      states.set(key, 'ready');
      resolve();
    };
    image.onerror = () => {
      states.set(key, 'error');
      console.warn(`[assets] failed to load ${key}: ${def.path}`);
      resolve();
    };
    image.src = assetUrl(def.path);
  });
}

export async function preloadAssets(): Promise<void> {
  const keys = Object.keys(IMAGE_ASSETS) as ImageAssetKey[];
  await Promise.all(keys.filter(key => IMAGE_ASSETS[key].critical).map(loadImage));
}

export function imageAsset(key: ImageAssetKey): HTMLImageElement | null {
  return states.get(key) === 'ready' ? images.get(key) ?? null : null;
}

export function assetState(key: ImageAssetKey): AssetState {
  return states.get(key) ?? 'idle';
}

