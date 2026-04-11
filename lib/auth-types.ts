export type AppRole = "READER" | "AUTHOR" | "ADMIN";

export type PublicUser = {
  id: string;
  email: string;
  name: string | null;
  role: AppRole;
};

export type StoredUser = PublicUser & {
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
};
