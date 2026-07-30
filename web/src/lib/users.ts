import { UserStatus } from "@/generated/prisma/client";
import { deriveUserName } from "@/lib/user-names";

export type UserDto = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  telegramUserId: string | null;
  status: UserStatus;
  isAdmin: boolean;
  createdAt: string;
};

export function toUserDto(user: {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  telegramUserId: string | null;
  status: UserStatus;
  isAdmin: boolean;
  createdAt: Date;
}): UserDto {
  const name =
    user.name ??
    deriveUserName(user.firstName, user.lastName);
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    name,
    telegramUserId: user.telegramUserId,
    status: user.status,
    isAdmin: user.isAdmin,
    createdAt: user.createdAt.toISOString(),
  };
}

export const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  name: true,
  telegramUserId: true,
  status: true,
  isAdmin: true,
  createdAt: true,
} as const;
