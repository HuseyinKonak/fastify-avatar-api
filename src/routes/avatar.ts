import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import * as cache from '../lib/cache.js';
import { rendererPool } from '../lib/workerPool.js';
import config from '../config/index.js';

const querySchema = z.object({
  name: z.string()
    .min(1)
    .max(100)
    .trim()
    .describe('The name or text to generate the avatar for. Initials will be extracted automatically.'),
  width: z.coerce.number().int()
    .min(16)
    .max(config.MAX_WIDTH)
    .default(128)
    .describe('Width of the resulting image in pixels.'),
  height: z.coerce.number().int()
    .min(16)
    .max(config.MAX_HEIGHT)
    .default(128)
    .describe('Height of the resulting image in pixels.'),
  mode: z.enum(['short', 'long'])
    .default('short')
    .describe('Generation mode: "short" for initials, "long" for full name.'),
  shape: z.enum(['circle', 'square', 'rounded'])
    .default('circle')
    .describe('The shape of the avatar mask.'),
  format: z.enum(['png', 'webp', 'jpeg', 'svg'])
    .default('png')
    .describe('The output image format.'),
  background: z.string()
    .regex(/^#?([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/)
    .max(7)
    .optional()
    .describe('Hex background color, for example "ff0000" or "#f00".'),
  color: z.string()
    .regex(/^#?([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/)
    .max(7)
    .optional()
    .describe('Hex text color.'),
  fontFamily: z.string()
    .regex(/^[a-zA-Z0-9\s,-]+$/)
    .max(50)
    .default('Arial')
    .describe('The font family for the text.'),
  fontSize: z.coerce.number().int()
    .min(8)
    .max(512)
    .optional()
    .describe('Override the automatic font size calculation.'),
  bold: z.enum(['true', 'false'])
    .default('true')
    .transform(v => v === 'true')
    .describe('Whether the text should be bold.'),
  gradient: z.enum(['true', 'false'])
    .default('false')
    .transform(v => v === 'true')
    .describe('Apply a synthetic gradient background based on the name.'),
  rounded: z.coerce.number().int()
    .min(0)
    .max(1000)
    .default(0)
    .describe('Edge radius for rounded square shape.'),
  uppercase: z.enum(['true', 'false'])
    .default(config.NODE_ENV === 'test' ? 'false' : 'true')
    .transform(v => v === 'true')
    .describe('Force the text to uppercase.'),
}).strict();

const AvatarSchema = {
  querystring: querySchema,
  response: {
    200: z.instanceof(Buffer).or(z.instanceof(Uint8Array)).describe('The generated avatar image.'),
    400: z.object({
      type: z.string(),
      title: z.string(),
      status: z.number(),
      detail: z.string(),
      instance: z.string(),
      invalid_params: z.array(z.any()).optional(),
    }).describe('RFC 7807 Problem Details for validation errors.'),
    500: z.object({
      type: z.string(),
      title: z.string(),
      status: z.number(),
      detail: z.string(),
      instance: z.string(),
    }).describe('RFC 7807 Problem Details for internal errors.'),
  }
};



export default async function (fastify: FastifyInstance) {
  const typedFastify = fastify.withTypeProvider<ZodTypeProvider>();

  typedFastify.get('/avatar', {
    schema: {
      ...AvatarSchema,
      summary: 'Generate an avatar image',
      description: 'Returns an image buffer in PNG, SVG, WebP, or JPEG format.',
    },
  }, async (request, reply) => {
    const params = request.query;
    const cacheKey = cache.generateKey(params);

    // Use the Stampede-protected generator with Contextual Logging
    const { data, hit } = await cache.getOrGenerate(cacheKey, async () => {
      let response: { buffer: Uint8Array | Buffer; contentType: string };
      try {
        // Hand off CPU-intensive task to Piscina Worker Pool
        response = await rendererPool.run(params);
      } catch (error) {
        request.log.error({ err: error }, 'Rendering failed');
        throw new Error('Rendering Failed');
      }
      // Ensure the returned Uint8Array from structured clone is a Buffer
      return { buffer: Buffer.from(response.buffer), contentType: response.contentType };
    }, request.log);

    return reply
      .header('Content-Type', data.contentType)
      .header('Cache-Control', `public, max-age=${config.CACHE_TTL_MS / 1000}`)
      .header('X-Cache', hit ? 'HIT' : 'MISS')
      .send(data.buffer);
  });

}

