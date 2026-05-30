import { db } from "../api/_lib/db";
import { users } from "../db/schema/users";
import { workspaces } from "../db/schema/workspaces";
import { campaigns } from "../db/schema/campaigns";
import {
    workspaceMemberships,
    campaignMemberships,
} from "../db/schema/memberships";

import { eq } from "drizzle-orm";

import { getFirestore } from "firebase-admin/firestore";
import { getApps, initializeApp, cert } from "firebase-admin/app";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Missing Firebase Admin environment variables");
}

if (!getApps().length) {
    initializeApp({
        credential: cert({
            projectId,
            clientEmail,
            privateKey,
        }),
    });
}

const firestore = getFirestore();

async function migrate() {
    console.log("🔥 Starting Firebase → Postgres migration");

    // --- FIRESTORE USERS → POSTGRES USERS
    const firestoreUsersSnap = await firestore.collection("users").get();

    for (const doc of firestoreUsersSnap.docs) {
        const data = doc.data();

        await db
            .insert(users)
            .values({
                firebaseUid: doc.id,
                email: data.email ?? null,
            })
            .onConflictDoNothing();
    }

    console.log("👤 Firestore users migrated:", firestoreUsersSnap.size);

    // --- USERS MAP (firebaseUid → postgresId)
    const pgUsers = await db.select().from(users);
    const userMap = new Map(
        pgUsers.map((u) => [u.firebaseUid, u.id])
    );

    console.log("👤 Users mapped:", userMap.size);

    // --- TENANTS → WORKSPACES
    const tenantsSnap = await firestore.collection("tenants").get();

    const workspaceMap = new Map<string, string>(); // tenantId → workspaceId

    for (const doc of tenantsSnap.docs) {
        const data = doc.data();

        const ownerId = userMap.get(data.createdBy);

        if (!ownerId) {
            console.warn("⚠️ Skipping tenant, user not found:", doc.id);
            continue;
        }

        let [workspace] = await db
            .insert(workspaces)
            .values({
                name: data.name,
                slug: doc.id,
                ownerUserId: ownerId,
            })
            .onConflictDoNothing()
            .returning();

        if (!workspace) {
            const existingWorkspace = await db
                .select()
                .from(workspaces)
                .where(eq(workspaces.slug, doc.id))
                .limit(1);

            workspace = existingWorkspace[0];
        }

        if (!workspace) {
            console.warn("⚠️ Skipping tenant, workspace not created or found:", doc.id);
            continue;
        }

        workspaceMap.set(doc.id, workspace.id);

        await db.insert(workspaceMemberships).values({
            workspaceId: workspace.id,
            userId: ownerId,
            role: "owner",
        }).onConflictDoNothing();
    }

    console.log("🏠 Workspaces migrated:", workspaceMap.size);

    // --- TENANT MEMBERS → WORKSPACE MEMBERSHIPS
    const tenantMembersSnap = await firestore.collection("tenantMembers").get();

    let workspaceMembershipsMigrated = 0;

    for (const doc of tenantMembersSnap.docs) {
        const data = doc.data();

        const workspaceId = workspaceMap.get(data.tenantId);
        const userId = userMap.get(data.userId);

        if (!workspaceId || !userId) {
            console.warn("⚠️ Skipping tenant member, workspace or user missing:", doc.id);
            continue;
        }

        await db.insert(workspaceMemberships).values({
            workspaceId,
            userId,
            role: data.role,
        }).onConflictDoNothing();

        workspaceMembershipsMigrated += 1;
    }

    console.log("🔗 Workspace memberships migrated:", workspaceMembershipsMigrated);

    // --- CAMPAIGNS
    const campaignsSnap = await firestore.collection("campaigns").get();

    const campaignMap = new Map<string, string>();

    for (const doc of campaignsSnap.docs) {
        const data = doc.data();

        const workspaceId = workspaceMap.get(data.tenantId);

        if (!workspaceId) {
            console.warn("⚠️ Skipping campaign, workspace missing:", doc.id);
            continue;
        }

        let [campaign] = await db
            .insert(campaigns)
            .values({
                name: data.name,
                slug: doc.id,
                workspaceId,
            })
            .onConflictDoNothing()
            .returning();

        if (!campaign) {
            const existingCampaign = await db
                .select()
                .from(campaigns)
                .where(eq(campaigns.slug, doc.id))
                .limit(1);

            campaign = existingCampaign[0];
        }

        if (campaign?.id) {
            campaignMap.set(doc.id, campaign.id);
        }
    }

    console.log("🎲 Campaigns migrated:", campaignMap.size);

    // --- CAMPAIGN MEMBERS
    const campaignMembersSnap = await firestore
        .collection("campaignMembers")
        .get();

    let campaignMembershipsMigrated = 0;

    for (const doc of campaignMembersSnap.docs) {
        const data = doc.data();

        const userId = userMap.get(data.userId);
        const campaignId = campaignMap.get(data.campaignId);

        if (!userId || !campaignId) {
            console.warn("⚠️ Skipping campaign member, campaign or user missing:", doc.id);
            continue;
        }

        await db.insert(campaignMemberships).values({
            campaignId,
            userId,
            role: data.role,
        }).onConflictDoNothing();

        campaignMembershipsMigrated += 1;
    }

    console.log("🔗 Campaign memberships migrated:", campaignMembershipsMigrated);

    console.log("✅ DONE");
}

migrate().catch((e) => {
    console.error(e);
    process.exit(1);
});