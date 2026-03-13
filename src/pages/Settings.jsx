import React, { useEffect, useMemo, useState } from "react";
import {
  User,
  Mail,
  Shield,
  LogOut,
  Save,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { updateProfile } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

import { useAuth } from "../context/AuthContext.jsx";
import { useMode } from "../context/ModeContext.jsx";
import { useTenant } from "../context/TenantContext.jsx";
import { useCampaign } from "../context/CampaignContext.jsx";
import { auth, db } from "../firebase/firebase";

const EMPTY_PROFILE = {
  displayName: "",
  reducedMotion: false,
};

function getProviderLabel(user) {
  const providerId = user?.providerData?.[0]?.providerId;
  if (providerId === "google.com") return "Google";
  if (providerId === "password") return "Email / Password";
  if (providerId === "emailLink") return "Email Link";
  return providerId || "Unknown";
}

export default function Settings() {
  const { user, logout } = useAuth();
  const { mode } = useMode();
  const { tenants, selectedTenantId } = useTenant();
  const { accessibleCampaigns, selectedCampaignId, campaignRole } = useCampaign();

  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState({ type: null, message: "" });

  const selectedTenant = useMemo(
    () => (Array.isArray(tenants) ? tenants.find((t) => t.tenantId === selectedTenantId) : null),
    [tenants, selectedTenantId]
  );

  const selectedCampaign = useMemo(
    () =>
      Array.isArray(accessibleCampaigns)
        ? accessibleCampaigns.find((c) => c.campaignId === selectedCampaignId)
        : null,
    [accessibleCampaigns, selectedCampaignId]
  );

  useEffect(() => {
    if (!user) {
      setProfile(EMPTY_PROFILE);
      setLoading(false);
      return;
    }

    async function loadProfile() {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const profileDoc = snap.exists() ? snap.data() : {};

        setProfile({
          displayName: profileDoc?.displayName || user.displayName || "",
          reducedMotion: Boolean(profileDoc?.reducedMotion),
        });
      } catch (error) {
        console.error("[Settings] Failed to load profile", error);
        setProfile({
          displayName: user.displayName || "",
          reducedMotion: false,
        });
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [user]);

  async function handleSave() {
    if (!user) return;

    setSaving(true);
    setSaveState({ type: null, message: "" });

    try {
      const nextDisplayName = profile.displayName.trim();

      if (auth.currentUser && nextDisplayName !== (auth.currentUser.displayName || "")) {
        await updateProfile(auth.currentUser, {
          displayName: nextDisplayName || null,
        });
      }

      await setDoc(
        doc(db, "users", user.uid),
        {
          displayName: nextDisplayName,
          reducedMotion: Boolean(profile.reducedMotion),
          email: user.email || null,
          updatedAt: Date.now(),
        },
        { merge: true }
      );

      setSaveState({ type: "success", message: "Profile settings saved." });
    } catch (error) {
      console.error("[Settings] Failed to save profile", error);
      setSaveState({ type: "error", message: "Could not save settings. Check console for details." });
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    try {
      await logout?.();
    } catch (error) {
      console.error("[Settings] Logout failed", error);
    }
  }

  if (loading) {
    return (
      <main className="flex-1 overflow-auto flex items-center justify-center">
        <div className="text-zinc-400">Loading profile settings...</div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Profile Settings</h1>
            <p className="text-zinc-500 mt-1">
              Manage your account, connected login, and personal preferences.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-4 sm:gap-6">
          <section className="bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white">Account</h2>
              <p className="text-zinc-500 text-sm mt-1">
                These settings belong to you, not to the campaign.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-zinc-400 text-sm mb-2">Display name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                  <input
                    type="text"
                    value={profile.displayName}
                    onChange={(e) =>
                      setProfile((prev) => ({ ...prev, displayName: e.target.value }))
                    }
                    placeholder="How you appear in the app"
                    className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 text-sm mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                  <input
                    type="email"
                    value={user?.email || ""}
                    readOnly
                    className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-zinc-300 cursor-not-allowed"
                  />
                </div>
                <p className="text-zinc-500 text-xs mt-2">
                  Email is managed by your connected authentication provider.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-linear-to-r from-purple-500 to-pink-500 text-white font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                <Save className="w-4 h-4" />
                {saving ? "Saving..." : "Save Changes"}
              </button>

              {saveState.type === "success" && (
                <div className="inline-flex items-center gap-2 text-emerald-300 text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  {saveState.message}
                </div>
              )}

              {saveState.type === "error" && (
                <div className="inline-flex items-center gap-2 text-red-300 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {saveState.message}
                </div>
              )}
            </div>
          </section>

          <div className="space-y-4 sm:space-y-6">
            <section className="bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Authentication</h2>
                <p className="text-zinc-500 text-sm mt-1">
                  Your connected sign-in method and account status.
                </p>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-zinc-400 mt-0.5" />
                  <div>
                    <p className="text-white font-medium">Connected provider</p>
                    <p className="text-zinc-400">{getProviderLabel(user)}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-zinc-400 mt-0.5" />
                  <div>
                    <p className="text-white font-medium">Authentication email</p>
                    <p className="text-zinc-400">{user?.email || "No email available"}</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Current Role</h2>
                <p className="text-zinc-500 text-sm mt-1">
                  Your current context in the selected workspace and campaign.
                </p>
              </div>

              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-zinc-500">Workspace</p>
                  <p className="text-white font-medium">{selectedTenant?.name || "No workspace selected"}</p>
                </div>

                <div>
                  <p className="text-zinc-500">Campaign</p>
                  <p className="text-white font-medium">{selectedCampaign?.name || "No campaign selected"}</p>
                </div>

                <div>
                  <p className="text-zinc-500">Campaign role</p>
                  <p className="text-white font-medium">{campaignRole || "Unknown"}</p>
                </div>

                <div>
                  <p className="text-zinc-500">Current app mode</p>
                  <p className="text-white font-medium">{String(mode).toLowerCase() === "gm" ? "GM" : "Player"}</p>
                </div>
              </div>
            </section>

            <section className="bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Session</h2>
                <p className="text-zinc-500 text-sm mt-1">
                  Sign out of this device when you are done.
                </p>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}