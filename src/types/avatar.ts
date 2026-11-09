export type AvatarFormat = 'png' | 'svg' | 'webp' | 'jpeg';
export type AvatarShape = 'circle' | 'square' | 'rounded';
export type AvatarMode = 'short' | 'long';

export interface AvatarParams {
  name: string;
  width: number;
  height: number;
  mode: AvatarMode;
  format: AvatarFormat;
  shape: AvatarShape;
  background?: string;
  color?: string;
  fontFamily: string;
  fontSize?: number;
  bold: boolean;
  uppercase: boolean;
  gradient: boolean;
  rounded: number;
}
