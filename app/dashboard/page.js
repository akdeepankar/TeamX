'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getUser, logoutUser, getUserGmailPreferences, getUserTelegramPreferences, updateUserTelegramPreferences } from '../../lib/auth';
import { client, functions, validateClient, storage, databases, Permission, Role, ID as AppwriteID } from '../../lib/appwrite';
// Utils and popups removed as part of cleanup
// Removed FloatingChatButton (Qloo-related)
import { Functions, Teams, ID, Query } from 'appwrite';

function DashboardContent() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const [emails, setEmails] = useState([]);
  const [emailsLoading, setEmailsLoading] = useState(false);
  const [emailsError, setEmailsError] = useState(null);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailConnecting, setGmailConnecting] = useState(false);
  const [gmailDisconnecting, setGmailDisconnecting] = useState(false);
  const [showSearchFilter, setShowSearchFilter] = useState(false);
  const [searchingBooking, setSearchingBooking] = useState(false);
  const [popupEmail, setPopupEmail] = useState(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [userPreferences, setUserPreferences] = useState(null);
  const [isTelegramPopupOpen, setIsTelegramPopupOpen] = useState(false);
  const [telegramChatId, setTelegramChatId] = useState('');
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
  const [activities, setActivities] = useState([]);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [viewingActivity, setViewingActivity] = useState(null);

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
          
          // Load user Gmail preferences
          try {
            const preferences = await getUserGmailPreferences();
            const telegramPreferences = await getUserTelegramPreferences();
            
            // Merge preferences
            const mergedPreferences = {
              ...preferences,
              ...telegramPreferences
            };
            
            setUserPreferences(mergedPreferences);
            setTelegramChatId(mergedPreferences.telegramChatId || '');
            
            // Load mate preferences from user data
            loadMatePreferences(mergedPreferences);
          } catch (prefError) {
            console.log('Could not load user preferences:', prefError);
          }
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

  const handleSaveTelegramChatId = async (chatId) => {
    try {
      // Encode the chat ID before saving
      const encodedChatId = encodeChatId(chatId);
      await updateUserTelegramPreferences(encodedChatId);
      setTelegramChatId(encodedChatId);
      
      // Refresh user preferences display
      const gmailPreferences = await getUserGmailPreferences();
      const telegramPreferences = await getUserTelegramPreferences();
      
      // Merge preferences
      const mergedPreferences = {
        ...gmailPreferences,
        ...telegramPreferences
      };
      
      setUserPreferences(mergedPreferences);
      
      // Load mate preferences from user data
      loadMatePreferences(mergedPreferences);
      
      console.log('Telegram chat ID saved successfully');
      
      // Show success message
      setEmailsError(null);
      
      // Trigger message refresh after Telegram connection
      setTimeout(() => {
        setRefreshMessages(prev => !prev);
      }, 1000);
      
      // You could add a toast notification here if you have a toast system
    } catch (error) {
      console.error('Error saving Telegram chat ID:', error);
      throw error;
    }
  };

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
              teamId: d.teamId,
              createdBy: { id: d.createdById, name: d.createdByName, email: d.createdByEmail },
              createdAt: d.$createdAt,
            }));
            setActivities(mapped);
          } catch (dbErr) {
            console.warn('Failed to list activities from DB:', dbErr);
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

  // Teams listing
  const TeamsList = ({ onSelect, selectedTeamId, reloadFlag }) => {
    const [loadingTeams, setLoadingTeams] = useState(true);
    const [teams, setTeams] = useState([]);
    const [error, setError] = useState('');

    useEffect(() => {
      const fetchTeams = async () => {
        try {
          setError('');
          if (!validateClient()) {
            throw new Error('Configuration missing');
          }
          const teamsSdk = new Teams(client);
          const list = await teamsSdk.list();
          setTeams(list?.teams || []);
        } catch (e) {
          setError(e?.message || 'Failed to fetch teams');
        } finally {
          setLoadingTeams(false);
        }
      };
      fetchTeams();
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
      <ul className="divide-y divide-gray-100">
        {teams.map((t) => {
          const isSelected = selectedTeamId === t.$id;
          return (
            <li
              key={t.$id}
              onClick={() => onSelect && onSelect(t)}
              className={`py-3 px-2 flex items-center justify-between cursor-pointer rounded-md transition-colors ${
                isSelected ? 'bg-blue-50 border-l-4 border-blue-500' : 'hover:bg-gray-50'
              }`}
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{t.name}</p>
                <p className="text-xs text-gray-500">{t.$id}</p>
              </div>
              <span
                className={`text-xs px-2 py-1 rounded-full ${t.isOwner ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}
              >
                {t.isOwner ? 'Owner' : 'Member'}
              </span>
            </li>
          );
        })}
      </ul>
    );
  };

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
              <h3 className="text-lg font-medium text-gray-900 mb-2">Join a Team</h3>
              <p className="text-sm text-gray-600 mb-4">Enter a team ID to join.</p>
              {joinError && <div className="mb-3 p-2 text-sm bg-red-50 border border-red-200 rounded text-red-700">{joinError}</div>}
              {joinMessage && <div className="mb-3 p-2 text-sm bg-green-50 border border-green-200 rounded text-green-700">{joinMessage}</div>}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinTeamId}
                  onChange={(e) => setJoinTeamId(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="team_id"
                />
                    <button
                  onClick={async () => {
                    setJoinError(''); setJoinMessage('');
                    if (!validateClient()) { setJoinError('Configuration missing'); return; }
                    if (!joinTeamId.trim()) { setJoinError('Please enter a team ID'); return; }
                    try {
                      setJoining(true);
                      const teams = new Teams(client);
                      await teams.get(joinTeamId.trim());
                      setJoinMessage('Team exists. Membership typically requires an invite.');
                    } catch (e) {
                      setJoinError(e?.message || 'Failed to join team');
                    } finally {
                      setJoining(false);
                    }
                  }}
                  disabled={joining}
                  className={`px-4 py-2 rounded-lg font-medium ${joining ? 'bg-gray-300 text-gray-600' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                >
                  {joining ? 'Joining...' : 'Join Team'}
                    </button>
              </div>
              <p className="mt-2 text-xs text-gray-500">Note: To actually join, create an invite in Appwrite and accept it.</p>
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Column 1: Teams List */}
              <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Your Teams</h3>
              <TeamsList onSelect={setSelectedTeam} selectedTeamId={selectedTeam?.$id} reloadFlag={teamsListReloadFlag} />
                </div>
                
            {/* Column 2: Team Details */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Team Details</h3>
                {selectedTeam && (
                  <div className="flex items-center gap-2">
                    <button
                      title="Edit Team"
                      onClick={() => { setEditTeamError(''); setEditTeamName(selectedTeam.name); setIsEditTeamOpen(true); }}
                      className="p-2 rounded-md hover:bg-gray-100 text-gray-600 hover:text-gray-900"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793z" />
                        <path fillRule="evenodd" d="M11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828zM2 13.172L12.172 3a4 4 0 115.656 5.656L7.657 18.828A2 2 0 016.243 19H2.5A.5.5 0 012 18.5v-3.743a2 2 0 01.586-1.414z" clipRule="evenodd" />
                          </svg>
                    </button>
                    <button
                      title="Delete Team"
                      onClick={() => { setDeleteTeamError(''); setIsDeleteTeamOpen(true); }}
                      className="p-2 rounded-md hover:bg-red-50 text-red-600 hover:text-red-700"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 100 2h.293l.853 10.24A2 2 0 007.138 18h5.724a2 2 0 001.992-1.76L15.707 6H16a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM8 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                        </div>
                      )}
                  </div>
              {!selectedTeam ? (
                <p className="text-sm text-gray-500">Select a team to view details.</p>
                ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">{selectedTeam.name}</p>
                    <span className={`text-xs px-2 py-1 rounded-full ${selectedTeam.isOwner ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                      {selectedTeam.isOwner ? 'Owner' : 'Member'}
                      </span>
                      </div>
                  <div>
                    <p className="text-xs font-medium text-gray-700 mb-1">Join Code</p>
                    {prefsLoading ? (
                      <p className="text-xs text-gray-500">Loading...</p>
                    ) : prefsError ? (
                      <p className="text-xs text-red-600">{prefsError}</p>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono bg-gray-100 border border-gray-200 rounded px-2 py-0.5">
                          {teamPrefs?.joinCode || '—'}
                          </span>
                        </div>
                      )}
                      </div>
                  {membersLoading ? (
                    <p className="text-xs text-gray-500">Loading members...</p>
                  ) : membersError ? (
                    <p className="text-xs text-red-600">{membersError}</p>
                    ) : (
                      <>
                      <div>
                        <p className="text-xs font-medium text-gray-700 mb-1">Owner</p>
                        {!teamOwner ? (
                          <p className="text-xs text-gray-500">No owner found.</p>
                        ) : (
                          <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-md p-2">
                            <div className="min-w-0">
                              {(() => {
                                const ownerName = teamOwner.userName || (teamOwner.userId === user.$id ? (user.name || (user.email ? user.email.split('@')[0] : 'Owner')) : 'Unknown');
                                const ownerEmail = teamOwner.userEmail || (teamOwner.userId === user.$id ? (user.email || 'No email') : 'No email');
                                return (
                                  <>
                                    <p className="text-sm text-gray-900 truncate">{ownerName}</p>
                                    <p className="text-xs text-gray-500 truncate">{ownerEmail}</p>
                                  </>
                                );
                              })()}
                    </div>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Owner</span>
                        </div>
                      )}
                  </div>
                      <div>
                        <p className="text-xs font-medium text-gray-700 mb-1">Members</p>
                        {teamMembers.filter((m) => !(Array.isArray(m.roles) && m.roles.includes('owner'))).length === 0 ? (
                          <p className="text-xs text-gray-500">No members yet.</p>
                        ) : (
                          <ul className="space-y-2 max-h-60 overflow-auto pr-1">
                            {teamMembers
                              .filter((m) => !(Array.isArray(m.roles) && m.roles.includes('owner')))
                              .map((m) => {
                                const displayName = m.userName || (m.userId === user.$id ? (user.name || (user.email ? user.email.split('@')[0] : 'You')) : 'Unknown');
                                const displayEmail = m.userEmail || (m.userId === user.$id ? (user.email || 'No email') : 'No email');
                                return (
                                  <li key={m.$id} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-md p-2">
                                    <div className="min-w-0">
                                      <p className="text-sm text-gray-900 truncate">{displayName}</p>
                                      <p className="text-xs text-gray-500 truncate">{displayEmail}</p>
              </div>
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Member</span>
                                  </li>
                                );
                              })}
                          </ul>
                  )}
                </div>
                    </>
                  )}
                      </div>
                    )}
            </div>

            {selectedTeam && (
            <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-medium text-gray-900">Activities</h3>
                <button 
                    onClick={() => setShowActivitiesChooser((s) => !s)}
                    className="px-3 py-1.5 rounded-md text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700"
                >
                    Add Activity
                </button>
                    </div>
                {showActivitiesChooser && (
                  <div className="mb-4 border border-gray-200 rounded-md divide-y">
                  <button
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                      onClick={() => { setIsMiniAudioOpen(true); setShowActivitiesChooser(false); }}
                    >
                      Mini Audiobooks
                  </button>
                    </div>
                )}
                {/* My Activity List */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">My Activity</h4>
                  {!activities?.length ? (
                    <p className="text-xs text-gray-500">No activities yet.</p>
                  ) : (
                    <ul className="space-y-2 max-h-64 overflow-auto pr-1">
                      {activities.map((a) => (
                        <li
                          key={a.id}
                          onClick={() => { setViewingActivity(a); setIsActivityOpen(true); }}
                          className="border border-gray-200 rounded-md p-2 cursor-pointer hover:bg-gray-50"
                        >
                          <div className="flex items-center justify-between">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-gray-900 truncate">{a.name || 'Audiobook'}</p>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-800">
                                  {(a.type || 'audiobook').toUpperCase()}
                                </span>
              </div>
                              <p className="text-xs text-gray-500 truncate">By {a.createdBy?.name || a.createdBy?.email || 'Unknown'}</p>
            </div>
          </div>
                          {a.transcript && (
                            <p className="mt-1 text-xs text-gray-600 line-clamp-3">{a.transcript}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
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
            <div className="relative bg-white rounded-xl shadow-xl max-w-xl w-full p-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-gray-900 truncate">{viewingActivity.name || 'Activity'}</h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-800">
                  {(viewingActivity.type || 'audiobook').toUpperCase()}
                        </span>
                      </div>
              {viewingActivity.url && (
                <audio controls className="w-full mb-3">
                  <source src={viewingActivity.url} />
                  Your browser does not support the audio element.
                </audio>
              )}
              {viewingActivity.transcript && (
                <div>
                  <p className="text-xs font-medium text-gray-700 mb-1">Transcript</p>
                  <div className="text-sm text-gray-800 whitespace-pre-wrap bg-gray-50 border border-gray-200 rounded p-3 max-h-64 overflow-auto">{viewingActivity.transcript}</div>
                    </div>
              )}
              <div className="mt-4 flex justify-end">
                <button onClick={() => setIsActivityOpen(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Close</button>
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