import { IsArray, IsUrl, ArrayMaxSize, ArrayMinSize } from 'class-validator';

// Validates image URLs before they're stored. Without this, an attacker could
// store javascript: or data: URIs which then render as <img src="..."> in the
// storefront and execute arbitrary JS in visitors' browsers (stored XSS).
// @IsUrl() rejects non-http/https schemes by default, covering both vectors.
export class UpdateImagesDto {
  @IsArray()
  @ArrayMinSize(0)
  @ArrayMaxSize(10, { message: 'Maximum 10 images per product' })
  @IsUrl(
    {
      protocols: ['https', 'http'],
      require_protocol: true,
      // Disallow javascript:, data:, and any other non-http scheme
    },
    { each: true, message: 'Each image must be a valid https:// or http:// URL' },
  )
  images: string[];
}
