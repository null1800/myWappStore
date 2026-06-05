import {
  IsString,
  IsOptional,
  IsBoolean,
  IsUrl,
  MaxLength,
  MinLength,
  Matches,
  IsHexColor,
} from 'class-validator';

// ─── Update Store ─────────────────────────────────────────────────────────────
// All fields optional — merchant updates only what they want to change (PATCH)

export class UpdateStoreDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phoneWhatsapp?: string;

  @IsOptional()
  @IsHexColor({ message: 'primaryColor must be a valid hex colour e.g. #0F6E56' })
  primaryColor?: string;

  // Visibility — controls whether store appears in marketplace
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

// ─── Update Slug ──────────────────────────────────────────────────────────────
// Separate endpoint — changing slug changes the public URL, so it's deliberate

export class UpdateSlugDto {
  @IsString()
  @MinLength(3, { message: 'Store URL must be at least 3 characters' })
  @MaxLength(50, { message: 'Store URL cannot exceed 50 characters' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Store URL can only contain lowercase letters, numbers, and hyphens',
  })
  slug: string;
}

// ─── Check Slug Availability ──────────────────────────────────────────────────

export class CheckSlugDto {
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Store URL can only contain lowercase letters, numbers, and hyphens',
  })
  slug: string;
}
