import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  Matches,
  IsNotEmpty,
} from 'class-validator';

// ─── Register ─────────────────────────────────────────────────────────────────

export class RegisterDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(72, { message: 'Password cannot exceed 72 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  password: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  businessName: string;

  // mywappstore.com/[slug] — lowercase letters, numbers, hyphens only
  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: 'Store URL must be at least 3 characters' })
  @MaxLength(50, { message: 'Store URL cannot exceed 50 characters' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Store URL can only contain lowercase letters, numbers, and hyphens (e.g. rays-electronics)',
  })
  storeSlug: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phoneWhatsapp?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  fullName?: string;
}

// ─── Login ────────────────────────────────────────────────────────────────────

export class LoginDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

// ─── Refresh Token ────────────────────────────────────────────────────────────

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

// ─── Response types (for controller return types) ─────────────────────────────

export interface AuthResponseDto {
  user: {
    id: string;
    email: string;
    fullName: string | null;
    role: string;
  };
  tenant: {
    id: string;
    slug: string;
    name: string;
    plan: string;
  };
  accessToken: string;
  expiresIn: number;
}
