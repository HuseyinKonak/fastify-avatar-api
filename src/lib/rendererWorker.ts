import sharp from 'sharp';
import renderAvatar from './renderer.js';
import { AvatarParams } from '../types/avatar.js';

sharp.concurrency(1);

export default async function (params: AvatarParams): Promise<{ buffer: Buffer; contentType: string }> {
  return renderAvatar(params);
}
