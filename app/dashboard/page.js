'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getUser, logoutUser } from '../../lib/auth';
import { client, functions, validateClient, storage, databases, Permission, Role, ID as AppwriteID } from '../../lib/appwrite';
// Utils and popups removed as part of cleanup
// Removed FloatingChatButton (Qloo-related)
import { Functions, Teams, ID, Query } from 'appwrite';

// Stable, top-level TeamsList component to avoid remounts on parent re-renders
const TeamsList = ({ onSelect, selectedTeamId, reloadFlag, currentUser }) => {
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [teams, setTeams] = useState([]);
  const [error, setError] = useState('');
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoTeam, setInfoTeam] = useState(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoError, setInfoError] = useState('');
  const [infoOwner, setInfoOwner] = useState(null);
  const [infoPrefs, setInfoPrefs] = useState(null);
  const [infoEditOpen, setInfoEditOpen] = useState(false);
  const [infoEditName, setInfoEditName] = useState('');
  const [infoEditing, setInfoEditing] = useState(false);
  const [infoEditError, setInfoEditError] = useState('');
  const [infoDeleteOpen, setInfoDeleteOpen] = useState(false);
  const [infoDeleting, setInfoDeleting] = useState(false);
  const [infoDeleteError, setInfoDeleteError] = useState('');

  useEffect(() => {
    let isMounted = true;
    const fetchTeams = async () => {
      try {
        setError('');
        setLoadingTeams(true);
        if (!validateClient()) {
          throw new Error('Configuration missing');
        }
        const teamsSdk = new Teams(client);
        const list = await teamsSdk.list();
        if (!isMounted) return;
        setTeams(list?.teams || []);
      } catch (e) {
        if (!isMounted) return;
        setError(e?.message || 'Failed to fetch teams');
      } finally {
        if (!isMounted) return;
        setLoadingTeams(false);
      }
    };
    fetchTeams();
    return () => { isMounted = false; };
  }, [reloadFlag]);

  if (loadingTeams) {
    return <div className="text-sm text-gray-500">Loading teams...</div>;
  }
  if (error) {
    return <div className="text-sm text-red-600">{error}</div>;
  }
  if (!teams.length) {
    return <div className="text-sm text-gray-500">No teams yet.</div>;
  }

  return (
    <>
    <ul className="divide-y divide-gray-100">
      {teams.map((t) => {
        const isSelected = selectedTeamId === t.$id;
        return (
          <li
            key={t.$id}
            className={`py-3 px-3 rounded-lg transition-colors border ${
              isSelected ? 'bg-blue-50 border-blue-200 shadow-sm' : 'border-gray-100 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0 cursor-pointer" onClick={() => onSelect && onSelect(t)}>
                <p className="text-sm font-semibold text-gray-900 truncate">{t.name}</p>
                <p className="text-xs text-gray-500 truncate">{t.$id}</p>
              </div>
              {t.isOwner && (
                <span className="ml-2 shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Owner</span>
              )}
            </div>
            <div className="mt-2">
              <button
                className="text-[10px] px-2 py-0.5 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50"
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    if (!validateClient()) throw new Error('Configuration missing');
                    setInfoError('');
                    setInfoLoading(true);
                    setInfoTeam(t);
                    setInfoOpen(true);
                    const teamsSdk = new Teams(client);
                    const memRes = await teamsSdk.listMemberships(t.$id);
                    const memberships = memRes?.memberships || [];
                    const owner = memberships.find((m) => Array.isArray(m.roles) && m.roles.includes('owner')) || null;
                    setInfoOwner(owner);
                    let prefs = {};
                    if (typeof teamsSdk.getPrefs === 'function') {
                      prefs = (await teamsSdk.getPrefs(t.$id)) || {};
                    } else {
                      const team = await teamsSdk.get(t.$id);
                      prefs = team?.prefs || {};
                    }
                    setInfoPrefs(prefs);
                  } catch (ie) {
                    setInfoError(ie?.message || 'Failed to load team info');
                  } finally {
                    setInfoLoading(false);
                  }
                }}
              >
                Info
              </button>
            </div>
          </li>
        );
      })}
    </ul>
    {infoOpen && infoTeam && (
      <div className="fixed inset-0 z-50">
        <div className="fixed inset-0 bg-black/30" onClick={() => !infoLoading && setInfoOpen(false)}></div>
        <div className="flex items-center justify-center min-h-screen p-4">
          <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full p-6">
            <div className="flex items-start justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">Team Details</h4>
              <div className="flex items-center gap-2">
                {(infoOwner?.userId && currentUser?.$id && infoOwner.userId === currentUser.$id) && (
                  <>
                    <button
                      title="Edit Team"
                      className="p-2 rounded-md hover:bg-gray-100 text-gray-600 hover:text-gray-900"
                      onClick={() => { setInfoEditError(''); setInfoEditName(infoTeam?.name || ''); setInfoEditOpen(true); }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793z" />
                        <path fillRule="evenodd" d="M11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828zM2 13.172L12.172 3a4 4 0 115.656 5.656L7.657 18.828A2 2 0 016.243 19H2.5A.5.5 0 012 18.5v-3.743a2 2 0 01.586-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button
                      title="Delete Team"
                      className="p-2 rounded-md hover:bg-red-50 text-red-600 hover:text-red-700"
                  onClick={() => { setInfoDeleteError(''); setInfoDeleteOpen(true); }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 100 2h.293l.853 10.24A2 2 0 007.138 18h5.724a2 2 0 001.992-1.76L15.707 6H16a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM8 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </>
                )}
                <button className="px-3 py-1 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50" onClick={() => setInfoOpen(false)}>Close</button>
              </div>
            </div>
            {infoError && <div className="mb-2 p-2 text-sm bg-red-50 border border-red-200 rounded text-red-700">{infoError}</div>}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left column: Team meta and preferences */}
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-900 font-medium">{infoTeam.name}</p>
                  <p className="text-xs text-gray-500">{infoTeam.$id}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-700 mb-1">Preferences</p>
                  <div className="border border-gray-200 rounded p-2 text-sm text-gray-800">
                    <p className="flex items-center gap-2">
                      <span className="text-gray-600">Join Code:</span>
                      {infoPrefs?.joinCode ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-mono text-xs">
                          {infoPrefs.joinCode}
                        </span>
                      ) : (
                        <span className="text-gray-500">N/A</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Right column: Owner */}
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-gray-700 mb-1">Owner</p>
                  <div className="border border-gray-200 rounded p-2">
                    {infoLoading ? (
                      <p className="text-xs text-gray-500">Loading owner...</p>
                    ) : (
                      (() => {
                        const ownerName =
                          (infoOwner?.userName && infoOwner.userName.trim()) ||
                          (infoOwner?.userEmail ? infoOwner.userEmail.split('@')[0] : '') ||
                          ((infoOwner?.userId && currentUser?.$id && infoOwner.userId === currentUser.$id) ? (currentUser.name || (currentUser.email ? currentUser.email.split('@')[0] : '')) : '') ||
                          'Unknown';
                        const ownerEmail =
                          (infoOwner?.userEmail && infoOwner.userEmail.trim()) ||
                          ((infoOwner?.userId && currentUser?.$id && infoOwner.userId === currentUser.$id) ? (currentUser.email || '') : '') ||
                          'No email';
                        return (
                          <>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Owner</span>
                              <p className="text-sm text-gray-900">{ownerName}</p>
                            </div>
                            <p className="text-xs text-gray-500">{ownerEmail}</p>
                          </>
                        );
                      })()
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
    {infoEditOpen && (
      <div className="fixed inset-0 z-[60]">
        <div className="fixed inset-0 bg-black/30" onClick={() => !infoEditing && setInfoEditOpen(false)}></div>
        <div className="flex items-center justify-center min-h-screen p-4">
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Edit Team Name</h4>
            {infoEditError && (
              <div className="mb-3 p-2 text-sm bg-red-50 border border-red-200 rounded text-red-700">{infoEditError}</div>
            )}
            <input
              type="text"
              value={infoEditName}
              onChange={(e) => setInfoEditName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Team name"
              disabled={infoEditing}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                onClick={() => setInfoEditOpen(false)}
                disabled={infoEditing}
              >
                Cancel
              </button>
              <button
                className={`px-4 py-2 rounded-lg font-medium ${infoEditing ? 'bg-gray-300 text-gray-600' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                disabled={infoEditing || !infoEditName.trim()}
                onClick={async () => {
                  try {
                    setInfoEditError('');
                    if (!infoEditName.trim()) { setInfoEditError('Name is required'); return; }
                    if (!validateClient()) throw new Error('Configuration missing');
                    setInfoEditing(true);
                    const teamsSdk = new Teams(client);
                    const newName = infoEditName.trim();
                    await teamsSdk.updateName(infoTeam.$id, newName);
                    // Update popup, list, and selection if same team selected
                    setInfoTeam((prev) => prev ? { ...prev, name: newName } : prev);
                    setTeams((prev) => Array.isArray(prev) ? prev.map((x) => x.$id === infoTeam.$id ? { ...x, name: newName } : x) : prev);
                    setInfoEditOpen(false);
                  } catch (e) {
                    setInfoEditError(e?.message || 'Failed to update team');
                  } finally {
                    setInfoEditing(false);
                  }
                }}
              >
                {infoEditing ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    {infoDeleteOpen && (
      <div className="fixed inset-0 z-[60]">
        <div className="fixed inset-0 bg-black/30" onClick={() => !infoDeleting && setInfoDeleteOpen(false)}></div>
        <div className="flex items-center justify-center min-h-screen p-4">
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Delete Team</h4>
            {infoDeleteError && (
              <div className="mb-3 p-2 text-sm bg-red-50 border border-red-200 rounded text-red-700">{infoDeleteError}</div>
            )}
            <p className="text-sm text-gray-700">Are you sure you want to delete &quot;{infoTeam?.name}&quot;? This action cannot be undone.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                onClick={() => setInfoDeleteOpen(false)}
                disabled={infoDeleting}
              >
                Cancel
              </button>
              <button
                className={`px-4 py-2 rounded-lg font-medium ${infoDeleting ? 'bg-gray-300 text-gray-600' : 'bg-red-600 text-white hover:bg-red-700'}`}
                disabled={infoDeleting}
                onClick={async () => {
                  try {
                    setInfoDeleteError('');
                    if (!validateClient()) throw new Error('Configuration missing');
                    setInfoDeleting(true);
                    const teamsSdk = new Teams(client);
                    await teamsSdk.delete(infoTeam.$id);
                    // Optimistically update UI
                    setTeams((prev) => Array.isArray(prev) ? prev.filter((t) => t.$id !== infoTeam.$id) : prev);
                    if (selectedTeamId === infoTeam.$id && typeof onSelect === 'function') {
                      onSelect(null);
                    }
                    setInfoDeleteOpen(false);
                    setInfoOpen(false);
                  } catch (e) {
                    setInfoDeleteError(e?.message || 'Failed to delete team');
                  } finally {
                    setInfoDeleting(false);
                  }
                }}
              >
                {infoDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

function DashboardContent() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const [emails, setEmails] = useState([]);
  const [emailsLoading, setEmailsLoading] = useState(false);
  const [emailsError, setEmailsError] = useState(null);
  const [selectedEmail, setSelectedEmail] = useState(null);
  // Gmail integration removed
  const [showSearchFilter, setShowSearchFilter] = useState(false);
  const [searchingBooking, setSearchingBooking] = useState(false);
  const [popupEmail, setPopupEmail] = useState(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  // legacy removed: isSummaryOpen/summaryLoading defined later for Activity Summary modal
  // Telegram integration removed
  const [qlooMateExecuting, setQlooMateExecuting] = useState(false);
  const [qlooMateBeatActive, setQlooMateBeatActive] = useState(false);
  const [qlooMateBeatStarting, setQlooMateBeatStarting] = useState(false);
  const [qlooMateBeatStopping, setQlooMateBeatStopping] = useState(false);
  const [showQlooMateSuccess, setShowQlooMateSuccess] = useState(false);
  const [refreshMessages, setRefreshMessages] = useState(false);
  const [authRetrying, setAuthRetrying] = useState(false);
  // Teams UI state
  const [joinTeamId, setJoinTeamId] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinMessage, setJoinMessage] = useState('');
  const [joinError, setJoinError] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState('');
  const [createError, setCreateError] = useState('');
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState('');
  const [teamMembers, setTeamMembers] = useState([]);
  const [teamOwner, setTeamOwner] = useState(null);
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [prefsError, setPrefsError] = useState('');
  const [teamPrefs, setTeamPrefs] = useState(null);
  const [teamsListReloadFlag, setTeamsListReloadFlag] = useState(0);
  const [isEditTeamOpen, setIsEditTeamOpen] = useState(false);
  const [editTeamName, setEditTeamName] = useState('');
  const [editingTeam, setEditingTeam] = useState(false);
  const [editTeamError, setEditTeamError] = useState('');
  const [isDeleteTeamOpen, setIsDeleteTeamOpen] = useState(false);
  const [deletingTeam, setDeletingTeam] = useState(false);
  const [deleteTeamError, setDeleteTeamError] = useState('');
  // Activities / Mini Audiobooks
  const [showActivitiesChooser, setShowActivitiesChooser] = useState(false);
  const [isMiniAudioOpen, setIsMiniAudioOpen] = useState(false);
  const [miniPrompt, setMiniPrompt] = useState('');
  const [miniDurationMinutes, setMiniDurationMinutes] = useState(1);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [generationError, setGenerationError] = useState('');
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState('');
  const [generatedText, setGeneratedText] = useState('');
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState('');
  // Summary activity
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [summaryUrl, setSummaryUrl] = useState('');
  const [summaryGenerating, setSummaryGenerating] = useState(false);
  const [summaryError, setSummaryError] = useState('');
  const [summaryText, setSummaryText] = useState('');
  const [summarySharing, setSummarySharing] = useState(false);
  const [isSummaryNameOpen, setIsSummaryNameOpen] = useState(false);
  const [summaryName, setSummaryName] = useState('');
  // Poll activity
  const [isPollOpen, setIsPollOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollError, setPollError] = useState('');
  const [pollSaving, setPollSaving] = useState(false);
  const [activities, setActivities] = useState([]);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [viewingActivity, setViewingActivity] = useState(null);
  const [deletingActivity, setDeletingActivity] = useState(false);
  const [deleteActivityError, setDeleteActivityError] = useState('');
  const [activityComments, setActivityComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [addingComment, setAddingComment] = useState(false);
  const [commentsError, setCommentsError] = useState('');
  // Activities column tabs: all | chat | my | outbox
  const [activeActivitiesTab, setActiveActivitiesTab] = useState('all');
  // Team chat space (stored in team preferences)
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [chatError, setChatError] = useState('');
  const [chatRefreshing, setChatRefreshing] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [teamMessages, setTeamMessages] = useState([]);
  // Outbox state
  const [outboxSubject, setOutboxSubject] = useState('');
  const [outboxBody, setOutboxBody] = useState('');
  const [outboxMode, setOutboxMode] = useState('all'); // 'all' | 'select'
  const [outboxSearch, setOutboxSearch] = useState('');
  const [outboxSelected, setOutboxSelected] = useState({}); // userId -> true
  const [outboxSending, setOutboxSending] = useState(false);
  const [outboxError, setOutboxError] = useState('');
  const outboxTemplates = [
    { title: 'Weekly Update', subject: 'Weekly Team Update', body: 'Hi team,\n\nHere are the updates for this week:\n- Item 1\n- Item 2\n\nBest,\n{{your_name}}' },
    { title: 'Meeting Reminder', subject: 'Reminder: Team Meeting', body: 'Hello,\n\nThis is a reminder for our team meeting on {{date}} at {{time}}. Agenda:\n- Topic A\n- Topic B\n\nSee you there!' },
    { title: 'Announcement', subject: 'Important Announcement', body: 'Hi everyone,\n\nWe have an important announcement:\n\n{{announcement_text}}\n\nThanks.' },
  ];
  const [isOutboxConfirmOpen, setIsOutboxConfirmOpen] = useState(false);
  const [outboxPendingRecipients, setOutboxPendingRecipients] = useState([]);
  const [outboxSavingRecord, setOutboxSavingRecord] = useState(false);
  const [activeOutboxTab, setActiveOutboxTab] = useState('compose'); // 'compose' | 'history'
  const [outboxHistory, setOutboxHistory] = useState([]);
  const [outboxHistoryLoading, setOutboxHistoryLoading] = useState(false);
  const [outboxHistoryError, setOutboxHistoryError] = useState('');
  const [outboxSuccessOpen, setOutboxSuccessOpen] = useState(false);
  const [outboxSuccessText, setOutboxSuccessText] = useState('');
  const [commentsCollapsed, setCommentsCollapsed] = useState(false);
  const [liking, setLiking] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editText, setEditText] = useState('');
  const [savingComment, setSavingComment] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState(null);
  // Announcement activity state
  const [isAnnouncementOpen, setIsAnnouncementOpen] = useState(false);
  const [announcementText, setAnnouncementText] = useState('');
  const [announcementImage, setAnnouncementImage] = useState(null);
  const [announcementError, setAnnouncementError] = useState('');
  const [announcementSaving, setAnnouncementSaving] = useState(false);

  // Helpers to handle comments stored as strings in DB
  const parseDocComments = (raw) => {
    if (!Array.isArray(raw)) return [];
    return raw.map((item) => {
      if (typeof item === 'string') {
        try { return JSON.parse(item); } catch { return { text: item, at: '', by: {} }; }
      }
      return item || {};
    }).filter(Boolean);
  };

  const base64ToObjectUrl = (base64, mime = 'audio/mpeg') => {
    try {
      const byteChars = atob(base64);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i += 1) {
        byteNumbers[i] = byteChars.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mime });
      return URL.createObjectURL(blob);
    } catch (err) {
      console.error('Failed to convert base64 to object URL', err);
      return '';
    }
  };

  const generateJoinCode = () => {
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 6; i += 1) {
      result += characters[Math.floor(Math.random() * characters.length)];
    }
    return result;
  };
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [preferencesSaved, setPreferencesSaved] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [matePreferences, setMatePreferences] = useState({
    bookRecommendations: { enabled: false, tag: 'book' },
    newPlacesToTravel: { enabled: false, tag: 'travel' },
    recipes: { enabled: false, tag: 'recipe' },
    localEvents: { enabled: false, tag: 'movie' },
    weatherAlerts: { enabled: false, tag: 'weather' },
    culturalInsights: { enabled: false, tag: 'culture' },
    budgetTips: { enabled: false, tag: 'budget' },
    foodieChallenges: { enabled: false, tag: 'challenge' },
    seasonalRecommendations: { enabled: false, tag: 'seasonal' },
    groupDiningSuggestions: { enabled: false, tag: 'dining' }
  });
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const checkUser = async (retryCount = 0) => {
      try {
        const currentUser = await getUser();
        if (currentUser) {
          setUser(currentUser);
          
          // User preferences (Gmail/Telegram) removed
        } else {
          console.log('No user found, redirecting to login');
          router.push('/');
        }
      } catch (error) {
        console.error('Error checking user authentication:', error);
        // Retry on network errors up to 3 times
        if (error.message && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError'))) {
          if (retryCount < 3) {
            console.log(`Network error, retrying authentication (attempt ${retryCount + 1}/3)`);
            setAuthRetrying(true);
            setTimeout(() => checkUser(retryCount + 1), 2000); // Retry after 2 seconds
            return;
          } else {
            console.log('Max retries reached, redirecting to login');
            setAuthRetrying(false);
            router.push('/');
          }
        } else {
          console.log('User not authenticated, redirecting to login');
          setAuthRetrying(false);
          router.push('/');
        }
      } finally {
        if (retryCount === 0) {
          setLoading(false);
          setAuthRetrying(false);
        }
      }
    };
    checkUser();
  }, [router]);

  const handleSignOut = async () => {
    try {
      await logoutUser();
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Gmail-related and legacy handlers removed

  // Telegram chat save handler removed

  const handleExecuteQlooMate = async () => {
    try {
      setQlooMateExecuting(true);
      
      // Call the Appwrite function with a simple payload to avoid timeout
      const result = await functions.createExecution('68846bdd0004eae6d86c', JSON.stringify({
        path: '/execute',
        simple: true
      }));
      
      console.log('QlooMate function executed successfully:', result);
      
      // Show success message
      setEmailsError(null);
      
      // Show success popup for 3 seconds
      setShowQlooMateSuccess(true);
      setTimeout(() => {
        setShowQlooMateSuccess(false);
      }, 3000);
      
      // Trigger message refresh after a short delay
      setTimeout(() => {
        setRefreshMessages(prev => !prev);
      }, 2000);
      
    } catch (error) {
      console.error('Error executing QlooMate function:', error);
      setEmailsError('Failed to execute QlooMate function. Please try again.');
    } finally {
      setQlooMateExecuting(false);
    }
  };


  const handleStartQlooMateBeat = async () => {
    // Functionality temporarily disabled
    console.log('QlooMate Beat start functionality is currently disabled');
  };

  const handleStopQlooMateBeat = async () => {
    // Functionality temporarily disabled
    console.log('QlooMate Beat stop functionality is currently disabled');
  };

  // Fetch memberships when a team is selected
  useEffect(() => {
    const fetchMemberships = async () => {
      if (!selectedTeam) return;
      try {
        setMembersLoading(true);
        setMembersError('');
        setTeamMembers([]);
        setTeamOwner(null);
        if (!validateClient()) {
          throw new Error('Configuration missing');
        }
        const teamsSdk = new Teams(client);
        const res = await teamsSdk.listMemberships(selectedTeam.$id);
        const memberships = res?.memberships || [];
        setTeamMembers(memberships);
        const ownerMembership = memberships.find((m) => Array.isArray(m.roles) && m.roles.includes('owner')) || null;
        setTeamOwner(ownerMembership);
      } catch (e) {
        setMembersError(e?.message || 'Failed to load team members');
      } finally {
        setMembersLoading(false);
      }
    };
    fetchMemberships();
  }, [selectedTeam]);

  // Initialize comments list whenever opening an activity
  useEffect(() => {
    if (isActivityOpen && viewingActivity) {
      const list = Array.isArray(viewingActivity.comments) ? viewingActivity.comments : [];
      setActivityComments(list);
      setEditingCommentId(null);
      setEditingIndex(null);
      setEditText('');
    }
  }, [isActivityOpen, viewingActivity]);

  // Reset activity UI when team changes or is cleared
  useEffect(() => {
    setShowActivitiesChooser(false);
    setIsMiniAudioOpen(false);
    setMiniPrompt('');
    setMiniDurationMinutes(2);
    setGenerationError('');
    setGeneratedAudioUrl('');
    setGeneratedText('');
  }, [selectedTeam]);

  // Fetch team preferences (e.g., joinCode) when a team is selected
  useEffect(() => {
    const fetchPrefs = async () => {
      if (!selectedTeam) return;
      try {
        setPrefsLoading(true);
        setPrefsError('');
        setTeamPrefs(null);
        setActivities([]);
        setTeamMessages([]);
        if (!validateClient()) {
          throw new Error('Configuration missing');
        }
        const teamsSdk = new Teams(client);
        if (typeof teamsSdk.getPrefs === 'function') {
          const prefs = await teamsSdk.getPrefs(selectedTeam.$id);
          setTeamPrefs(prefs || {});
          const list = Array.isArray(prefs?.activities) ? prefs.activities : [];
          setActivities(list);
        } else {
          // Fallback: some SDK versions include prefs in get()
          const t = await teamsSdk.get(selectedTeam.$id);
          setTeamPrefs(t?.prefs || {});
          const list = Array.isArray(t?.prefs?.activities) ? t.prefs.activities : [];
          setActivities(list);
        }

        // Fetch from database for authoritative list
        const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DB_ID;
        const collectionId = process.env.NEXT_PUBLIC_APPWRITE_ACTIVITIES_COLL_ID;
        const messagesCollId = process.env.NEXT_PUBLIC_APPWRITE_MESSAGES_COLL_ID;
        if (databaseId && collectionId) {
          try {
            const res = await databases.listDocuments(databaseId, collectionId, [
              Query.equal('teamId', selectedTeam.$id),
              Query.orderDesc('$createdAt'),
              Query.limit(50),
            ]);
            const docs = res?.documents || [];
            const mapped = docs.map((d) => ({
              id: d.$id,
              name: d.name,
              url: d.fileUrl,
              transcript: d.transcript,
              type: d.type,
              links: d.links,
              teamId: d.teamId,
              createdBy: { id: d.createdById, name: d.createdByName, email: d.createdByEmail },
              createdAt: d.$createdAt,
              comments: parseDocComments(d.comments),
              likes: Array.isArray(d.likes) ? d.likes : [],
              pollOptions: Array.isArray(d.pollOptions)
                ? d.pollOptions.map((item) => {
                    if (typeof item === 'string') {
                      try { return JSON.parse(item); } catch { return null; }
                    }
                    return item;
                  }).filter(Boolean)
                : undefined,
            }));
            setActivities(mapped);
          } catch (dbErr) {
            console.warn('Failed to list activities from DB:', dbErr);
          }
        }
        // Fetch team chat messages from messages collection
        if (databaseId && messagesCollId) {
          try {
            const mres = await databases.listDocuments(databaseId, messagesCollId, [
              Query.equal('teamId', selectedTeam.$id),
              Query.orderDesc('$createdAt'),
              Query.limit(200),
            ]);
            const mdocs = mres?.documents || [];
            const mmapped = mdocs.map((d) => ({
              id: d.$id,
              text: d.text,
              by: { id: d.byId, name: d.byName, email: d.byEmail },
              at: d.$createdAt,
            }));
            setTeamMessages(mmapped);
          } catch (mErr) {
            console.warn('Failed to list team messages:', mErr);
          }
        }
      } catch (e) {
        setPrefsError(e?.message || 'Failed to load team preferences');
      } finally {
        setPrefsLoading(false);
      }
    };
    fetchPrefs();
  }, [selectedTeam]);

  // Realtime subscription for team chat messages
  useEffect(() => {
    if (!selectedTeam) return;
    const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DB_ID;
    const messagesCollId = process.env.NEXT_PUBLIC_APPWRITE_MESSAGES_COLL_ID;
    if (!databaseId || !messagesCollId) return;

    const channel = `databases.${databaseId}.collections.${messagesCollId}.documents`;
    // Mark as connected on first subscription
    try { setRealtimeConnected(true); } catch {}
    const unsubscribe = client.subscribe(channel, (event) => {
      try {
        const doc = event?.payload;
        if (!doc || doc.teamId !== selectedTeam.$id) return;
        const isCreate = Array.isArray(event?.events) && event.events.some((e) => e.endsWith('.create'));
        const isUpdate = Array.isArray(event?.events) && event.events.some((e) => e.endsWith('.update'));
        const isDelete = Array.isArray(event?.events) && event.events.some((e) => e.endsWith('.delete'));
        const mapped = {
          id: doc.$id,
          text: doc.text,
          by: { id: doc.byId, name: doc.byName, email: doc.byEmail },
          at: doc.$createdAt,
        };
        setTeamMessages((prev) => {
          const list = Array.isArray(prev) ? prev : [];
          const existsIndex = list.findIndex((m) => m.id === mapped.id);
          if (isDelete) {
            return existsIndex >= 0 ? list.filter((m) => m.id !== mapped.id) : list;
          }
          if (existsIndex >= 0) {
            const updated = [...list];
            updated[existsIndex] = { ...list[existsIndex], ...mapped };
            return updated;
          }
          if (isCreate) {
            return [mapped, ...list];
          }
          return list;
        });
      } catch (_) {
        // ignore malformed events
      }
    });

    return () => {
      try { if (typeof unsubscribe === 'function') unsubscribe(); } catch { /* noop */ }
      // Mark as disconnected when unsubscribing (e.g., team change)
      try { setRealtimeConnected(false); } catch {}
    };
  }, [selectedTeam]);

  

  const loadMatePreferences = (userPrefs) => {
    if (userPrefs?.matePreferences) {
      try {
        const savedPreferences = JSON.parse(userPrefs.matePreferences);
        
        // Migrate old tag values to new ones
        const migratedPreferences = {
          ...savedPreferences,
          localEvents: {
            ...savedPreferences.localEvents,
            tag: savedPreferences.localEvents?.tag === 'event' ? 'movie' : (savedPreferences.localEvents?.tag || 'movie')
          },
          groupDiningSuggestions: {
            ...savedPreferences.groupDiningSuggestions,
            tag: savedPreferences.groupDiningSuggestions?.tag === 'group-dining' ? 'dining' : (savedPreferences.groupDiningSuggestions?.tag || 'dining')
          }
        };
        
        setMatePreferences(migratedPreferences);
        console.log('Loaded and migrated mate preferences from user data:', migratedPreferences);
      } catch (error) {
        console.error('Error parsing saved mate preferences:', error);
        // Keep default state if parsing fails
      }
    }
  };

  const handleTogglePreference = (preferenceKey) => {
    setMatePreferences(prev => ({
      ...prev,
      [preferenceKey]: {
        ...prev[preferenceKey],
        enabled: !prev[preferenceKey].enabled
      }
    }));
  };

  const handleSavePreferences = async () => {
    try {
      setSavingPreferences(true);
      setPreferencesSaved(false);
      setSaveError(null);
      
      // Extract enabled tags for taste preference
      const enabledTags = Object.entries(matePreferences)
        .filter(([key, value]) => value.enabled)
        .map(([key, value]) => value.tag);
      
      // Get current user preferences to preserve existing data
      const currentPrefs = userPreferences || {};
      
      // Validate that we have a user
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      // Use Appwrite account directly to update preferences
      const { account, validateClient } = await import('../../lib/appwrite');
      
      // Validate client configuration
      if (!validateClient()) {
        throw new Error('Appwrite client not properly configured');
      }
      
      // Check if account is properly initialized
      if (!account) {
        throw new Error('Account not initialized');
      }
      
      // Simple network connectivity check
      try {
        await fetch('https://nyc.cloud.appwrite.io/v1/health', { 
          method: 'HEAD',
          mode: 'no-cors'
        });
      } catch (networkError) {
        console.error('Network connectivity issue:', networkError);
        throw new Error('Network connectivity issue. Please check your internet connection.');
      }
      
      await account.updatePrefs({
        ...currentPrefs,
        matePreferences: JSON.stringify(matePreferences),
        taste: enabledTags // Add taste preference with enabled tags
      });
      
      console.log('Mate preferences saved successfully');
      console.log('Taste tags:', enabledTags);
      
      // Show success state for 3 seconds
      setPreferencesSaved(true);
      setTimeout(() => {
        setPreferencesSaved(false);
      }, 3000);
      
    } catch (error) {
      console.error('Error saving mate preferences:', error);
      
      // Show user-friendly error message
      let errorMessage = 'Failed to save preferences';
      if (error.message.includes('Network connectivity')) {
        errorMessage = 'Network error. Please check your internet connection.';
      } else if (error.message.includes('not authenticated')) {
        errorMessage = 'Please sign in again to save preferences.';
      } else if (error.message.includes('not properly configured')) {
        errorMessage = 'Configuration error. Please refresh the page.';
      }
      
      setSaveError(errorMessage);
      
      // Clear error after 5 seconds
      setTimeout(() => {
        setSaveError(null);
      }, 5000);
    } finally {
      setSavingPreferences(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-600 text-sm">
            {authRetrying ? 'Reconnecting to server...' : 'Loading...'}
          </p>
          {authRetrying && (
            <p className="text-gray-500 text-xs mt-2">Please check your internet connection</p>
          )}
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Minimal Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <img 
                src="/next.svg" 
                alt="Logo" 
                className="h-8 w-8 object-contain"
              />
              <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="h-6 w-6 bg-gray-200 rounded-full flex items-center justify-center">
                  <span className="text-gray-600 text-xs font-medium">
                    {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </span>
                </div>
                <span className="text-sm text-gray-700">{user.name}</span>
              </div>
              <button
                onClick={handleSignOut}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <div className="flex space-x-1 bg-white rounded-lg p-1 mb-8 shadow-sm">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'home'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('teams')}
            className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'teams'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            My Teams
          </button>
        </div>

        {/* Content */}
        {activeTab === 'home' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Join Team Card */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Join team with code</h3>
              <p className="text-sm text-gray-600 mb-4">Enter a team join code.</p>
              {joinError && <div className="mb-3 p-2 text-sm bg-red-50 border border-red-200 rounded text-red-700">{joinError}</div>}
              {joinMessage && <div className="mb-3 p-2 text-sm bg-green-50 border border-green-200 rounded text-green-700">{joinMessage}</div>}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinTeamId}
                  onChange={(e) => setJoinTeamId(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="join code"
                />
                    <button
                  onClick={async () => {
                    setJoinError(''); setJoinMessage('');
                    if (!validateClient()) { setJoinError('Configuration missing'); return; }
                    if (!joinTeamId.trim()) { setJoinError('Please enter a join code'); return; }
                    try {
                      setJoining(true);
                      // Execute server function to join by code
                      const payload = { joinCode: joinTeamId.trim(), path: '/join-by-code' };
                      const functionId = process.env.NEXT_PUBLIC_APPWRITE_JOIN_TEAM_FUNCTION_ID || 'JOIN_TEAM_FUNCTION_ID';
                      const exec = await functions.createExecution(functionId, JSON.stringify(payload));
                      console.log('Join by code execution:', exec);

                      // Appwrite SDK v14+ returns response fields as responseBody/responseStatusCode
                      const rawBody = exec?.responseBody ?? exec?.response ?? '';
                      const statusCode = exec?.responseStatusCode ?? exec?.statusCode ?? 0;
                      let resp = {};
                      try { resp = rawBody ? JSON.parse(rawBody) : {}; } catch (e) { resp = {}; }

                      if (resp && resp.success) {
                        setJoinMessage(`Joined team ${resp.teamName || resp.teamId}`);
                        setJoinTeamId('');
                        return;
                      }

                      // Treat 200 (or idempotent 409 already member) as success
                      if (statusCode === 200 || statusCode === 0 || statusCode === 409) {
                        if (statusCode === 409 && !(resp?.error || '').toLowerCase().includes('already')) {
                          // 409 but not already-member -> real error path
                        } else {
                          setJoinMessage('Joined team successfully');
                          setJoinTeamId('');
                          return;
                        }
                      }

                      throw new Error(resp?.error || exec?.errors || 'Failed to join team');
                      setJoinTeamId('');
                    } catch (e) {
                      setJoinError(e?.message || 'Failed to join team');
                    } finally {
                      setJoining(false);
                    }
                  }}
                  disabled={joining}
                  className={`px-4 py-2 rounded-lg font-medium ${joining ? 'bg-gray-300 text-gray-600' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                >
                  {joining ? 'Joining...' : 'Join'}
                    </button>
              </div>
              <p className="mt-2 text-xs text-gray-500">Use the code shared by a team owner.</p>
            </div>

            {/* Create Team Card */}
              <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Create a Team</h3>
              <p className="text-sm text-gray-600 mb-4">Create a new team in Appwrite.</p>
              {createError && <div className="mb-3 p-2 text-sm bg-red-50 border border-red-200 rounded text-red-700">{createError}</div>}
              {createMessage && <div className="mb-3 p-2 text-sm bg-green-50 border border-green-200 rounded text-green-700">{createMessage}</div>}
                  <button
                onClick={() => setIsCreateOpen(true)}
                className="px-4 py-2 rounded-lg font-medium bg-green-600 text-white hover:bg-green-700"
                  >
                Create a Team
                  </button>

              {/* Create Team Modal */}
              {isCreateOpen && (
                <div className="fixed inset-0 z-50">
                  <div className="fixed inset-0 bg-black/30" onClick={() => !creating && setIsCreateOpen(false)}></div>
                  <div className="flex items-center justify-center min-h-screen p-4">
                    <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">Name your team</h4>
                      <input
                        type="text"
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., Teachers"
                        disabled={creating}
                      />
                      <div className="mt-4 flex justify-end gap-2">
                <button 
                          onClick={() => setIsCreateOpen(false)}
                          disabled={creating}
                          className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                          Cancel
                </button>
                  <button
                          onClick={async () => {
                            setCreateError(''); setCreateMessage('');
                            if (!validateClient()) { setCreateError('Configuration missing'); return; }
                            if (!teamName.trim()) { setCreateError('Please enter a team name'); return; }
                            try {
                              setCreating(true);
                              const teams = new Teams(client);
                              const res = await teams.create(ID.unique(), teamName.trim());
                              // After team creation, set initial preferences with a joinCode
                              const joinCode = generateJoinCode();
                              try {
                                if (typeof teams.updatePrefs === 'function') {
                                  await teams.updatePrefs(res.$id, { joinCode });
                                } else {
                                  // Fallback for SDKs exposing updatePreferences
                                  if (typeof teams.updatePreferences === 'function') {
                                    await teams.updatePreferences(res.$id, { joinCode });
                                  }
                                }
                              } catch (prefErr) {
                                console.warn('Failed to set team preferences (joinCode):', prefErr);
                              }
                              setCreateMessage(`Team created: ${res?.name}`);
                              setTeamName('');
                              setIsCreateOpen(false);
                            } catch (e) {
                              setCreateError(e?.message || 'Failed to create team');
                            } finally {
                              setCreating(false);
                            }
                          }}
                          disabled={creating}
                          className={`px-4 py-2 rounded-lg font-medium ${creating ? 'bg-gray-300 text-gray-600' : 'bg-green-600 text-white hover:bg-green-700'}`}
                        >
                          {creating ? 'Creating...' : 'Create'}
                  </button>
                  </div>
                  </div>
                </div>
              </div>
              )}
                  </div>
                  </div>
        )}

        {activeTab === 'teams' && (
          <div className="grid grid-cols-1 lg:[grid-template-columns:1fr_2fr] gap-6">
            {/* Column 1: Teams List */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-indigo-600">
                  <path fillRule="evenodd" d="M8.25 6.75a3 3 0 10-6 0 3 3 0 006 0zm10.5 0a3 3 0 11-6 0 3 3 0 016 0zM6 9.75a4.5 4.5 0 00-4.5 4.5v.75a.75.75 0 00.75.75h7.5a.75.75 0 00.75-.75v-.75a4.5 4.5 0 00-4.5-4.5zm9 4.5a4.5 4.5 0 018.25 2.25v.75a.75.75 0 01-.75.75h-7.5a.75.75 0 01-.75-.75v-.75c0-.796.207-1.545.57-2.25z" clipRule="evenodd" />
                    </svg>
                <h3 className="text-lg font-medium text-gray-900">Your Teams</h3>
                  </div>
              <TeamsList onSelect={setSelectedTeam} selectedTeamId={selectedTeam?.$id} reloadFlag={teamsListReloadFlag} currentUser={user} />
                  </div>

            {/* Removed Column 2: Team Details */}

            {selectedTeam && (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                {/* Activities Chooser Modal */}
                {showActivitiesChooser && (
                  <div className="fixed inset-0 z-50">
                    <div
                      className="fixed inset-0 bg-black/40 backdrop-blur-[2px]"
                      onClick={() => setShowActivitiesChooser(false)}
                    ></div>
                    <div className="flex items-center justify-center min-h-screen p-4">
                      <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="add-activity-title"
                        className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 p-6"
                      >
                        <button
                          aria-label="Close"
                          onClick={() => setShowActivitiesChooser(false)}
                          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                            <path fillRule="evenodd" d="M10 8.586l4.95-4.95a1 1 0 111.414 1.415L11.414 10l4.95 4.95a1 1 0 01-1.415 1.414L10 11.414l-4.95 4.95a1 1 0 01-1.414-1.415L8.586 10l-4.95-4.95A1 1 0 115.05 3.636L10 8.586z" clipRule="evenodd" />
                          </svg>
                        </button>

                        <div className="flex items-start gap-3 mb-5">
                          <div className="shrink-0 h-10 w-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                              <path d="M12 3a9 9 0 100 18 9 9 0 000-18zM9.75 8.25a.75.75 0 011.06 0L12 9.44l1.19-1.19a.75.75 0 111.06 1.06L13.06 10.5l1.19 1.19a.75.75 0 11-1.06 1.06L12 11.56l-1.19 1.19a.75.75 0 11-1.06-1.06L10.94 10.5 9.75 9.31a.75.75 0 010-1.06z" />
                            </svg>
                          </div>
                          <div>
                            <h4 id="add-activity-title" className="text-base font-semibold text-gray-900">Add Activity</h4>
                            <p className="mt-0.5 text-sm text-gray-500">Choose what you would like to create for your team.</p>
                          </div>
                        </div>

                        <div className="grid gap-2">
                          <button
                            className="group w-full rounded-lg border border-gray-200 p-3 text-left transition hover:bg-gray-50 hover:border-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                            onClick={() => { setIsMiniAudioOpen(true); setShowActivitiesChooser(false); }}
                          >
                            <div className="flex items-start gap-3">
                              <div className="h-9 w-9 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                                  <path d="M4.5 5.25A2.25 2.25 0 016.75 3h10.5A2.25 2.25 0 0119.5 5.25v13.5A2.25 2.25 0 0117.25 21H6.75A2.25 2.25 0 014.5 18.75V5.25zM8.25 6a.75.75 0 000 1.5h7.5A.75.75 0 0016.5 6h-8.25zm0 3a.75.75 0 000 1.5h7.5a.75.75 0 000-1.5h-7.5zM8.25 12a.75.75 0 000 1.5h3a.75.75 0 000-1.5h-3z" />
                                </svg>
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900">Mini Audiobooks</p>
                                <p className="text-xs text-gray-500">Turn articles into short audio stories.</p>
                              </div>
                              <span className="ml-auto text-gray-300 transition group-hover:text-gray-400">→</span>
                            </div>
                          </button>

                          <button
                            className="group w-full rounded-lg border border-gray-200 p-3 text-left transition hover:bg-gray-50 hover:border-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                            onClick={() => { setIsSummaryOpen(true); setShowActivitiesChooser(false); }}
                          >
                            <div className="flex items-start gap-3">
                              <div className="h-9 w-9 rounded-md bg-sky-50 text-sky-600 flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                                  <path d="M4.5 6.75A2.25 2.25 0 016.75 4.5h10.5A2.25 2.25 0 0119.5 6.75v10.5A2.25 2.25 0 0117.25 19.5H6.75A2.25 2.25 0 014.5 17.25V6.75zm3 1.5a.75.75 0 000 1.5h9a.75.75 0 000-1.5h-9zm0 3a.75.75 0 000 1.5h9a.75.75 0 000-1.5h-9zm0 3a.75.75 0 000 1.5h6a.75.75 0 000-1.5h-6z" />
                                </svg>
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900">Summary</p>
                                <p className="text-xs text-gray-500">Summarize long text into key takeaways.</p>
                              </div>
                              <span className="ml-auto text-gray-300 transition group-hover:text-gray-400">→</span>
                            </div>
                          </button>

                          <button
                            className="group w-full rounded-lg border border-gray-200 p-3 text-left transition hover:bg-gray-50 hover:border-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                            onClick={() => { setIsPollOpen(true); setShowActivitiesChooser(false); }}
                          >
                            <div className="flex items-start gap-3">
                              <div className="h-9 w-9 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                                  <path d="M4.5 5.25a.75.75 0 01.75-.75h3a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75h-3a.75.75 0 01-.75-.75V5.25zm6 3a.75.75 0 01.75-.75h3a.75.75 0 01.75.75v10.5a.75.75 0 01-.75.75h-3a.75.75 0 01-.75-.75V8.25zm6 4.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75v6a.75.75 0 01-.75.75h-3a.75.75 0 01-.75-.75v-6z" />
                                </svg>
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900">Poll</p>
                                <p className="text-xs text-gray-500">Ask a question and collect votes.</p>
                              </div>
                              <span className="ml-auto text-gray-300 transition group-hover:text-gray-400">→</span>
                            </div>
                          </button>

                          <button
                            className="group w-full rounded-lg border border-gray-200 p-3 text-left transition hover:bg-gray-50 hover:border-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                            onClick={() => { setIsAnnouncementOpen(true); setShowActivitiesChooser(false); }}
                          >
                            <div className="flex items-start gap-3">
                              <div className="h-9 w-9 rounded-md bg-fuchsia-50 text-fuchsia-600 flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                                  <path d="M3 8.25a.75.75 0 01.75-.75h.75V6A2.25 2.25 0 017.5 3.75h.75a.75.75 0 010 1.5H7.5A.75.75 0 006.75 6v1.5h6.75a3.75 3.75 0 013.75 3.75v3a3.75 3.75 0 01-3.75 3.75H6.75V18A.75.75 0 017.5 18.75h.75a.75.75 0 010 1.5H7.5A2.25 2.25 0 015.25 18v-1.5h-.75A.75.75 0 013.75 15.75v-6z" />
                                </svg>
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900">Announcement</p>
                                <p className="text-xs text-gray-500">Post an announcement with optional image.</p>
                              </div>
                              <span className="ml-auto text-gray-300 transition group-hover:text-gray-400">→</span>
                            </div>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {/* Tabs */}
                {(() => {
                  const isOwner = (!!selectedTeam?.isOwner) || (Array.isArray(teamMembers) && teamMembers.some((m) => m?.userId === user?.$id && Array.isArray(m?.roles) && m.roles.includes('owner')));
                  const baseTabs = [
                    { key: 'all', label: 'All Activities' },
                    { key: 'chat', label: 'Chat Space' },
                    { key: 'mine', label: 'My Activities' },
                    { key: 'members', label: 'Members' },
                  ];
                  const tabs = isOwner ? [...baseTabs, { key: 'outbox', label: 'Outbox' }] : baseTabs;
                  return (
                    <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-1 flex gap-1">
                      {tabs.map((tab) => (
                        <button
                          key={tab.key}
                          onClick={() => setActiveActivitiesTab(tab.key)}
                          className={`flex-1 py-1.5 text-sm rounded-md ${activeActivitiesTab === tab.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  );
                })()}
                {/* Content per tab */}
                {activeActivitiesTab === 'chat' ? (
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        Team Chat
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${realtimeConnected ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                          {realtimeConnected ? 'realtime' : 'offline'}
                        </span>
                      </h4>
                      <button
                        className={`px-2 py-1 rounded text-xs border ${chatRefreshing ? 'bg-gray-200 text-gray-600 cursor-not-allowed' : 'bg-white hover:bg-gray-50 text-gray-700'} border-gray-300`}
                        disabled={chatRefreshing}
                        onClick={async () => {
                          try {
                            setChatError('');
                            setChatRefreshing(true);
                            if (!validateClient()) throw new Error('Configuration missing');
                            const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DB_ID;
                            const messagesCollId = process.env.NEXT_PUBLIC_APPWRITE_MESSAGES_COLL_ID;
                            if (!databaseId || !messagesCollId || !selectedTeam) throw new Error('Messages configuration missing');
                            const mres = await databases.listDocuments(databaseId, messagesCollId, [
                              Query.equal('teamId', selectedTeam.$id),
                              Query.orderDesc('$createdAt'),
                              Query.limit(200),
                            ]);
                            const mdocs = mres?.documents || [];
                            const mmapped = mdocs.map((d) => ({ id: d.$id, text: d.text, by: { id: d.byId, name: d.byName, email: d.byEmail }, at: d.$createdAt }));
                            setTeamMessages(mmapped);
                          } catch (err) {
                            setChatError(err?.message || 'Failed to refresh messages');
                          } finally {
                            setChatRefreshing(false);
                          }
                        }}
                      >{chatRefreshing ? 'Refreshing…' : 'Refresh'}</button>
                    </div>
                    {chatError && <div className="mb-2 p-2 text-xs bg-red-50 border border-red-200 rounded text-red-700">{chatError}</div>}
                    <div className="mb-3 flex items-start gap-2">
                      <textarea
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        rows={2}
                        placeholder="Write a message for your team..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={sendingChat}
                      />
                    <button
                        onClick={async () => {
                          try {
                            setChatError('');
                            if (!chatInput.trim()) return;
                            if (!validateClient()) throw new Error('Configuration missing');
                            setSendingChat(true);
                            const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DB_ID;
                            const messagesCollId = process.env.NEXT_PUBLIC_APPWRITE_MESSAGES_COLL_ID;
                            if (!databaseId || !messagesCollId) throw new Error('Messages configuration missing');
                            const msg = {
                              teamId: selectedTeam.$id,
                              text: chatInput.trim(),
                              byId: user.$id,
                              byName: user.name,
                              byEmail: user.email,
                            };
                            const permissions = [
                              Permission.read(Role.team(selectedTeam.$id)),
                              Permission.write(Role.team(selectedTeam.$id)),
                              Permission.update(Role.team(selectedTeam.$id)),
                              Permission.delete(Role.team(selectedTeam.$id)),
                            ];
                            const created = await databases.createDocument(databaseId, messagesCollId, AppwriteID.unique(), msg, permissions);
                            const local = { id: created.$id, text: msg.text, by: { id: msg.byId, name: msg.byName, email: msg.byEmail }, at: created.$createdAt };
                            setTeamMessages((prev) => [local, ...(prev || [])]);
                            setChatInput('');
                          } catch (err) {
                            setChatError(err?.message || 'Failed to send');
                          } finally {
                            setSendingChat(false);
                          }
                        }}
                        disabled={sendingChat || !chatInput.trim()}
                        className={`px-3 py-2 rounded-lg text-sm font-medium ${ (sendingChat || !chatInput.trim()) ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                      >
                        {sendingChat ? 'Sending...' : 'Send'}
                      </button>
                    </div>
                    <ul className="space-y-2 max-h-64 overflow-auto pr-1">
                      {(Array.isArray(teamMessages) ? teamMessages : []).map((m) => {
                        const isMine = m?.by?.id && user?.$id && m.by.id === user.$id;
                        return (
                          <li
                            key={m.id}
                            className={`rounded-md p-2 border ${isMine ? 'bg-blue-50 border-blue-200' : 'border-gray-200'}`}
                          >
                            <p className="text-xs text-gray-500 mb-1">{m.by?.name || m.by?.email || 'User'} • {m.at ? new Date(m.at).toLocaleString() : ''}</p>
                            <p className="text-sm text-gray-800 whitespace-pre-wrap">{m.text}</p>
                          </li>
                        );
                      })}
                    </ul>
                        </div>
                ) : activeActivitiesTab === 'outbox' ? (
                  ((!!selectedTeam?.isOwner) || (Array.isArray(teamMembers) && teamMembers.some((m) => m?.userId === user?.$id && Array.isArray(m?.roles) && m.roles.includes('owner')))) ? (
                  <div>
                    <div className="mb-3 bg-gray-50 border border-gray-200 rounded-lg p-1 flex gap-1">
                      {['compose','history'].map((k) => (
                        <button key={k} onClick={async () => {
                          setActiveOutboxTab(k);
                          if (k === 'history') {
                            try {
                              setOutboxHistoryError('');
                              setOutboxHistoryLoading(true);
                              const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DB_ID;
                              const outboxCollId = process.env.NEXT_PUBLIC_APPWRITE_OUTBOX_COLL_ID;
                              if (databaseId && outboxCollId && selectedTeam) {
                                const res = await databases.listDocuments(databaseId, outboxCollId, [
                                  Query.equal('teamId', selectedTeam.$id),
                                  Query.orderDesc('$createdAt'),
                                  Query.limit(100),
                                ]);
                                const docs = res?.documents || [];
                                setOutboxHistory(docs.map((d) => ({
                                  id: d.$id,
                                  subject: d.subject,
                                  body: d.body,
                                  recipients: Array.isArray(d.recipients) ? d.recipients : [],
                                  createdAt: d.$createdAt,
                                  createdBy: { id: d.createdById, name: d.createdByName, email: d.createdByEmail },
                                })));
                              } else {
                                setOutboxHistory([]);
                              }
                            } catch (e) {
                              setOutboxHistoryError(e?.message || 'Failed to load history');
                            } finally {
                              setOutboxHistoryLoading(false);
                            }
                          }
                        }} className={`flex-1 py-1.5 text-sm rounded-md ${activeOutboxTab===k ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}>{k === 'compose' ? 'Compose' : 'History'}</button>
                      ))}
                    </div>
                    {activeOutboxTab === 'compose' ? (
                      <>
                    {outboxError && <div className="mb-2 p-2 text-xs bg-red-50 border border-red-200 rounded text-red-700">{outboxError}</div>}
                    <div className="mb-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {outboxTemplates.map((t, i) => (
                        <button
                          key={i}
                          className="px-3 py-2 rounded border border-gray-300 text-sm hover:bg-gray-50 text-gray-700"
                          onClick={() => { setOutboxSubject(t.subject); setOutboxBody(t.body.replace('{{your_name}}', user?.name || '')); }}
                        >{t.title}</button>
                      ))}
                    </div>
                    <div className="mb-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Subject</label>
                      <input
                        type="text"
                        value={outboxSubject}
                        onChange={(e) => setOutboxSubject(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Subject"
                        disabled={outboxSending}
                      />
                    </div>
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Message</label>
                      <textarea
                        rows={6}
                        value={outboxBody}
                        onChange={(e) => setOutboxBody(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Write your message..."
                        disabled={outboxSending}
                      />
                    </div>
                    <div className="mb-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Recipients</label>
                      <div className="flex items-center gap-4 mb-2">
                        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                          <input type="radio" name="recip" checked={outboxMode==='all'} onChange={() => setOutboxMode('all')} /> All participants
                        </label>
                        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                          <input type="radio" name="recip" checked={outboxMode==='select'} onChange={() => setOutboxMode('select')} /> Select members
                        </label>
                      </div>
                      {outboxMode === 'select' && (
                        <div className="border border-gray-200 rounded p-2">
                          <input
                            type="text"
                            value={outboxSearch}
                            onChange={(e) => setOutboxSearch(e.target.value)}
                            placeholder="Search team members..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                          />
                          <ul className="max-h-40 overflow-auto space-y-1 pr-1">
                            {(teamMembers || [])
                              .filter((m) => !(Array.isArray(m.roles) && m.roles.includes('owner')) || true)
                              .filter((m) => {
                                const q = outboxSearch.trim().toLowerCase();
                                if (!q) return true;
                                const name = (m.userName || '').toLowerCase();
                                const email = (m.userEmail || '').toLowerCase();
                                return name.includes(q) || email.includes(q);
                              })
                              .map((m) => {
                                const derivedName = m.userName
                                  || (m.userId === user.$id ? (user.name || (user.email ? user.email.split('@')[0] : 'You'))
                                  : (m.userEmail ? m.userEmail.split('@')[0] : 'Unknown'));
                                const derivedEmail = m.userEmail || (m.userId === user.$id ? (user.email || 'No email') : 'No email');
                                return (
                                  <li key={m.$id} className="flex items-center justify-between border border-gray-200 rounded p-2">
                                    <div className="min-w-0">
                                      <p className="text-sm text-gray-900 truncate">{derivedName}</p>
                                      <p className="text-xs text-gray-500 truncate">{derivedEmail}</p>
                                    </div>
                                    <input type="checkbox" checked={!!outboxSelected[m.userId]} onChange={(e) => setOutboxSelected((prev) => ({ ...prev, [m.userId]: e.target.checked }))} />
                                  </li>
                                );
                              })}
                          </ul>
                        </div>
                      )}
                    </div>
                    <div className="flex justify-end">
                      <button
                        className={`px-4 py-2 rounded-lg font-medium ${ outboxSending ? 'bg-gray-300 text-gray-600' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                        disabled={outboxSending || !outboxSubject.trim() || !outboxBody.trim()}
                        onClick={async () => {
                          setOutboxError('');
                          if (!validateClient()) { setOutboxError('Configuration missing'); return; }
                          // Build recipients preview and open confirm modal
                          const getEmail = (m) => m.userEmail || (m.userId === user.$id ? (user.email || '') : '');
                          const ownerMem = (teamMembers || []).find((m) => Array.isArray(m.roles) && m.roles.includes('owner'));
                          const ownerEmail = ownerMem ? getEmail(ownerMem) : '';
                          let recipients = [];
                          if (outboxMode === 'all') {
                            recipients = (teamMembers || []).map((m) => getEmail(m)).filter(Boolean);
                          } else {
                            const selectedIds = Object.entries(outboxSelected).filter(([, v]) => !!v).map(([k]) => k);
                            recipients = selectedIds
                              .map((id) => {
                                const m = (teamMembers || []).find((mm) => mm.userId === id);
                                return m ? getEmail(m) : '';
                              })
                              .filter(Boolean);
                          }
                          if (ownerEmail) recipients.push(ownerEmail);
                          recipients = Array.from(new Set(recipients));
                          if (!recipients.length) { setOutboxError('No recipients'); return; }
                          setOutboxPendingRecipients(recipients);
                          setIsOutboxConfirmOpen(true);
                        }}
                      >
                        Send
                      </button>
                    </div>
                      </>
                    ) : (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Outbox History</h4>
                        {outboxHistoryError && <div className="mb-2 p-2 text-xs bg-red-50 border border-red-200 rounded text-red-700">{outboxHistoryError}</div>}
                        {outboxHistoryLoading ? (
                          <p className="text-xs text-gray-500">Loading...</p>
                        ) : !outboxHistory.length ? (
                          <p className="text-xs text-gray-500">No emails sent yet.</p>
                        ) : (
                          <ul className="space-y-2 max-h-64 overflow-auto pr-1">
                            {outboxHistory.map((m) => (
                              <li key={m.id} className="border border-gray-200 rounded p-2">
                                <div className="flex items-start justify-between">
                                  <div className="min-w-0">
                                    <p className="text-sm text-gray-900 truncate">{m.subject}</p>
                                    <p className="text-xs text-gray-500 truncate">To: {m.recipients.join(', ')}</p>
                                  </div>
                                  <span className="text-[10px] text-gray-500 shrink-0 ml-2">{m.createdAt ? new Date(m.createdAt).toLocaleString() : ''}</span>
                                </div>
                                {m.body && (
                                  <p className="mt-1 text-xs text-gray-700 line-clamp-3 whitespace-pre-wrap">{m.body}</p>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                  ) : (
                    <div className="p-3 rounded border border-amber-200 bg-amber-50 text-amber-800 text-sm">Only team owners can access the Outbox.</div>
                  )
                ) : activeActivitiesTab === 'members' ? (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Team Members</h4>
                    {membersError && <div className="mb-2 p-2 text-xs bg-red-50 border border-red-200 rounded text-red-700">{membersError}</div>}
                    {membersLoading ? (
                      <p className="text-xs text-gray-500">Loading members...</p>
                    ) : (
                      <div className="space-y-5">
                        {(() => {
                          const all = Array.isArray(teamMembers) ? teamMembers : [];
                          const owners = all.filter((m) => Array.isArray(m.roles) && m.roles.includes('owner'));
                          const members = all.filter((m) => !(Array.isArray(m.roles) && m.roles.includes('owner')));
                          return (
                            <>
                              <div>
                                <h5 className="text-xs font-semibold uppercase tracking-wide text-purple-700 mb-2">Owners</h5>
                                {!owners.length ? (
                                  <p className="text-xs text-gray-500">No owners found.</p>
                                ) : (
                                  <ul className="space-y-2">
                                    {owners.map((m) => (
                                      <li key={m.$id || `${m.userId}-owner`}
                                          className="p-3 rounded-lg border border-purple-200 bg-purple-50 flex items-center justify-between">
                                        <div>
                                          <p className="text-sm font-medium text-gray-900">{m.userName || m.userEmail || 'Owner'}</p>
                                          <p className="text-xs text-gray-600">{m.userEmail || ''}</p>
                                        </div>
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 border border-purple-200">Owner</span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                              <div>
                                <h5 className="text-xs font-semibold uppercase tracking-wide text-blue-700 mb-2">Members</h5>
                                {!members.length ? (
                                  <p className="text-xs text-gray-500">No members yet.</p>
                                ) : (
                                  <ul className="space-y-2">
                                    {members.map((m) => (
                                      <li key={m.$id || `${m.userId}-member`}
                                          className="p-3 rounded-lg border border-blue-200 bg-blue-50 flex items-center justify-between">
                                        <div>
                                          <p className="text-sm font-medium text-gray-900">{m.userName || m.userEmail || 'Member'}</p>
                                          <p className="text-xs text-gray-600">{m.userEmail || ''}</p>
                                        </div>
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">Member</span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-emerald-600">
                          <path d="M3 6.75A.75.75 0 013.75 6h8.5a.75.75 0 010 1.5h-8.5A.75.75 0 013 6.75zM3 12a.75.75 0 01.75-.75h12.5a.75.75 0 010 1.5H3.75A.75.75 0 013 12zm.75 4.5a.75.75 0 000 1.5h16.5a.75.75 0 000-1.5H3.75z" />
                          </svg>
                        <h3 className="text-lg font-medium text-gray-900">{activeActivitiesTab === 'mine' ? 'My Activities' : 'Activities'}</h3>
                        </div>
                      <button 
                        onClick={() => setShowActivitiesChooser((s) => !s)}
                        className="px-3 py-1.5 rounded-md text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700"
                      >
                        Add Activity
                    </button>
                  </div>
                    {activeActivitiesTab === 'mine' && <h4 className="text-sm font-medium text-gray-700 mb-2">My Activities</h4>}
                    {activeActivitiesTab === 'all' && <h4 className="text-sm font-medium text-gray-700 mb-2">All Activities</h4>}
                    {!activities?.length ? (
                      <p className="text-xs text-gray-500">No activities yet.</p>
                    ) : (
                      <div className="max-h-64 overflow-auto pr-1">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {[...activities]
                            .filter((a) => activeActivitiesTab === 'all' ? true : (a.createdBy?.id === user.$id))
                            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
                            .map((a) => (
                              <div
                                key={a.id}
                                onClick={() => { setViewingActivity(a); setIsActivityOpen(true); }}
                                className="border border-gray-200 rounded-md p-3 cursor-pointer hover:bg-gray-50"
                              >
                                <div className="flex items-start justify-between">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm font-medium text-gray-900 truncate">{a.name || (a.type === 'audiobook' ? 'Audiobook' : 'Activity')}</p>
                                      {(() => {
                                        const t = (a.type || 'audiobook').toLowerCase();
                                        const styles = t === 'audiobook'
                                          ? 'bg-amber-100 text-amber-800'
                                          : t === 'summary'
                                          ? 'bg-indigo-100 text-indigo-800'
                                          : t === 'poll'
                                          ? 'bg-fuchsia-100 text-fuchsia-800'
                                          : 'bg-gray-100 text-gray-800';
                                        return (
                                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${styles}`}>
                                            {t.toUpperCase()}
                                          </span>
                                        );
                                      })()}
                        </div>
                                    <p className="text-[11px] text-gray-500 truncate">By {a.createdBy?.name || a.createdBy?.email || 'Unknown'}</p>
                                  </div>
                                  <span className="text-[10px] text-gray-500 shrink-0 ml-2">{a.createdAt ? new Date(a.createdAt).toLocaleString() : ''}</span>
                                </div>
                                    {a.type !== 'poll' && a.type !== 'announcement' && a.transcript && (
                                  <p className="mt-2 text-xs text-gray-600 line-clamp-3">{a.transcript}</p>
                                )}
                                    {a.type === 'poll' && (
                                  <p className="mt-2 text-[11px] text-gray-500">Tap to view and vote</p>
                                )}
                                    {a.type === 'announcement' && (
                                      <div className="mt-2">
                                        {a.links && (
                                          <img src={a.links} alt="Announcement" className="w-full rounded-md border border-gray-200 mb-2" />
                                        )}
                                        {a.transcript && (
                                          <p className="text-xs text-gray-600 whitespace-pre-wrap">{a.transcript}</p>
                                        )}
                                      </div>
                                    )}
                      </div>
                            ))}
                    </div>
                    </div>
                  )}
                </div>
                  )}
                      </div>
                    )}
                      </div>
                    )}

                  </div>

      {/* Edit Team Modal */}
      {isEditTeamOpen && (
        <div className="fixed inset-0 z-50">
          <div className="fixed inset-0 bg-black/30" onClick={() => !editingTeam && setIsEditTeamOpen(false)}></div>
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Edit Team Name</h4>
              {editTeamError && (
                <div className="mb-3 p-2 text-sm bg-red-50 border border-red-200 rounded text-red-700">{editTeamError}</div>
              )}
              <input
                type="text"
                value={editTeamName}
                onChange={(e) => setEditTeamName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Team name"
                disabled={editingTeam}
              />
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setIsEditTeamOpen(false)} disabled={editingTeam} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Cancel</button>
                    <button
                  onClick={async () => {
                    setEditTeamError('');
                    if (!validateClient()) { setEditTeamError('Configuration missing'); return; }
                    if (!selectedTeam) { setEditTeamError('No team selected'); return; }
                    if (!editTeamName.trim()) { setEditTeamError('Please enter a team name'); return; }
                    try {
                      setEditingTeam(true);
                      const teamsSdk = new Teams(client);
                      const updated = await teamsSdk.updateName(selectedTeam.$id, editTeamName.trim());
                      setSelectedTeam({ ...selectedTeam, name: updated.name });
                      setIsEditTeamOpen(false);
                      setTeamsListReloadFlag((f) => f + 1);
                    } catch (e) {
                      setEditTeamError(e?.message || 'Failed to update team');
                    } finally {
                      setEditingTeam(false);
                    }
                  }}
                  disabled={editingTeam}
                  className={`px-4 py-2 rounded-lg font-medium ${editingTeam ? 'bg-gray-300 text-gray-600' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                >
                  {editingTeam ? 'Saving...' : 'Save'}
                  </button>
                        </div>
              </div>
            </div>
              </div>
      )}

      {/* Delete Team Modal */}
      {isDeleteTeamOpen && (
        <div className="fixed inset-0 z-50">
          <div className="fixed inset-0 bg-black/30" onClick={() => !deletingTeam && setIsDeleteTeamOpen(false)}></div>
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Delete Team</h4>
              <p className="text-sm text-gray-600 mb-4">Are you sure you want to delete this team? This action cannot be undone.</p>
              {deleteTeamError && (
                <div className="mb-3 p-2 text-sm bg-red-50 border border-red-200 rounded text-red-700">{deleteTeamError}</div>
              )}
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setIsDeleteTeamOpen(false)} disabled={deletingTeam} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Cancel</button>
                <button 
                  onClick={async () => {
                    setDeleteTeamError('');
                    if (!validateClient()) { setDeleteTeamError('Configuration missing'); return; }
                    if (!selectedTeam) { setDeleteTeamError('No team selected'); return; }
                    try {
                      setDeletingTeam(true);
                      const teamsSdk = new Teams(client);
                      await teamsSdk.delete(selectedTeam.$id);
                      setIsDeleteTeamOpen(false);
                      setSelectedTeam(null);
                      setTeamMembers([]);
                      setTeamOwner(null);
                      setTeamPrefs(null);
                      setTeamsListReloadFlag((f) => f + 1);
                    } catch (e) {
                      setDeleteTeamError(e?.message || 'Failed to delete team');
                    } finally {
                      setDeletingTeam(false);
                    }
                  }}
                  disabled={deletingTeam}
                  className={`px-4 py-2 rounded-lg font-medium ${deletingTeam ? 'bg-gray-300 text-gray-600' : 'bg-red-600 text-white hover:bg-red-700'}`}
                >
                  {deletingTeam ? 'Deleting...' : 'Delete'}
                    </button>
                    </div>
              </div>
            </div>
                  </div>
                )}

  {/* Announcement Modal (global overlay to avoid stacking issues) */}
  {isAnnouncementOpen && (
    <div className="fixed inset-0 z-[60]">
      <div className="fixed inset-0 bg-black/30" onClick={() => setIsAnnouncementOpen(false)}></div>
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
          <div className="flex items-start justify-between mb-3">
            <h4 className="text-lg font-semibold text-gray-900">New Announcement</h4>
            <button className="px-3 py-1 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50" onClick={() => setIsAnnouncementOpen(false)}>Close</button>
          </div>
          {announcementError && <div className="mb-2 p-2 text-xs bg-red-50 border border-red-200 rounded text-red-700">{announcementError}</div>}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Announcement Text</label>
              <textarea
                rows={4}
                value={announcementText}
                onChange={(e) => setAnnouncementText(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
                placeholder="Write your announcement..."
                disabled={announcementSaving}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Optional Image</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setAnnouncementImage(e.target.files?.[0] || null)}
                disabled={announcementSaving}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setIsAnnouncementOpen(false)} disabled={announcementSaving} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Cancel</button>
            <button
              onClick={async () => {
                try {
                  setAnnouncementError('');
                  if (!validateClient()) { setAnnouncementError('Configuration missing'); return; }
                  if (!selectedTeam) { setAnnouncementError('No team selected'); return; }
                  setAnnouncementSaving(true);
                  const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DB_ID;
                  const collectionId = process.env.NEXT_PUBLIC_APPWRITE_ACTIVITIES_COLL_ID;
                  if (!databaseId || !collectionId) throw new Error('DB configuration missing');
                  // Upload image if provided
                  let imageUrl = '';
                  let uploadedFileId = '';
                  if (announcementImage) {
                    const bucketId = process.env.NEXT_PUBLIC_APPWRITE_BUCKET_ID;
                    if (!bucketId) throw new Error('Storage bucket not configured');
                    const permissions = [
                      Permission.read(Role.team(selectedTeam.$id)),
                      Permission.write(Role.team(selectedTeam.$id)),
                      Permission.update(Role.team(selectedTeam.$id)),
                      Permission.delete(Role.team(selectedTeam.$id)),
                    ];
                    const uploaded = await storage.createFile(bucketId, AppwriteID.unique(), announcementImage, permissions);
                    const fileId = uploaded.$id;
                    uploadedFileId = fileId;
                    const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || '';
                    const project = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '';
                    imageUrl = `${endpoint.replace(/\/$/, '')}/storage/buckets/${bucketId}/files/${fileId}/view?project=${project}`;
                  }
                  const doc = await databases.createDocument(
                    databaseId,
                    collectionId,
                    AppwriteID.unique(),
                    {
                      teamId: selectedTeam.$id,
                      name: 'Announcement',
                      links: imageUrl,
                      fileId: uploadedFileId || undefined,
                      transcript: announcementText,
                      type: 'announcement',
                      createdById: user.$id,
                      createdByName: user.name,
                      createdByEmail: user.email,
                      likes: [],
                      comments: [],
                    },
                    [
                      Permission.read(Role.team(selectedTeam.$id)),
                      Permission.update(Role.team(selectedTeam.$id)),
                      Permission.delete(Role.team(selectedTeam.$id)),
                      Permission.write(Role.team(selectedTeam.$id)),
                    ]
                  );
                  const activity = {
                    id: doc.$id,
                    name: 'Announcement',
                    url: '',
                    transcript: announcementText,
                    links: imageUrl,
                    fileId: uploadedFileId || undefined,
                    type: 'announcement',
                    teamId: selectedTeam.$id,
                    createdBy: { id: user.$id, name: user.name, email: user.email },
                    createdAt: new Date().toISOString(),
                    comments: [],
                    likes: [],
                  };
                  setActivities((prev) => [activity, ...(prev || [])]);
                  setIsAnnouncementOpen(false);
                  setAnnouncementText('');
                  setAnnouncementImage(null);
                } catch (err) {
                  setAnnouncementError(err?.message || 'Failed to save');
                } finally {
                  setAnnouncementSaving(false);
                }
              }}
              disabled={announcementSaving || (!announcementText.trim() && !announcementImage)}
              className={`px-4 py-2 rounded-lg font-medium ${ (announcementSaving || (!announcementText.trim() && !announcementImage)) ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-fuchsia-600 text-white hover:bg-fuchsia-700'}`}
            >
              {announcementSaving ? 'Saving...' : 'Post'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )}

  {/* Mini Audiobooks Modal */}
  {isMiniAudioOpen && (
        <div className="fixed inset-0 z-50">
          <div className="fixed inset-0 bg-black/30" onClick={() => !generatingAudio && setIsMiniAudioOpen(false)}></div>
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="relative bg-white rounded-xl shadow-xl max-w-xl w-full p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Generate Mini Audiobook</h4>
              {generationError && (
                <div className="mb-3 p-2 text-sm bg-red-50 border border-red-200 rounded text-red-700">{generationError}</div>
              )}


              {shareError && (
                <div className="mb-3 p-2 text-sm bg-red-50 border border-red-200 rounded text-red-700">{shareError}</div>
              )}
                <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Prompt</label>
                  <textarea
                    value={miniPrompt}
                    onChange={(e) => setMiniPrompt(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Describe the audiobook content to generate..."
                    disabled={generatingAudio}
                  />
              </div>
                <div className="mt-2 flex items-end justify-between gap-3 flex-wrap">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Duration</label>
                    <select
                      value={miniDurationMinutes}
                      onChange={(e) => setMiniDurationMinutes(parseFloat(e.target.value))}
                      className="w-40 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={generatingAudio}
                    >
                      <option value={0.5}>30 sec</option>
                      <option value={1}>1 min</option>
                      <option value={2}>2 min</option>
                    </select>
                  </div>
                  <div className="ml-auto flex gap-2">
                    <button onClick={() => setIsMiniAudioOpen(false)} disabled={generatingAudio} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Close</button>
                  <button
                      onClick={async () => {
                        setGenerationError('');
                        setGeneratedAudioUrl('');
                        setGeneratedText('');
                        if (!miniPrompt.trim()) { setGenerationError('Please enter a prompt'); return; }
                        try {
                          setGeneratingAudio(true);
                          const baseUrl = process.env.NEXT_PUBLIC_AUDIO_SERVICE_URL;
                          if (!baseUrl) throw new Error('Audio service not configured');
                          const resp = await fetch(`${baseUrl.replace(/\/$/, '')}/generate`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ prompt: miniPrompt.trim(), duration_minutes: miniDurationMinutes, teamId: selectedTeam?.$id }),
                          });
                          if (!resp.ok) {
                            const text = await resp.text();
                            throw new Error(text || 'Generation failed');
                          }
                          const data = await resp.json();
                          const url = data.audio_base64 ? base64ToObjectUrl(data.audio_base64, data.mime || 'audio/mpeg') : '';
                          setGeneratedAudioUrl(url);
                          setGeneratedText(data.transcript || '');
                        } catch (e) {
                          setGenerationError(e?.message || 'Failed to generate audiobook');
                        } finally {
                          setGeneratingAudio(false);
                        }
                      }}
                      disabled={generatingAudio || !miniPrompt.trim()}
                      className={`px-4 py-2 rounded-lg font-medium ${ (generatingAudio || !miniPrompt.trim()) ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                    >
                      {generatingAudio ? 'Generating...' : 'Generate'}
                  </button>
                  <button
                      onClick={async () => {
                        setShareError('');
                        if (!selectedTeam) { setShareError('Select a team'); return; }
                        if (!generatedAudioUrl) { setShareError('Generate audio first'); return; }
                        if (!validateClient()) { setShareError('Configuration missing'); return; }
                        try {
                          setSharing(true);
                          // Fetch the object URL data back into a blob
                          const audioResp = await fetch(generatedAudioUrl);
                          const blob = await audioResp.blob();
                          const fileName = `mini-audiobook-${Date.now()}.mp3`;
                          // Wrap blob into a File to satisfy Appwrite browser SDK
                          const file = new File([blob], fileName, { type: blob.type || 'audio/mpeg' });
                          // Upload to storage with team read permissions
                          const bucketId = process.env.NEXT_PUBLIC_APPWRITE_BUCKET_ID || 'audiobooks';
                          const permissions = [
                            Permission.read(Role.team(selectedTeam.$id)),
                          ];
                          const result = await storage.createFile(bucketId, AppwriteID.unique(), file, permissions);
                          const fileId = result.$id;
                          // Build view URL
                          const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || '';
                          const project = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '';
                          const viewUrl = `${endpoint.replace(/\/$/, '')}/storage/buckets/${bucketId}/files/${fileId}/view?project=${project}`;
                          // Save activity into database collection (team-scoped)
                          const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DB_ID;
                          const collectionId = process.env.NEXT_PUBLIC_APPWRITE_ACTIVITIES_COLL_ID;
                          if (!databaseId || !collectionId) {
                            throw new Error('Appwrite DB configuration missing (DB_ID or ACTIVITIES_COLL_ID)');
                          }
                          const doc = await databases.createDocument(
                            databaseId,
                            collectionId,
                            AppwriteID.unique(),
                            {
                              teamId: selectedTeam.$id,
                              fileId,
                              fileUrl: viewUrl,
                              name: fileName,
                              transcript: generatedText,
                              type: 'audiobook',
                              createdById: user.$id,
                              createdByName: user.name,
                              createdByEmail: user.email,
                              likes: [],
                              comments: [],
                            },
                            [
                              Permission.read(Role.team(selectedTeam.$id)),
                              Permission.update(Role.team(selectedTeam.$id)),
                              Permission.delete(Role.team(selectedTeam.$id)),
                              Permission.write(Role.team(selectedTeam.$id)),
                            ]
                          );

                          // Also reflect in team prefs for quick read
                          const activity = {
                            id: doc.$id,
                            name: fileName,
                            url: viewUrl,
                            transcript: generatedText,
                            type: 'audiobook',
                            teamId: selectedTeam.$id,
                            createdBy: { id: user.$id, name: user.name, email: user.email },
                            createdAt: new Date().toISOString(),
                            comments: [],
                            likes: [],
                          };
                          const teamsSdk = new Teams(client);
                          const current = teamPrefs || {};
                          const prevList = Array.isArray(current.activities) ? current.activities : [];
                          const nextPrefs = { ...current, activities: [activity, ...prevList] };
                          if (typeof teamsSdk.updatePrefs === 'function') {
                            await teamsSdk.updatePrefs(selectedTeam.$id, nextPrefs);
                          } else if (typeof teamsSdk.updatePreferences === 'function') {
                            await teamsSdk.updatePreferences(selectedTeam.$id, nextPrefs);
                          }
                          setTeamPrefs(nextPrefs);
                          setActivities(nextPrefs.activities);
                        } catch (err) {
                          console.error('Share error:', err);
                          setShareError(err?.message || 'Failed to share');
                        } finally {
                          setSharing(false);
                        }
                      }}
                      disabled={sharing || generatingAudio || !generatedAudioUrl}
                      className={`px-4 py-2 rounded-lg font-medium ${ (sharing || generatingAudio || !generatedAudioUrl) ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                    >
                      {sharing ? 'Sharing...' : 'Share'}
                  </button>
                    </div>
            </div>
          </div>
              {(generatedAudioUrl || generatedText) && (
                <div className="mt-6 border-t pt-4">
                  {generatedAudioUrl && (
                    <audio controls className="w-full">
                      <source src={generatedAudioUrl} />
                      Your browser does not support the audio element.
                    </audio>
                  )}
                  {generatedText && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-gray-700 mb-1">Transcript</p>
                      <div className="text-sm text-gray-800 whitespace-pre-wrap bg-gray-50 border border-gray-200 rounded p-3 max-h-64 overflow-auto">{generatedText}</div>
                </div>
                  )}
                  </div>
                )}
              </div>
                </div>
                  </div>
        )}

      {/* Activity Viewer Modal */}
      {isActivityOpen && viewingActivity && (
        <div className="fixed inset-0 z-50">
          <div className="fixed inset-0 bg-black/30" onClick={() => setIsActivityOpen(false)}></div>
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className={`relative bg-white rounded-xl shadow-xl max-w-5xl w-full p-6 h-[80vh] overflow-hidden`}>
              <div className="flex items-start justify-between mb-3">
                <h4 className="text-lg font-semibold text-gray-900 truncate">{viewingActivity.name || 'Activity'}</h4>
                {(() => {
                  const t = (viewingActivity.type || 'audiobook').toLowerCase();
                  const styles = t === 'audiobook'
                    ? 'bg-amber-100 text-amber-800'
                    : t === 'summary'
                    ? 'bg-indigo-100 text-indigo-800'
                    : t === 'poll'
                    ? 'bg-fuchsia-100 text-fuchsia-800'
                    : 'bg-gray-100 text-gray-800';
                  return (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${styles}`}>
                      {t.toUpperCase()}
                    </span>
                  );
                })()}
                    </div>
              <div className={`lg:flex lg:gap-6 h-full`} onClick={(e) => e.stopPropagation()}>
                {/* Left: Activity content */}
                <div className="flex-1 min-w-0 h-full flex flex-col pb-2">
                  {viewingActivity.url && (
                    <div className="shrink-0">
                      <audio controls className="w-full mb-3">
                        <source src={viewingActivity.url} />
                        Your browser does not support the audio element.
                      </audio>
                      </div>
                    )}
                  {viewingActivity.type === 'poll' ? (
                    <div className="flex-1 min-h-0 mt-2 flex flex-col">
                      <p className="text-xs font-medium text-gray-700 mb-2">Poll</p>
                      <div className="space-y-2 overflow-auto">
                        {(Array.isArray(viewingActivity.pollOptions) ? viewingActivity.pollOptions : []).map((opt, idx) => {
                          const votes = Array.isArray(opt?.votes) ? opt.votes : [];
                          const all = Array.isArray(viewingActivity.pollOptions) ? viewingActivity.pollOptions : [];
                          const total = all.reduce((acc, o) => acc + (Array.isArray(o?.votes) ? o.votes.length : 0), 0);
                          const percent = total > 0 ? Math.round((votes.length / total) * 100) : 0;
                          const hasVotedAny = all.some((o) => Array.isArray(o?.votes) && o.votes.includes(user.$id));
                          const hasVotedThis = votes.includes(user.$id);
                          return (
                            <div key={idx} className="border border-gray-200 rounded p-2">
                              <div className="flex items-center justify-between">
                                <p className="text-sm text-gray-800">{opt?.label || `Option ${idx + 1}`}</p>
                                <span className="text-[10px] text-gray-500">{votes.length}{total > 0 ? ` • ${percent}%` : ''}</span>
                              </div>
                              <div className="mt-2 h-2 bg-gray-100 rounded">
                                <div className="h-2 bg-indigo-500 rounded" style={{ width: `${percent}%` }}></div>
                              </div>
                              <div className="mt-2 flex items-center gap-2">
                                <button
                                  className={`px-2 py-1 text-xs rounded ${hasVotedThis || hasVotedAny ? 'bg-gray-200 text-gray-600 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                                  disabled={hasVotedThis || hasVotedAny}
                                  onClick={async () => {
                                    try {
                                      if (!validateClient()) return;
                                      const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DB_ID;
                                      const collectionId = process.env.NEXT_PUBLIC_APPWRITE_ACTIVITIES_COLL_ID;
                                      if (!databaseId || !collectionId) return;
                                      // Pull latest, update specific option votes
                                      const doc = await databases.getDocument(databaseId, collectionId, viewingActivity.id);
                                      const currentRaw = Array.isArray(doc.pollOptions) ? doc.pollOptions : [];
                                      const currentParsed = currentRaw.map((it) => {
                                        if (typeof it === 'string') { try { return JSON.parse(it); } catch { return null; } }
                                        return it;
                                      }).filter(Boolean);
                                      const alreadyVoted = currentParsed.some((o) => Array.isArray(o?.votes) && o.votes.includes(user.$id));
                                      if (alreadyVoted) return;
                                      const nextParsed = currentParsed.map((o, i) => {
                                        const ov = Array.isArray(o?.votes) ? o.votes : [];
                                        if (i === idx && !ov.includes(user.$id)) {
                                          return { label: o.label, votes: [user.$id, ...ov] };
                                        }
                                        return { label: o.label, votes: ov };
                                      });
                                      const nextForDb = nextParsed.map((o) => JSON.stringify(o));
                                      await databases.updateDocument(databaseId, collectionId, viewingActivity.id, { pollOptions: nextForDb });
                                      setViewingActivity((prev) => prev ? { ...prev, pollOptions: nextParsed } : prev);
                                      setActivities((prev) => prev.map((a) => a.id === viewingActivity.id ? { ...a, pollOptions: nextParsed } : a));
                                    } catch (e) {
                                      console.warn('vote failed', e);
                                    }
                                  }}
                                >Vote</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : viewingActivity.type === 'announcement' ? (
                    <div className="flex-1 min-h-0 mt-2 overflow-auto">
                      <p className="text-xs font-medium text-gray-700 mb-2">Announcement</p>
                      {viewingActivity.links && (
                        <img src={viewingActivity.links} alt="Announcement" className="w-full rounded-md border border-gray-200 mb-3" />)
                      }
                      {viewingActivity.transcript && (
                        <div className="border border-gray-200 rounded p-3 bg-gray-50 text-sm text-gray-800 whitespace-pre-wrap">{viewingActivity.transcript}</div>
                      )}
                    </div>
                  ) : (
                    viewingActivity.transcript && (
                      <div className="flex-1 min-h-0 mt-2 flex flex-col">
                        <p className="text-xs font-medium text-gray-700 mb-1">Transcript</p>
                        <div className="h-[42vh] text-sm text-gray-800 whitespace-pre-wrap bg-gray-50 border border-gray-200 rounded p-3 overflow-auto">{viewingActivity.transcript}</div>
                        {viewingActivity.type === 'summary' && viewingActivity.links && (
                          <div className="mt-3">
                            <p className="text-xs font-medium text-gray-700 mb-1">Source link</p>
                            <a
                              href={viewingActivity.links}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-indigo-600 hover:text-indigo-800 break-all underline"
                            >
                              {viewingActivity.links}
                            </a>
                          </div>
                        )}
                      </div>
                    )
                  )}
                  {deleteActivityError && (
                    <div className="mt-3 p-2 text-sm bg-red-50 border border-red-200 rounded text-red-700">{deleteActivityError}</div>
                  )}
                  <div className="mt-3 mb-8 flex justify-end gap-2 shrink-0">
                    <button onClick={() => setIsActivityOpen(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Close</button>
                    {(selectedTeam?.isOwner || viewingActivity?.createdBy?.id === user?.$id) && (
                  <button
                        disabled={deletingActivity}
                        onClick={async () => {
                          setDeleteActivityError('');
                          if (!validateClient()) { setDeleteActivityError('Configuration missing'); return; }
                          if (!selectedTeam) { setDeleteActivityError('No team selected'); return; }
                          try {
                            setDeletingActivity(true);
                            const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DB_ID;
                            const collectionId = process.env.NEXT_PUBLIC_APPWRITE_ACTIVITIES_COLL_ID;
                            if (!databaseId || !collectionId) {
                              throw new Error('DB configuration missing');
                            }
                             let fileId = viewingActivity.fileId;
                             let bucketId = process.env.NEXT_PUBLIC_APPWRITE_BUCKET_ID;
                             if (!fileId) {
                               try {
                                 const d = await databases.getDocument(databaseId, collectionId, viewingActivity.id);
                                 fileId = d.fileId || undefined;
                                 // Derive fileId from links if not present (format ends with /files/{fileId}/view)
                                 if (!fileId && typeof d.links === 'string') {
                                   const match = d.links.match(/\/files\/([^/]+)\/view/);
                                   if (match && match[1]) fileId = match[1];
                                 }
                                 // Prefer bucket id from env; if not set and link has bucket, parse it
                                 if ((!bucketId || !bucketId.trim()) && typeof d.links === 'string') {
                                   const b = d.links.match(/storage\/buckets\/([^/]+)\/files\//);
                                   if (b && b[1]) bucketId = b[1];
                                 }
                               } catch (e) {}
                             }
                             if (bucketId && fileId) {
                               try { await storage.deleteFile(bucketId, fileId); } catch (fe) { console.warn('File delete failed:', fe); }
                             }
                            await databases.deleteDocument(databaseId, collectionId, viewingActivity.id);
                            setActivities((prev) => prev.filter((a) => a.id !== viewingActivity.id));
                            setIsActivityOpen(false);
                          } catch (err) {
                            setDeleteActivityError(err?.message || 'Failed to delete activity');
                          } finally {
                            setDeletingActivity(false);
                          }
                        }}
                        className={`px-4 py-2 rounded-lg font-medium ${deletingActivity ? 'bg-gray-300 text-gray-600' : 'bg-red-600 text-white hover:bg-red-700'}`}
                      >
                        {deletingActivity ? 'Deleting...' : 'Delete'}
                  </button>
                    )}
                </div>
              </div>
                {/* Right: Comments (collapsible sidebar) */}
                <div
                  className="mt-6 lg:mt-0 h-full"
                  style={{ width: commentsCollapsed ? '2.5rem' : '24rem', transition: 'width 300ms ease-in-out' }}
                >
                  {commentsCollapsed ? (
                    <div className="h-full w-full flex flex-col items-center justify-start py-3 gap-3">
                <button 
                        title="Like"
                        aria-label="Like"
                        className={`w-8 h-8 flex items-center justify-center rounded-md border bg-white hover:bg-gray-50 ${Array.isArray(viewingActivity?.likes) && user?.$id && viewingActivity.likes.includes(user.$id) ? 'border-rose-300' : 'border-gray-300'}`}
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (liking) return;
                          try {
                            setLiking(true);
                            const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DB_ID;
                            const collectionId = process.env.NEXT_PUBLIC_APPWRITE_ACTIVITIES_COLL_ID;
                            if (!databaseId || !collectionId) return;
                            const doc = await databases.getDocument(databaseId, collectionId, viewingActivity.id);
                            const prevLikes = Array.isArray(doc.likes) ? doc.likes : [];
                            const userId = user?.$id;
                            if (!userId) return;
                            let nextLikes;
                            if (prevLikes.includes(userId)) {
                              nextLikes = prevLikes.filter((id) => id !== userId);
                            } else {
                              nextLikes = [userId, ...prevLikes];
                            }
                            await databases.updateDocument(databaseId, collectionId, viewingActivity.id, { likes: nextLikes });
                            setViewingActivity((prev) => prev ? { ...prev, likes: nextLikes } : prev);
                            setActivities((prev) => prev.map((a) => a.id === viewingActivity.id ? { ...a, likes: nextLikes } : a));
                          } catch (err) {
                            console.warn('Failed to toggle like', err);
                          } finally {
                            setLiking(false);
                          }
                        }}
                        disabled={liking}
                      >
                        {Array.isArray(viewingActivity?.likes) && user?.$id && viewingActivity.likes.includes(user.$id) ? (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-rose-600">
                            <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 3 13.262 3 10.75 3 8.574 4.59 7 6.6 7c1.273 0 2.388.63 3.078 1.593.69-.963 1.805-1.593 3.077-1.593 2.01 0 3.6 1.574 3.6 3.75 0 2.512-1.688 4.61-3.989 6.757a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.218l-.022.012-.007.003-.003.002a.75.75 0 01-.704 0l-.003-.002z" />
                  </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4 text-gray-500">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 016.364 0L12 7.636l1.318-1.318a4.5 4.5 0 116.364 6.364L12 21.364l-7.682-7.682a4.5 4.5 0 010-6.364z" />
                          </svg>
                        )}
                </button>
                      <div className="text-[10px] text-gray-600">{Array.isArray(viewingActivity?.likes) ? viewingActivity.likes.length : 0}</div>
                  <button
                        title="Expand comments"
                        aria-label="Expand comments"
                        className="w-8 h-8 flex items-center justify-center rounded-md border border-gray-300 bg-white hover:bg-gray-50"
                        onClick={(e) => { e.stopPropagation(); setCommentsCollapsed(false); }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12c0 4.418-4.03 8-9 8-1.463 0-2.844-.292-4.047-.81L3 20l.81-4.047C3.292 14.844 3 13.463 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8zM8 12h.01M12 12h.01M16 12h.01" />
                        </svg>
                  </button>
                      <div className="text-[10px] text-gray-600">{Array.isArray(activityComments) ? activityComments.length : 0}</div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-sm font-medium text-gray-900">Comments</h5>
                        <div className="flex items-center gap-2">
                  <button
                            title="Like"
                            aria-label="Like"
                            className={`w-8 h-8 flex items-center justify-center rounded-md border bg-white hover:bg-gray-50 ${Array.isArray(viewingActivity?.likes) && user?.$id && viewingActivity.likes.includes(user.$id) ? 'border-rose-300' : 'border-gray-300'}`}
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (liking) return;
                              try {
                                setLiking(true);
                                const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DB_ID;
                                const collectionId = process.env.NEXT_PUBLIC_APPWRITE_ACTIVITIES_COLL_ID;
                                if (!databaseId || !collectionId) return;
                                const doc = await databases.getDocument(databaseId, collectionId, viewingActivity.id);
                                const prevLikes = Array.isArray(doc.likes) ? doc.likes : [];
                                const userId = user?.$id;
                                if (!userId) return;
                                let nextLikes;
                                if (prevLikes.includes(userId)) {
                                  nextLikes = prevLikes.filter((id) => id !== userId);
                                } else {
                                  nextLikes = [userId, ...prevLikes];
                                }
                                await databases.updateDocument(databaseId, collectionId, viewingActivity.id, { likes: nextLikes });
                                setViewingActivity((prev) => prev ? { ...prev, likes: nextLikes } : prev);
                                setActivities((prev) => prev.map((a) => a.id === viewingActivity.id ? { ...a, likes: nextLikes } : a));
                              } catch (err) {
                                console.warn('Failed to toggle like', err);
                              } finally {
                                setLiking(false);
                              }
                            }}
                            disabled={liking}
                          >
                            {Array.isArray(viewingActivity?.likes) && user?.$id && viewingActivity.likes.includes(user.$id) ? (
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-rose-600">
                                <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 3 13.262 3 10.75 3 8.574 4.59 7 6.6 7c1.273 0 2.388.63 3.078 1.593.69-.963 1.805-1.593 3.077-1.593 2.01 0 3.6 1.574 3.6 3.75 0 2.512-1.688 4.61-3.989 6.757a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.218l-.022.012-.007.003-.003.002a.75.75 0 01-.704 0l-.003-.002z" />
                  </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4 text-gray-500">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 016.364 0L12 7.636l1.318-1.318a4.5 4.5 0 116.364 6.364L12 21.364l-7.682-7.682a4.5 4.5 0 010-6.364z" />
                        </svg>
                    )}
                  </button>
                          <div className="text-[10px] text-gray-600">{Array.isArray(viewingActivity?.likes) ? viewingActivity.likes.length : 0}</div>
                    <button
                            title="Collapse comments"
                            aria-label="Collapse comments"
                            className="w-8 h-8 flex items-center justify-center rounded-md border border-gray-300 hover:bg-gray-50"
                            onClick={() => setCommentsCollapsed(true)}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                    </button>
              </div>
            </div>
                      {commentsError && (
                        <div className="mb-2 p-2 text-xs bg-red-50 border border-red-200 rounded text-red-700">{commentsError}</div>
                      )}
                      <div className="mb-3 flex items-start gap-2">
                        <textarea
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          rows={2}
                          placeholder="Add a comment..."
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={addingComment}
                        />
                  <button
                          onClick={async () => {
                            setCommentsError('');
                            if (!newComment.trim()) return;
                            try {
                              setAddingComment(true);
                              const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DB_ID;
                              const collectionId = process.env.NEXT_PUBLIC_APPWRITE_ACTIVITIES_COLL_ID;
                              if (!databaseId || !collectionId) {
                                throw new Error('DB configuration missing');
                              }
                              // Optimistic UI
                              const comment = { text: newComment.trim(), at: new Date().toISOString(), by: { id: user.$id, name: user.name, email: user.email } };
                              setActivityComments((prev) => [comment, ...(prev || [])]);
                              setNewComment('');
                              // Persist comment in the document's comments array
                              const doc = await databases.getDocument(databaseId, collectionId, viewingActivity.id);
                              const prevCommentsRaw = Array.isArray(doc.comments) ? doc.comments : [];
                              const nextCommentsRaw = [JSON.stringify(comment), ...prevCommentsRaw];
                              await databases.updateDocument(databaseId, collectionId, viewingActivity.id, { comments: nextCommentsRaw });
                              // Also update local activities list for subtitle freshness if needed
                              setActivities((prev) => prev.map((a) => a.id === viewingActivity.id ? { ...a, comments: [comment, ...(a.comments || [])] } : a));
                            } catch (e) {
                              setCommentsError(e?.message || 'Failed to add comment');
                            } finally {
                              setAddingComment(false);
                            }
                          }}
                          disabled={addingComment || !newComment.trim()}
                          className={`px-3 py-2 rounded-lg text-sm font-medium ${ (addingComment || !newComment.trim()) ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                        >
                          {addingComment ? 'Posting...' : 'Post'}
                  </button>
                </div>
                      {!Array.isArray(activityComments) || activityComments.length === 0 ? (
                        <p className="text-xs text-gray-500">No comments yet.</p>
                      ) : (
                        <ul className="space-y-2 flex-1 overflow-auto pr-1">
                          {activityComments.map((c, idx) => {
                            const isAuthor = c?.by?.id && user?.$id && c.by.id === user.$id;
                            const isOwner = !!selectedTeam?.isOwner;
                            const isEditing = editingCommentId === c?.id || editingIndex === idx;
                            return (
                              <li key={c.id || idx} className="border border-gray-200 rounded-md p-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="text-xs text-gray-500 mb-1">
                                      {c.by?.name || c.by?.email || 'User'} • {c.at ? new Date(c.at).toLocaleString() : ''}
                                    </p>
                                    {!isEditing ? (
                                      <p className="text-sm text-gray-800 whitespace-pre-wrap">{c.text}</p>
                                    ) : (
                                      <div className="flex items-start gap-2">
                                        <textarea
                                          value={editText}
                                          onChange={(e) => setEditText(e.target.value)}
                                          rows={2}
                                          className="flex-1 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                          disabled={savingComment}
                                        />
                                        <button
                                          className={`px-2 py-1 text-sm rounded-md ${savingComment ? 'bg-gray-300 text-gray-600' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                                          disabled={savingComment || !editText.trim()}
                                          onClick={async () => {
                                            try {
                                              setSavingComment(true);
                                              const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DB_ID;
                                              const collectionId = process.env.NEXT_PUBLIC_APPWRITE_ACTIVITIES_COLL_ID;
                                              if (!databaseId || !collectionId) throw new Error('DB configuration missing');
                                              const doc = await databases.getDocument(databaseId, collectionId, viewingActivity.id);
                                              const prevCommentsRaw = Array.isArray(doc.comments) ? doc.comments : [];
                                              const prevParsed = parseDocComments(prevCommentsRaw);
                                              const targetIndex = (c.id ? prevParsed.findIndex((pc) => pc.id === c.id) : idx);
                                              if (targetIndex < 0) throw new Error('Comment not found');
                                              const updatedComment = { ...prevParsed[targetIndex], text: editText.trim(), editedAt: new Date().toISOString() };
                                              // Maintain newest-first order; replace in place
                                              const nextParsed = [...prevParsed];
                                              nextParsed[targetIndex] = updatedComment;
                                              const nextRaw = nextParsed.map((pc) => JSON.stringify(pc));
                                              await databases.updateDocument(databaseId, collectionId, viewingActivity.id, { comments: nextRaw });
                                              setActivityComments(nextParsed);
                                              setEditingCommentId(null);
                                              setEditingIndex(null);
                                              setEditText('');
                                            } catch (err) {
                                              setCommentsError(err?.message || 'Failed to save comment');
                                            } finally {
                                              setSavingComment(false);
                                            }
                                          }}
                                        >Save</button>
                                        <button
                                          className="px-2 py-1 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
                                          disabled={savingComment}
                                          onClick={() => { setEditingCommentId(null); setEditingIndex(null); setEditText(''); }}
                                        >Cancel</button>
                  </div>
                )}
              </div>
                                  {(isAuthor || isOwner) && (
                                    <div className="flex items-center gap-2 shrink-0">
                                      {isAuthor && !isEditing && (
                    <button
                                          className="text-xs px-2 py-1 rounded-md border border-gray-300 hover:bg-gray-50"
                                          onClick={() => { setEditingCommentId(c.id || null); setEditingIndex(idx); setEditText(c.text || ''); }}
                                        >Edit</button>
                                      )}
                                      <button
                                        className={`text-xs px-2 py-1 rounded-md ${deletingCommentId === (c.id || idx) ? 'bg-red-300 text-white' : 'border border-red-600 text-red-700 hover:bg-red-50'}`}
                                        disabled={savingComment || deletingCommentId === (c.id || idx)}
                                        onClick={async () => {
                                          try {
                                            setDeletingCommentId(c.id || idx);
                                            const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DB_ID;
                                            const collectionId = process.env.NEXT_PUBLIC_APPWRITE_ACTIVITIES_COLL_ID;
                                            if (!databaseId || !collectionId) throw new Error('DB configuration missing');
                                            const doc = await databases.getDocument(databaseId, collectionId, viewingActivity.id);
                                            const prevCommentsRaw = Array.isArray(doc.comments) ? doc.comments : [];
                                            const prevParsed = parseDocComments(prevCommentsRaw);
                                            const targetIndex = (c.id ? prevParsed.findIndex((pc) => pc.id === c.id) : idx);
                                            if (targetIndex < 0) throw new Error('Comment not found');
                                            // Permission check in UI: allow if author or team owner
                                            const target = prevParsed[targetIndex];
                                            const isTargetAuthor = target?.by?.id && user?.$id && target.by.id === user.$id;
                                            if (!isTargetAuthor && !isOwner) throw new Error('Not allowed');
                                            const nextParsed = prevParsed.filter((_, i) => i !== targetIndex);
                                            const nextRaw = nextParsed.map((pc) => JSON.stringify(pc));
                                            await databases.updateDocument(databaseId, collectionId, viewingActivity.id, { comments: nextRaw });
                                            setActivityComments(nextParsed);
                                          } catch (err) {
                                            setCommentsError(err?.message || 'Failed to delete comment');
                                          } finally {
                                            setDeletingCommentId(null);
                                          }
                                        }}
                                      >{deletingCommentId === (c.id || idx) ? 'Removing...' : (isAuthor ? 'Delete' : 'Remove')}</button>
                </div>
                                  )}
                  </div>
                              </li>
                            );
                          })}
                        </ul>
        )}
                  </div>
                  )}
              </div>
            </div>

                        </div>
                      </div>
                    </div>
      )}

      {/* Summary Modal */}
      {isSummaryOpen && (
        <div className="fixed inset-0 z-50">
          <div className="fixed inset-0 bg-black/30" onClick={() => !summaryGenerating && setIsSummaryOpen(false)}></div>
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="relative bg-white rounded-xl shadow-xl max-w-xl w-full p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Generate Summary</h4>
              {summaryError && (
                <div className="mb-3 p-2 text-sm bg-red-50 border border-red-200 rounded text-red-700">{summaryError}</div>
              )}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">URL</label>
                  <input
                    type="url"
                    value={summaryUrl}
                    onChange={(e) => setSummaryUrl(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://example.com/article"
                    disabled={summaryGenerating}
                  />
                        </div>
                <div className="flex items-center justify-end gap-2">
                  <button onClick={() => setIsSummaryOpen(false)} disabled={summaryGenerating} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Close</button>
                      <button
                    onClick={async () => {
                      try {
                        setSummaryError('');
                        setSummaryText('');
                        if (!summaryUrl.trim()) { setSummaryError('Please enter a URL'); return; }
                        const baseUrl = process.env.NEXT_PUBLIC_FIRECRAWL_SERVICE_URL;
                        if (!baseUrl) throw new Error('Firecrawl service not configured');
                        setSummaryGenerating(true);
                        const resp = await fetch(`${baseUrl.replace(/\/$/, '')}/extract`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ url: summaryUrl.trim() }),
                        });
                        if (!resp.ok) {
                          const text = await resp.text();
                          throw new Error(text || 'Extraction failed');
                        }
                        const data = await resp.json();
                        const text = data?.summary || data?.data || JSON.stringify(data);
                        setSummaryText(typeof text === 'string' ? text : JSON.stringify(text, null, 2));
                      } catch (e) {
                        setSummaryError(e?.message || 'Failed to generate summary');
                      } finally {
                        setSummaryGenerating(false);
                      }
                    }}
                    disabled={summaryGenerating || !summaryUrl.trim()}
                    className={`px-4 py-2 rounded-lg font-medium ${ (summaryGenerating || !summaryUrl.trim()) ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                  >
                    {summaryGenerating ? 'Generating...' : 'Generate'}
                      </button>
                      <button
                    onClick={async () => {
                      try {
                        setSummaryError('');
                        if (!selectedTeam) { setSummaryError('Select a team'); return; }
                        if (!summaryText.trim()) { setSummaryError('Generate summary first'); return; }
                        setSummaryName('');
                        setIsSummaryNameOpen(true);
                      } catch (err) {
                        setSummaryError(err?.message || 'Failed to share');
                      }
                    }}
                    disabled={!summaryText.trim()}
                    className={`px-4 py-2 rounded-lg font-medium ${ (!summaryText.trim()) ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                  >
                    Share
                      </button>
                    </div>
                {summaryText && (
                  <div className="mt-4">
                    <p className="text-xs font-medium text-gray-700 mb-1">Summary</p>
                    <div className="text-sm text-gray-800 whitespace-pre-wrap bg-gray-50 border border-gray-200 rounded p-3 max-h-64 overflow-auto">{summaryText}</div>
                    {summaryUrl?.trim() && (
                      <div className="mt-3">
                        <p className="text-xs font-medium text-gray-700 mb-1">Source link</p>
                        <a
                          href={summaryUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-indigo-600 hover:text-indigo-800 break-all underline"
                        >
                          {summaryUrl}
                        </a>
                    </div>
                    )}
                  </div>
                )}
                </div>
                      </div>
                    </div>
                  </div>
        )}

      {isSummaryNameOpen && (
        <div className="fixed inset-0 z-50">
          <div className="fixed inset-0 bg-black/30" onClick={() => !summarySharing && setIsSummaryNameOpen(false)}></div>
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Name Your Summary</h4>
              {summaryError && (
                <div className="mb-3 p-2 text-sm bg-red-50 border border-red-200 rounded text-red-700">{summaryError}</div>
              )}
              <input
                type="text"
                value={summaryName}
                onChange={(e) => setSummaryName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Topic name"
                disabled={summarySharing}
              />
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setIsSummaryNameOpen(false)} disabled={summarySharing} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Cancel</button>
                    <button
                  onClick={async () => {
                    try {
                      setSummaryError('');
                      if (!validateClient()) { setSummaryError('Configuration missing'); return; }
                      if (!summaryName.trim()) { setSummaryError('Please enter a name'); return; }
                      setSummarySharing(true);
                      const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DB_ID;
                      const collectionId = process.env.NEXT_PUBLIC_APPWRITE_ACTIVITIES_COLL_ID;
                      if (!databaseId || !collectionId) throw new Error('DB configuration missing');
                      const doc = await databases.createDocument(
                        databaseId,
                        collectionId,
                        AppwriteID.unique(),
                        {
                          teamId: selectedTeam.$id,
                          name: summaryName.trim(),
                          links: summaryUrl.trim(),
                          transcript: summaryText,
                          type: 'summary',
                          createdById: user.$id,
                          createdByName: user.name,
                          createdByEmail: user.email,
                          likes: [],
                          comments: [],
                        },
                        [
                          Permission.read(Role.team(selectedTeam.$id)),
                          Permission.update(Role.team(selectedTeam.$id)),
                          Permission.delete(Role.team(selectedTeam.$id)),
                          Permission.write(Role.team(selectedTeam.$id)),
                        ]
                      );
                      const activity = {
                        id: doc.$id,
                        name: doc.name,
                        url: '',
                        transcript: summaryText,
                        type: 'summary',
                        teamId: selectedTeam.$id,
                        createdBy: { id: user.$id, name: user.name, email: user.email },
                        createdAt: new Date().toISOString(),
                        comments: [],
                        likes: [],
                      };
                      setActivities((prev) => [activity, ...(prev || [])]);
                      setIsSummaryNameOpen(false);
                      setIsSummaryOpen(false);
                    } catch (err) {
                      setSummaryError(err?.message || 'Failed to save');
                    } finally {
                      setSummarySharing(false);
                    }
                  }}
                  disabled={summarySharing || !summaryName.trim()}
                  className={`px-4 py-2 rounded-lg font-medium ${ (summarySharing || !summaryName.trim()) ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                >
                  {summarySharing ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                      </div>
                    </div>
                  </div>
      )}

      {isOutboxConfirmOpen && (
        <div className="fixed inset-0 z-50">
          <div className="fixed inset-0 bg-black/30" onClick={() => !outboxSending && setIsOutboxConfirmOpen(false)}></div>
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Confirm Send</h4>
              {outboxError && <div className="mb-2 p-2 text-sm bg-red-50 border border-red-200 rounded text-red-700">{outboxError}</div>}
              <p className="text-sm text-gray-700 mb-2">Subject: <span className="font-medium">{outboxSubject}</span></p>
              <p className="text-xs text-gray-700 mb-1">Recipients ({outboxPendingRecipients.length}):</p>
              <div className="max-h-32 overflow-auto border border-gray-200 rounded p-2 text-xs text-gray-800 mb-3">
                <ul className="list-disc pl-4">
                  {outboxPendingRecipients.map((em, i) => (<li key={i}>{em}</li>))}
                </ul>
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <button className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50" onClick={() => setIsOutboxConfirmOpen(false)} disabled={outboxSending}>Cancel</button>
                <button
                  className={`px-4 py-2 rounded-lg font-medium ${ outboxSending ? 'bg-gray-300 text-gray-600' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                  disabled={outboxSending}
                  onClick={async () => {
                    try {
                      setOutboxError('');
                      setOutboxSending(true);
                      const baseUrl = process.env.NEXT_PUBLIC_RESEND_SERVICE_URL;
                      if (!baseUrl) throw new Error('Resend service not configured');
                      const resp = await fetch(`${baseUrl.replace(/\/$/, '')}/send`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          from: user?.email || 'no-reply@example.com',
                          to: outboxPendingRecipients,
                          subject: outboxSubject.trim(),
                          html: outboxBody.trim().replace(/\n/g, '<br/>'),
                        }),
                      });
                      if (!resp.ok) {
                        const t = await resp.text();
                        throw new Error(t || 'Failed to send');
                      }
                      // Save record to outbox collection
                      const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DB_ID;
                      const outboxCollId = process.env.NEXT_PUBLIC_APPWRITE_OUTBOX_COLL_ID;
                      if (databaseId && outboxCollId) {
                        try {
                          await databases.createDocument(
                            databaseId,
                            outboxCollId,
                            AppwriteID.unique(),
                            {
                              teamId: selectedTeam?.$id,
                              subject: outboxSubject.trim(),
                              body: outboxBody,
                              recipients: outboxPendingRecipients,
                              createdById: user.$id,
                              createdByName: user.name,
                              createdByEmail: user.email,
                            },
                            [
                              Permission.read(Role.team(selectedTeam.$id)),
                              Permission.write(Role.team(selectedTeam.$id)),
                              Permission.update(Role.team(selectedTeam.$id)),
                              Permission.delete(Role.team(selectedTeam.$id)),
                            ]
                          );
                        } catch (e) {
                          console.warn('Failed to save outbox record', e);
                        }
                      }
                      // Reset & show success popup
                      setOutboxSubject('');
                      setOutboxBody('');
                      setOutboxSelected({});
                      setIsOutboxConfirmOpen(false);
                      setOutboxSuccessText(`Sent to ${outboxPendingRecipients.length} recipient(s).`);
                      setOutboxSuccessOpen(true);
                    } catch (e) {
                      setOutboxError(e?.message || 'Failed to send');
                    } finally {
                      setOutboxSending(false);
                    }
                  }}
                >
                  {outboxSending ? 'Sending...' : 'Confirm & Send'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Poll Modal */}
      {isPollOpen && (
        <div className="fixed inset-0 z-50">
          <div className="fixed inset-0 bg-black/30" onClick={() => !pollSaving && setIsPollOpen(false)}></div>
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Create Poll</h4>
              {pollError && (
                <div className="mb-3 p-2 text-sm bg-red-50 border border-red-200 rounded text-red-700">{pollError}</div>
              )}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Question</label>
                  <input
                    type="text"
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="What's your question?"
                    disabled={pollSaving}
                  />
                      </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-gray-700">Options (2–4)</label>
                    <div className="flex gap-2">
                    <button
                        className={`px-2 py-1 text-xs rounded border ${pollOptions.length >= 4 ? 'text-gray-400 border-gray-200 cursor-not-allowed' : 'text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                        onClick={() => setPollOptions((prev) => prev.length < 4 ? [...prev, ''] : prev)}
                        disabled={pollSaving || pollOptions.length >= 4}
                      >Add</button>
                      <button
                        className={`px-2 py-1 text-xs rounded border ${pollOptions.length <= 2 ? 'text-gray-400 border-gray-200 cursor-not-allowed' : 'text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                        onClick={() => setPollOptions((prev) => prev.length > 2 ? prev.slice(0, -1) : prev)}
                        disabled={pollSaving || pollOptions.length <= 2}
                      >Remove</button>
                  </div>
                </div>
                  <div className="space-y-2">
                    {pollOptions.map((opt, idx) => (
                      <input
                        key={idx}
                        type="text"
                        value={opt}
                        onChange={(e) => setPollOptions((prev) => prev.map((v, i) => i === idx ? e.target.value : v))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={`Option ${idx + 1}`}
                        disabled={pollSaving}
                      />
                    ))}
              </div>
                      </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button onClick={() => setIsPollOpen(false)} disabled={pollSaving} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Close</button>
                    <button
                    onClick={async () => {
                      try {
                        setPollError('');
                        if (!selectedTeam) { setPollError('Select a team'); return; }
                        const cleaned = pollOptions.map((s) => (s || '').trim()).filter(Boolean);
                        if (!pollQuestion.trim()) { setPollError('Enter a question'); return; }
                        if (cleaned.length < 2) { setPollError('Add at least 2 options'); return; }
                        if (cleaned.length > 4) { setPollError('Max 4 options'); return; }
                        if (!validateClient()) { setPollError('Configuration missing'); return; }
                        setPollSaving(true);
                        const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DB_ID;
                        const collectionId = process.env.NEXT_PUBLIC_APPWRITE_ACTIVITIES_COLL_ID;
                        if (!databaseId || !collectionId) throw new Error('DB configuration missing');
                        // If your Appwrite attribute is an array of strings, stringify each option object
                        const optionsPayload = cleaned.map((label) => ({ label, votes: [] }));
                        let payloadPollOptions = optionsPayload;
                        // Try to detect schema by checking an env flag or just force string array schema
                        // Here we assume string array schema: each item is JSON string
                        payloadPollOptions = optionsPayload.map((o) => JSON.stringify(o));
                        const doc = await databases.createDocument(
                          databaseId,
                          collectionId,
                          AppwriteID.unique(),
                          {
                            teamId: selectedTeam.$id,
                            name: pollQuestion.trim(),
                            type: 'poll',
                            pollOptions: payloadPollOptions, // string[] of JSON objects
                            createdById: user.$id,
                            createdByName: user.name,
                            createdByEmail: user.email,
                            likes: [],
                            comments: [],
                          },
                          [
                            Permission.read(Role.team(selectedTeam.$id)),
                            Permission.update(Role.team(selectedTeam.$id)),
                            Permission.delete(Role.team(selectedTeam.$id)),
                            Permission.write(Role.team(selectedTeam.$id)),
                          ]
                        );
                        const activity = {
                          id: doc.$id,
                          name: pollQuestion.trim(),
                          type: 'poll',
                          pollOptions: optionsPayload,
                          teamId: selectedTeam.$id,
                          createdBy: { id: user.$id, name: user.name, email: user.email },
                          createdAt: new Date().toISOString(),
                          comments: [],
                          likes: [],
                        };
                        setActivities((prev) => [activity, ...(prev || [])]);
                        setIsPollOpen(false);
                        setPollQuestion('');
                        setPollOptions(['', '']);
                      } catch (err) {
                        setPollError(err?.message || 'Failed to create poll');
                      } finally {
                        setPollSaving(false);
                      }
                    }}
                    disabled={pollSaving}
                    className={`px-4 py-2 rounded-lg font-medium ${ pollSaving ? 'bg-gray-300 text-gray-600' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                  >
                    {pollSaving ? 'Saving...' : 'Create'}
                    </button>
                  </div>
                      </div>
                    </div>
            </div>
          </div>
        )}

        {/* Removed legacy popups */}
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
} 