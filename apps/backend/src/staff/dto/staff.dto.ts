import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
} from 'class-validator';

export enum StaffRole {
  STAFF = 'STAFF',
}

export class InviteStaffDto {
  @IsEmail({}, { message: 'Please enter a valid email address' })
  email: string;

  @IsEnum(StaffRole, { message: 'Role must be STAFF' })
  role: StaffRole = StaffRole.STAFF;
}

export class AcceptInviteDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
