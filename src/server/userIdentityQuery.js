export function buildUserIdentityUpsert(database, userTable, identity) {
  return database
    .insert(userTable)
    .values(identity)
    .onConflictDoUpdate({
      target: userTable.firebaseUid,
      set: {
        email: identity.email,
        displayName: identity.displayName,
      },
    })
    .returning();
}
