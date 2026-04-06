import React, { useEffect, useMemo, useState } from "react";
import { Shield, Users, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { useAuth } from "../context/AuthContext";
import { useTenant } from "../context/TenantContext";
import {
    getMembersForTenant,
    updateTenantMemberRole,
} from "../data/tenantMembers/tenantMembers.repo";
import { removeWorkspaceMemberCascade } from "../services/workspaceMembers.service";

export default function WorkspaceSettings() {
    const { user } = useAuth();
    const { tenants, selectedTenantId } = useTenant();

    const selectedTenant = useMemo(() => {
        if (!Array.isArray(tenants) || !selectedTenantId) {
            return null;
        }

        return (
            tenants.find(
                (tenant) => tenant?.tenantId === selectedTenantId || tenant?.id === selectedTenantId
            ) || null
        );
    }, [tenants, selectedTenantId]);

    const isOwner = Boolean(
        user?.uid &&
        selectedTenant &&
        selectedTenant.createdBy === user.uid
    );

    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [savingMemberId, setSavingMemberId] = useState(null);
    const [saveState, setSaveState] = useState({ type: null, message: "" });
    const [version, setVersion] = useState(0);

    useEffect(() => {
        const loadMembers = async () => {
            if (!selectedTenantId || !isOwner) {
                setMembers([]);
                return;
            }

            try {
                setLoading(true);
                setSaveState({ type: null, message: "" });

                const tenantMembers = await getMembersForTenant(selectedTenantId);
                const userIds = Array.from(
                    new Set(tenantMembers.map((member) => String(member.userId || "")).filter(Boolean))
                );

                const userDocs = await Promise.all(
                    userIds.map(async (userId) => {
                        const snap = await getDocs(
                            query(collection(db, "users"), where("id", "==", userId))
                        );
                        const first = snap.docs[0];
                        return first ? { userId, ...first.data() } : { userId };
                    })
                );

                const usersById = userDocs.reduce((acc, currentUser) => {
                    acc[String(currentUser.userId)] = currentUser;
                    return acc;
                }, {});

                const mappedMembers = tenantMembers
                    .map((member) => {
                        const memberUserId = String(member.userId || "");
                        const memberUser = usersById[memberUserId] || {};

                        return {
                            ...member,
                            label:
                                memberUser.displayName ||
                                memberUser.email ||
                                memberUser.normalizedEmail ||
                                memberUserId ||
                                "Unknown user",
                            email: memberUser.email || "—",
                        };
                    })
                    .sort((a, b) => {
                        if (a.role === "owner" && b.role !== "owner") return -1;
                        if (a.role !== "owner" && b.role === "owner") return 1;
                        return String(a.label).localeCompare(String(b.label));
                    });

                setMembers(mappedMembers);
            } catch (error) {
                console.error("[WorkspaceSettings] Failed to load workspace members", error);
                setMembers([]);
                setSaveState({ type: "error", message: "Failed to load workspace members." });
            } finally {
                setLoading(false);
            }
        };

        loadMembers();
    }, [selectedTenantId, isOwner, version]);

    const ownerCount = useMemo(
        () => members.filter((member) => member.role === "owner").length,
        [members]
    );

    const handleRoleChange = async (member, nextRole) => {
        if (!member?.id || !nextRole || member.role === nextRole) {
            return;
        }

        if (
            member.userId === user?.uid &&
            member.role === "owner" &&
            nextRole !== "owner" &&
            ownerCount <= 1
        ) {
            setSaveState({
                type: "error",
                message: "You cannot demote the last workspace owner.",
            });
            return;
        }

        try {
            setSavingMemberId(member.id);
            await updateTenantMemberRole(member.id, nextRole);
            setSaveState({ type: "success", message: "Workspace role updated." });
            setVersion((value) => value + 1);
        } catch (error) {
            console.error("[WorkspaceSettings] Failed to update workspace role", error);
            setSaveState({ type: "error", message: "Could not update workspace role." });
        } finally {
            setSavingMemberId(null);
        }
    };

    const handleRemoveMember = async (member) => {
        if (!member?.id) {
            return;
        }

        if (member.userId === user?.uid) {
            setSaveState({
                type: "error",
                message: "You cannot remove yourself from the workspace here.",
            });
            return;
        }

        if (member.role === "owner" && ownerCount <= 1) {
            setSaveState({
                type: "error",
                message: "You cannot remove the last workspace owner.",
            });
            return;
        }

        const confirmed = window.confirm(
            "Remove this member from the workspace? This will also remove their related campaign memberships and character assignments."
        );

        if (!confirmed) {
            return;
        }

        try {
            setSavingMemberId(member.id);
            await removeWorkspaceMemberCascade({
                tenantMemberId: member.id,
                tenantId: selectedTenantId,
                userId: member.userId,
            });
            setSaveState({
                type: "success",
                message: "Workspace member removed with related campaign cleanup.",
            });
            setVersion((value) => value + 1);
        } catch (error) {
            console.error("[WorkspaceSettings] Failed to remove workspace member", error);
            setSaveState({ type: "error", message: "Could not remove workspace member." });
        } finally {
            setSavingMemberId(null);
        }
    };

    if (!selectedTenantId || !selectedTenant) {
        return (
            <section className="relative overflow-hidden rounded-3xl border border-fuchsia-500/16 bg-zinc-950/55 p-5 shadow-[0_0_0_1px_rgba(168,85,247,0.04),0_0_36px_rgba(99,102,241,0.08)] before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.12),transparent_34%),radial-gradient(circle_at_right,rgba(59,130,246,0.08),transparent_30%)] before:opacity-100 before:content-['']">
                <div className="relative z-10">
                    <div className="flex items-start gap-3">
                        <Shield className="mt-0.5 h-5 w-5 text-fuchsia-300" />
                        <div>
                            <h2 className="text-lg font-semibold text-white">Workspace Settings</h2>
                            <p className="mt-1 text-sm text-zinc-300/80">
                                Select a workspace first to manage members, roles, and ownership-level settings.
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        );
    }

    if (!isOwner) {
        return (
            <section className="relative overflow-hidden rounded-3xl border border-red-400/18 bg-zinc-950/55 p-5 shadow-[0_0_0_1px_rgba(248,113,113,0.04),0_0_32px_rgba(248,113,113,0.06)] before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top_left,rgba(248,113,113,0.12),transparent_30%),radial-gradient(circle_at_right,rgba(168,85,247,0.08),transparent_34%)] before:opacity-100 before:content-['']">
                <div className="relative z-10">
                    <div className="flex items-start gap-3">
                        <Shield className="mt-0.5 h-5 w-5 text-red-300" />
                        <div>
                            <h2 className="text-lg font-semibold text-white">Workspace Settings</h2>
                            <p className="mt-1 text-sm text-zinc-300/80">
                                This tab is available only to the workspace owner.
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <div className="space-y-4">
            <section className="relative overflow-hidden rounded-3xl border border-fuchsia-500/18 bg-zinc-950/55 p-5 shadow-[0_0_0_1px_rgba(168,85,247,0.04),0_0_36px_rgba(99,102,241,0.08)] before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.12),transparent_32%),radial-gradient(circle_at_right,rgba(59,130,246,0.08),transparent_30%)] before:opacity-100 before:content-['']">
                <div className="relative z-10 flex items-start gap-3">
                    <Shield className="mt-0.5 h-5 w-5 text-fuchsia-300" />
                    <div>
                        <h1 className="text-lg font-semibold text-white">Workspace Settings</h1>
                        <p className="mt-1 text-sm text-zinc-300/80">
                            Manage members, update workspace roles, and remove people from this workspace.
                        </p>
                        <p className="mt-3 text-xs uppercase tracking-[0.14em] text-fuchsia-200/80">
                            {selectedTenant.name || "Untitled workspace"}
                        </p>
                    </div>
                </div>
            </section>

            <section className="relative overflow-hidden rounded-3xl border border-cyan-400/18 bg-zinc-950/55 p-5 shadow-[0_0_0_1px_rgba(34,211,238,0.04),0_0_32px_rgba(34,211,238,0.08)] before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_32%),radial-gradient(circle_at_left,rgba(168,85,247,0.08),transparent_36%)] before:opacity-100 before:content-['']">
                <div className="relative z-10">
                    <div className="mb-4 flex items-start gap-3">
                        <Users className="mt-0.5 h-5 w-5 text-cyan-300" />
                        <div>
                            <h2 className="text-base font-semibold text-white">Workspace members</h2>
                            <p className="mt-1 text-sm text-zinc-300/75">
                                Member list, role updates, and removal actions will live here.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-[0_0_24px_rgba(168,85,247,0.05)]">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm font-medium text-zinc-100">Workspace members</p>
                                    <p className="mt-1 text-sm text-zinc-300/75">
                                        Change workspace roles and remove members from this workspace.
                                    </p>
                                </div>
                                <span className="text-xs text-zinc-300/70">
                                    {loading ? "Loading…" : `${members.length} member${members.length === 1 ? "" : "s"}`}
                                </span>
                            </div>

                            <div className="mt-4 flex flex-wrap items-center gap-3">
                                {saveState.type === "success" ? (
                                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-sm text-emerald-200">
                                        <CheckCircle2 className="h-4 w-4" />
                                        {saveState.message}
                                    </div>
                                ) : null}

                                {saveState.type === "error" ? (
                                    <div className="inline-flex items-center gap-2 rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1.5 text-sm text-red-200">
                                        <AlertCircle className="h-4 w-4" />
                                        {saveState.message}
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-[0_0_24px_rgba(168,85,247,0.05)]">
                            {loading ? (
                                <p className="text-sm text-zinc-300/75">Loading workspace members…</p>
                            ) : members.length === 0 ? (
                                <p className="text-sm text-zinc-300/75">No members found for this workspace.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[760px] border-separate border-spacing-y-2">
                                        <thead>
                                            <tr className="text-left text-xs uppercase tracking-[0.18em] text-zinc-400/80">
                                                <th className="pb-2 pr-4 font-medium">Member</th>
                                                <th className="pb-2 pr-4 font-medium">Workspace role</th>
                                                <th className="pb-2 pr-4 font-medium">Joined</th>
                                                <th className="pb-2 font-medium">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {members.map((member) => {
                                                const isCurrentUser = member.userId === user?.uid;
                                                const isOnlyOwner = member.role === "owner" && ownerCount <= 1;
                                                const isBusy = savingMemberId === member.id;

                                                return (
                                                    <tr key={member.id} className="align-top">
                                                        <td className="rounded-l-2xl border-y border-l border-white/10 bg-white/[0.025] px-4 py-3">
                                                            <div className="space-y-1">
                                                                <p className="text-sm font-medium text-zinc-100">{member.label}</p>
                                                                <p className="text-xs text-zinc-400">{member.email}</p>
                                                                <p className="text-[11px] text-zinc-500">User ID: {member.userId}</p>
                                                            </div>
                                                        </td>

                                                        <td className="border-y border-white/10 bg-white/[0.025] px-4 py-3">
                                                            <select
                                                                value={member.role}
                                                                onChange={(e) => handleRoleChange(member, e.target.value)}
                                                                disabled={
                                                                    isBusy ||
                                                                    (isCurrentUser && member.role === "owner" && ownerCount <= 1)
                                                                }
                                                                className="w-full max-w-[180px] rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white shadow-inner shadow-black/10 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                                                            >
                                                                <option value="owner">owner</option>
                                                                <option value="admin">admin</option>
                                                                <option value="member">member</option>
                                                            </select>
                                                        </td>

                                                        <td className="border-y border-white/10 bg-white/[0.025] px-4 py-3 text-sm text-zinc-300">
                                                            {member.createdAt
                                                                ? new Date(member.createdAt).toLocaleDateString()
                                                                : "—"}
                                                        </td>

                                                        <td className="rounded-r-2xl border-y border-r border-white/10 bg-white/[0.025] px-4 py-3">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveMember(member)}
                                                                disabled={isBusy || isCurrentUser || isOnlyOwner}
                                                                className="inline-flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-200 transition hover:bg-red-400/15 disabled:cursor-not-allowed disabled:opacity-50"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                                Remove
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
