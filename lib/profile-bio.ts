/** Only the existing @leo owner account can publish a bio without a character limit. */
export function canUseUnlimitedBio(profile: { handle?: string | null; is_owner?: boolean } | null | undefined): boolean {
  return profile?.handle === 'leo' && profile.is_owner === true;
}
