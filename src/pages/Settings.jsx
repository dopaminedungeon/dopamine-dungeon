import React, { useState } from 'react';
import { 
  User, Bell, Shield, Palette, Database, Globe, 
  Moon, Sun, Volume2, VolumeX, Save, ChevronRight,
  Mail, Lock, Eye, EyeOff, Trash2, Download
} from 'lucide-react';

const settingsSections = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'data', label: 'Data & Storage', icon: Database },
];

export default function Settings() {
  const [activeSection, setActiveSection] = useState('profile');
  const [showPassword, setShowPassword] = useState(false);
  const [settings, setSettings] = useState({
    username: 'DungeonMaster42',
    email: 'john.doe@example.com',
    bio: 'Creating epic adventures since 2020',
    emailNotifications: true,
    pushNotifications: true,
    soundEffects: true,
    sessionAlerts: true,
    twoFactorAuth: false,
    theme: 'dark',
    language: 'en',
    autoSave: true,
  });

  const handleToggle = (key) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const Toggle = ({ enabled, onChange }) => (
    <button
      onClick={onChange}
      className={`relative w-12 h-6 rounded-full transition-colors ${
        enabled ? 'bg-purple-500' : 'bg-zinc-700'
      }`}
    >
      <span 
        className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
          enabled ? 'left-7' : 'left-1'
        }`}
      />
    </button>
  );

  return (
    <GradientBackground>
      <div className="flex min-h-screen">
        <Sidebar />
        
        <div className="flex-1 flex flex-col ml-64">
          <TopBar title="Settings" />
          
          <main className="flex-1 p-8 overflow-auto">
            <div className="max-w-5xl mx-auto">
              <div className="flex flex-col lg:flex-row gap-8">
                {/* Settings Navigation */}
                <div className="lg:w-64 shrink-0">
                  <nav className="bg-white/5 border border-white/10 rounded-2xl p-2 space-y-1">
                    {settingsSections.map((section) => {
                      const Icon = section.icon;
                      return (
                        <button
                          key={section.id}
                          onClick={() => setActiveSection(section.id)}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                            activeSection === section.id
                              ? 'bg-purple-500/20 text-white border border-purple-500/30'
                              : 'text-zinc-400 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          <Icon className={`w-5 h-5 ${activeSection === section.id ? 'text-purple-400' : ''}`} />
                          <span className="font-medium">{section.label}</span>
                          {activeSection === section.id && <ChevronRight className="w-4 h-4 ml-auto text-purple-400" />}
                        </button>
                      );
                    })}
                  </nav>
                </div>

                {/* Settings Content */}
                <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-6">
                  {/* Profile Section */}
                  {activeSection === 'profile' && (
                    <div className="space-y-6">
                      <div>
                        <h2 className="text-xl font-bold text-white mb-1">Profile Settings</h2>
                        <p className="text-zinc-500">Manage your account information</p>
                      </div>

                      {/* Avatar */}
                      <div className="flex items-center gap-6">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                          <User className="w-10 h-10 text-white" />
                        </div>
                        <div>
                          <button className="px-4 py-2 bg-purple-500/20 text-purple-400 rounded-xl hover:bg-purple-500/30 transition-colors">
                            Change Avatar
                          </button>
                          <p className="text-zinc-500 text-sm mt-2">JPG, PNG or GIF. Max 2MB</p>
                        </div>
                      </div>

                      {/* Form Fields */}
                      <div className="space-y-4">
                        <div>
                          <label className="block text-zinc-400 text-sm mb-2">Username</label>
                          <input
                            type="text"
                            value={settings.username}
                            onChange={(e) => setSettings(prev => ({ ...prev, username: e.target.value }))}
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                          />
                        </div>
                        <div>
                          <label className="block text-zinc-400 text-sm mb-2">Email</label>
                          <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                            <input
                              type="email"
                              value={settings.email}
                              onChange={(e) => setSettings(prev => ({ ...prev, email: e.target.value }))}
                              className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-zinc-400 text-sm mb-2">Bio</label>
                          <textarea
                            value={settings.bio}
                            onChange={(e) => setSettings(prev => ({ ...prev, bio: e.target.value }))}
                            rows={3}
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50 resize-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Notifications Section */}
                  {activeSection === 'notifications' && (
                    <div className="space-y-6">
                      <div>
                        <h2 className="text-xl font-bold text-white mb-1">Notification Settings</h2>
                        <p className="text-zinc-500">Configure how you receive notifications</p>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                          <div className="flex items-center gap-4">
                            <Mail className="w-5 h-5 text-zinc-400" />
                            <div>
                              <p className="text-white font-medium">Email Notifications</p>
                              <p className="text-zinc-500 text-sm">Receive updates via email</p>
                            </div>
                          </div>
                          <Toggle enabled={settings.emailNotifications} onChange={() => handleToggle('emailNotifications')} />
                        </div>

                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                          <div className="flex items-center gap-4">
                            <Bell className="w-5 h-5 text-zinc-400" />
                            <div>
                              <p className="text-white font-medium">Push Notifications</p>
                              <p className="text-zinc-500 text-sm">Get instant alerts in-app</p>
                            </div>
                          </div>
                          <Toggle enabled={settings.pushNotifications} onChange={() => handleToggle('pushNotifications')} />
                        </div>

                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                          <div className="flex items-center gap-4">
                            <Volume2 className="w-5 h-5 text-zinc-400" />
                            <div>
                              <p className="text-white font-medium">Sound Effects</p>
                              <p className="text-zinc-500 text-sm">Play sounds for notifications</p>
                            </div>
                          </div>
                          <Toggle enabled={settings.soundEffects} onChange={() => handleToggle('soundEffects')} />
                        </div>

                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                          <div className="flex items-center gap-4">
                            <Globe className="w-5 h-5 text-zinc-400" />
                            <div>
                              <p className="text-white font-medium">Session Alerts</p>
                              <p className="text-zinc-500 text-sm">Notify when sessions start</p>
                            </div>
                          </div>
                          <Toggle enabled={settings.sessionAlerts} onChange={() => handleToggle('sessionAlerts')} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Security Section */}
                  {activeSection === 'security' && (
                    <div className="space-y-6">
                      <div>
                        <h2 className="text-xl font-bold text-white mb-1">Security Settings</h2>
                        <p className="text-zinc-500">Protect your account</p>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-zinc-400 text-sm mb-2">Current Password</label>
                          <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                            <input
                              type={showPassword ? 'text' : 'password'}
                              placeholder="••••••••"
                              className="w-full pl-12 pr-12 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                            />
                            <button 
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                            >
                              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                          <div className="flex items-center gap-4">
                            <Shield className="w-5 h-5 text-zinc-400" />
                            <div>
                              <p className="text-white font-medium">Two-Factor Authentication</p>
                              <p className="text-zinc-500 text-sm">Add an extra layer of security</p>
                            </div>
                          </div>
                          <Toggle enabled={settings.twoFactorAuth} onChange={() => handleToggle('twoFactorAuth')} />
                        </div>

                        <button className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 transition-colors">
                          <Trash2 className="w-5 h-5" />
                          Delete Account
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Appearance Section */}
                  {activeSection === 'appearance' && (
                    <div className="space-y-6">
                      <div>
                        <h2 className="text-xl font-bold text-white mb-1">Appearance</h2>
                        <p className="text-zinc-500">Customize the look and feel</p>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-zinc-400 text-sm mb-3">Theme</label>
                          <div className="grid grid-cols-2 gap-4">
                            <button
                              onClick={() => setSettings(prev => ({ ...prev, theme: 'dark' }))}
                              className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
                                settings.theme === 'dark' 
                                  ? 'bg-purple-500/20 border-purple-500/50' 
                                  : 'bg-white/5 border-white/10 hover:border-white/20'
                              }`}
                            >
                              <Moon className={`w-5 h-5 ${settings.theme === 'dark' ? 'text-purple-400' : 'text-zinc-400'}`} />
                              <span className="text-white font-medium">Dark</span>
                            </button>
                            <button
                              onClick={() => setSettings(prev => ({ ...prev, theme: 'light' }))}
                              className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
                                settings.theme === 'light' 
                                  ? 'bg-purple-500/20 border-purple-500/50' 
                                  : 'bg-white/5 border-white/10 hover:border-white/20'
                              }`}
                            >
                              <Sun className={`w-5 h-5 ${settings.theme === 'light' ? 'text-purple-400' : 'text-zinc-400'}`} />
                              <span className="text-white font-medium">Light</span>
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-zinc-400 text-sm mb-2">Language</label>
                          <select
                            value={settings.language}
                            onChange={(e) => setSettings(prev => ({ ...prev, language: e.target.value }))}
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                          >
                            <option value="en">English</option>
                            <option value="es">Español</option>
                            <option value="fr">Français</option>
                            <option value="de">Deutsch</option>
                            <option value="ja">日本語</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Data Section */}
                  {activeSection === 'data' && (
                    <div className="space-y-6">
                      <div>
                        <h2 className="text-xl font-bold text-white mb-1">Data & Storage</h2>
                        <p className="text-zinc-500">Manage your data</p>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                          <div className="flex items-center gap-4">
                            <Database className="w-5 h-5 text-zinc-400" />
                            <div>
                              <p className="text-white font-medium">Auto-Save</p>
                              <p className="text-zinc-500 text-sm">Automatically save changes</p>
                            </div>
                          </div>
                          <Toggle enabled={settings.autoSave} onChange={() => handleToggle('autoSave')} />
                        </div>

                        <div className="p-4 bg-white/5 rounded-xl">
                          <div className="flex items-center justify-between mb-4">
                            <p className="text-white font-medium">Storage Used</p>
                            <span className="text-zinc-400">2.4 GB / 10 GB</span>
                          </div>
                          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full w-[24%] bg-gradient-to-r from-purple-500 to-pink-500 rounded-full" />
                          </div>
                        </div>

                        <button className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white/5 text-white rounded-xl hover:bg-white/10 transition-colors">
                          <Download className="w-5 h-5" />
                          Export All Data
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Save Button */}
                  <div className="flex justify-end mt-8 pt-6 border-t border-white/10">
                    <button className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-xl hover:opacity-90 transition-opacity">
                      <Save className="w-5 h-5" />
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </GradientBackground>
  );
}