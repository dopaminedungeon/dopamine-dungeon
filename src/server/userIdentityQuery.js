export function buildUserIdentityUpsert(database, userTable, identity, sql) {
  return database
    .insert(userTable)
    .values(identity)
    .onConflictDoUpdate({
      target: userTable.firebaseUid,
      set: {
        email: identity.email,
        displayName: identity.displayName,
        emailVerifiedAt: sql`coalesce(${userTable.emailVerifiedAt}, excluded.email_verified_at)`,
      },
    })
    .returning();
}
