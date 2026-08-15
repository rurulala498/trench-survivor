export type ImageAssetKey =
  | 'battlefield'
  | 'foregroundCover'
  | 'walkerSheet0'
  | 'walkerSheet1'
  | 'walkerSheet2'
  | 'walkerSheet3'
  | 'walkerSheet4'
  | 'runnerSheet0'
  | 'runnerSheet1'
  | 'runnerSheet2'
  | 'runnerSheet3'
  | 'runnerSheet4'
  | 'bruteSheet0'
  | 'bruteSheet1'
  | 'bruteSheet2'
  | 'bruteSheet3'
  | 'bruteSheet4'
  | 'bossSheet0'
  | 'bossSheet1'
  | 'bossSheet2'
  | 'bossSheet3'
  | 'bossSheet4'
  | 'workTrench'
  | 'workWire'
  | 'hmgLeftSheet0'
  | 'hmgLeftSheet1'
  | 'hmgLeftSheet2'
  | 'hmgLeftSheet3'
  | 'hmgLeftSheet4'
  | 'hmgRightSheet0'
  | 'hmgRightSheet1'
  | 'hmgRightSheet2'
  | 'hmgRightSheet3'
  | 'hmgRightSheet4'
  | 'hmg';

export interface ImageAssetDefinition {
  path: string;
  critical: boolean;
}

export type ImageAssetManifest = Record<ImageAssetKey, ImageAssetDefinition>;
