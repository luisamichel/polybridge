import type { Profile } from "@/lib/api";

export function isProfileConfigured(
  profile: Profile | null | undefined,
): boolean {
  if (!profile || Object.keys(profile).length === 0) return false;
  return Boolean(profile.target_language?.trim());
}
