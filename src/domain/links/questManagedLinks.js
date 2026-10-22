// Quest hero fields own these links. Entity profile relationship editors may
// show them, but only the Quest save flow may mutate them.
const managedQuestLabels = new Set(["started", "completed", "failed", "given_by", "leads_to", "assigned_to"]);

export function isManagedQuestLabel(label) {
  return managedQuestLabels.has(label);
}

export function isManagedQuestLink(link) {
  return Boolean(link && isManagedQuestLabel(link.label) &&
    (link.entityA?.type === "Quest" || link.entityB?.type === "Quest"));
}

export function editableProfileLinks(links) {
  return (links || []).filter((link) => !isManagedQuestLink(link));
}
