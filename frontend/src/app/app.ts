import { Component, OnInit, signal, computed, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AppIconComponent } from './icon';

interface Department {
  id: number;
  name: string;
  description: string;
  ipRange: string;
}

interface Device {
  ipAddress: string;
  deviceName: string;
  macAddress: string;
  department: Department | null;
}

interface Shortcut {
  id: number;
  name: string;
  url: string;
  icon: string;
  color: string;
  description: string;
  departmentId: number | null;
  departmentName: string;
  isLocked: boolean;
  isAccessible: boolean;
}

interface Announcement {
  id: number;
  title: string;
  content: string;
  priority: string; // info, success, warning, danger
  createdAt: string;
  departmentName: string;
}

interface DeviceLog {
  id?: number;
  deviceName: string;
  ipAddress: string;
  macAddress: string;
  action: string;
  timestamp: string;
  departmentName: string;
}

// Collaborative Workspace & Admin Interfaces
interface WorkspaceDocument {
  id?: number;
  title: string;
  content: string;
  ownerUsername: string;
  isPublic: boolean;
  createdDate?: string;
  modifiedDate?: string;
  isFile: boolean;
  fileUrl?: string;
  fileSize?: string;
  uploaderComment?: string;
  canEdit?: boolean;
  lockedBy?: string;
}

interface DocumentCollaborator {
  id?: number;
  documentId: number;
  collaboratorUsername: string;
  canEdit: boolean;
}

interface AdminApprovalRequest {
  id: number;
  requestedByUsername: string;
  title: string;
  description: string;
  isApproved: boolean;
  isPending: boolean;
  createdDate: string;
  actionedByUsername?: string;
  actionedDate?: string;
}

interface AdminUser {
  username: string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
}

interface PortalEvent {
  id: number;
  name: string;
  date: string;
  isStatic: boolean;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, AppIconComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:5100/api/portal'; // Dotnet Portal API URL
  private readonly authUrl = 'http://localhost:5100/api/auth'; // Dotnet Auth API URL
  private readonly workspaceUrl = 'http://localhost:5100/api/workspace'; // Dotnet Workspace API URL

  // Authentication State
  protected readonly isLoggedIn = signal<boolean>(false);
  protected readonly currentUser = signal<string | null>(null);
  protected readonly currentUserRole = signal<string | null>(null);
  protected readonly currentUserFullName = signal<string | null>(null);

  protected readonly authMode = signal<'login' | 'register' | 'forgot' | 'verify_otp'>('login');
  protected readonly authUsername = signal<string>('');
  protected readonly authPassword = signal<string>('');
  protected readonly authConfirmPassword = signal<string>('');
  protected readonly authFullName = signal<string>('');
  protected readonly authRole = signal<string>('HR Department'); // Default registering department (matches HR role)
  protected readonly authEmail = signal<string>('');
  protected readonly authPhone = signal<string>('');
  protected readonly rememberMe = signal<boolean>(false);

  // Password reset state
  protected readonly otpCode = signal<string>('');
  protected readonly newPassword = signal<string>('');
  protected readonly receivedOtp = signal<string>('');

  protected readonly authLoading = signal<boolean>(false);
  protected readonly authError = signal<string | null>(null);
  protected readonly authSuccess = signal<string | null>(null);

  // Profile Edit State
  protected readonly isProfileModalOpen = signal<boolean>(false);
  protected readonly profileFullName = signal<string>('');
  protected readonly profileEmail = signal<string>('');
  protected readonly profilePhone = signal<string>('');
  protected readonly profilePassword = signal<string>('');
  protected readonly profileBirthdate = signal<string>('');
  protected readonly isChangePasswordModalOpen = signal<boolean>(false);
  protected readonly profileOldPassword = signal<string>('');
  protected readonly profileNewPassword = signal<string>('');
  protected readonly profileConfirmNewPassword = signal<string>('');

  // General Portal State
  protected readonly device = signal<Device | null>(null);
  protected readonly shortcuts = signal<Shortcut[]>([]);
  protected readonly customShortcuts = signal<any[]>([]);
  protected readonly customShortcutTitle = signal<string>('');
  protected readonly customShortcutUrl = signal<string>('');
  protected readonly allShortcuts = computed(() => {
    return [...this.shortcuts(), ...this.customShortcuts()];
  });
  protected readonly announcements = signal<Announcement[]>([]);
  protected readonly recentLogs = signal<DeviceLog[]>([]);
  protected readonly loading = signal<boolean>(true);
  protected readonly error = signal<string | null>(null);

  // UI Navigation Tabs
  protected readonly activeTab = signal<'home' | 'workspace' | 'admin' | 'chat'>('home'); // Categorized top bar states
  protected readonly workspaceSubTab = signal<'dms' | 'notepad' | 'workspaces'>('dms');
  protected readonly activeUserSim = signal<'ahmet' | 'elif' | 'misafir'>('ahmet');
  protected readonly networkVpnMode = signal<'intranet' | 'extranet'>('intranet');
  protected readonly isSearchOpen = signal<boolean>(false); // Left search/launcher menu toggle
  protected readonly isEditShortcutsModalOpen = signal<boolean>(false);
  protected readonly announcementFilter = signal<'all' | 'dept'>('all'); // Announcement filters (all / department)

  // Context Menu States
  protected readonly contextMenuX = signal<number>(0);
  protected readonly contextMenuY = signal<number>(0);
  protected readonly contextMenuVisible = signal<boolean>(false);
  protected readonly contextMenuApp = signal<any | null>(null);

  // Floating Drawer States
  protected readonly isChatDrawerOpen = signal<boolean>(false);
  protected readonly isAnnouncementsDrawerOpen = signal<boolean>(false);

  // Cafeteria Lunch Menu (Yemek Menüsü)
  protected readonly lunchMenu = {
    Pazartesi: 'Mercimek Çorbası, İzmir Köfte, Pirinç Pilavı, Cacık',
    Sali: 'Yayla Çorbası, Tavuk Sote, Makarna, Kemalpaşa Tatlısı',
    Carsamba: 'Ezogelin Çorbası, Kuru Fasulye, Bulgur Pilavı, Turşu',
    Persembe: 'Tarhana Çorbası, Fırın Poşetinde Tavuk, Fırın Patates, Salata',
    Cuma: 'Düğün Çorbası, Kadınbudu Köfte, Erişte, Ayran'
  };

  // Events Calendar (Önemli Etkinlikler)
  protected readonly events = signal<PortalEvent[]>([
    { id: 1, name: 'Canan Hanım\'ın Doğum Günü', date: '2026-07-10', isStatic: true },
    { id: 2, name: 'Haftalık Eşgüdüm Toplantısı', date: '2026-07-12', isStatic: true },
    { id: 3, name: 'Sistem Bakım Çalışması', date: '2026-07-14', isStatic: true }
  ]);
  protected readonly personalEvents = signal<PortalEvent[]>([]);
  protected readonly newEventName = signal<string>('');
  protected readonly newEventDate = signal<string>('');
  protected readonly isAddEventFormOpen = signal<boolean>(false);

  // Dynamic Month Calendar State
  protected readonly currentYear = signal<number>(2026);
  protected readonly currentMonth = signal<number>(6); // 0-indexed, 6 = July
  protected readonly monthNames = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
  ];

  protected readonly calendarDays = computed(() => {
    const year = this.currentYear();
    const month = this.currentMonth();
    
    const firstDay = new Date(year, month, 1);
    const startDayOfWeek = firstDay.getDay();
    const startOffset = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
    const totalDays = new Date(year, month + 1, 0).getDate();
    
    const daysList: { dayNumber: number | null; isToday: boolean; hasEvent: boolean; eventTitle?: string }[] = [];
    
    for (let i = 0; i < startOffset; i++) {
      daysList.push({ dayNumber: null, isToday: false, hasEvent: false });
    }
    
    const today = new Date();
    const isCurrentMonthYearToday = today.getMonth() === month && today.getFullYear() === year;
    const todayDate = today.getDate();
    
    for (let d = 1; d <= totalDays; d++) {
      const isToday = isCurrentMonthYearToday && d === todayDate;
      let hasEvent = false;
      let eventTitle = '';
      
      // Check static events
      const staticEventMatch = this.events().find(ev => {
        const evDate = new Date(ev.date);
        return evDate.getFullYear() === year && evDate.getMonth() === month && evDate.getDate() === d;
      });
      
      // Check personal events
      const personalEventMatch = this.personalEvents().find(ev => {
        const evDate = new Date(ev.date);
        return evDate.getFullYear() === year && evDate.getMonth() === month && evDate.getDate() === d;
      });
      
      const match = staticEventMatch || personalEventMatch;
      if (match) {
        hasEvent = true;
        eventTitle = match.name;
      }
      
      daysList.push({
        dayNumber: d,
        isToday,
        hasEvent,
        eventTitle
      });
    }
    
    return daysList;
  });

  // Calendar Filtering State
  protected readonly selectedCalendarDate = signal<string | null>(null);

  protected readonly filteredStaticEvents = computed(() => {
    const selDate = this.selectedCalendarDate();
    if (!selDate) return this.events();
    return this.events().filter(ev => ev.date === selDate);
  });

  protected readonly filteredPersonalEvents = computed(() => {
    const selDate = this.selectedCalendarDate();
    if (!selDate) return this.personalEvents();
    return this.personalEvents().filter(ev => ev.date === selDate);
  });

  // Expandable Alphabetical Folder State
  protected readonly expandedFolders = signal<Record<string, boolean>>({});

  // Pinned / Favorite Apps State
  protected readonly pinnedShortcutIds = signal<number[]>([]);

  // Search and Filter Query (Windows Search Style)
  protected readonly searchQuery = signal<string>('');

  // Simulator State
  protected readonly isSimulatorOpen = signal<boolean>(false);
  protected readonly simulatedIp = signal<string>('192.168.1.15'); // Default to IT subnet
  protected readonly simulatedDeviceName = signal<string>('WORKSTATION-01');
  protected readonly simulatedMac = signal<string>('00-50-56-C0-00-08');

  // Notion-like Workspace State
  protected readonly documents = signal<WorkspaceDocument[]>([]);
  protected readonly activeDoc = signal<WorkspaceDocument | null>(null);
  protected readonly isCollaboratorModalOpen = signal<boolean>(false);
  protected readonly inviteUsername = signal<string>('');
  protected readonly inviteCanEdit = signal<boolean>(false);
  protected readonly collaborators = signal<DocumentCollaborator[]>([]);

  // Workspace Upload File State
  protected readonly newFileTitle = signal<string>('');
  protected readonly newFileUrl = signal<string>('');
  protected readonly newFileSize = signal<string>('');
  protected readonly newFileComment = signal<string>('');
  protected readonly isUploadPanelOpen = signal<boolean>(false);

  // DMS and Notepad sub-state
  protected readonly dmsFilter = signal<'all' | 'received' | 'sent' | 'public'>('all');
  protected readonly personalNotes = signal<{id: number, title: string, content: string, date: string}[]>([
    { id: 1, title: 'Pazartesi Planları', content: '1. IT şifre kasasının yedeklerini al.\n2. Elif ile bütçe dosyası hakkında görüş.', date: '08.07.2026 09:00' },
    { id: 2, title: 'Alınacaklar Listesi', content: '- Sunucu odası için yeni patch kabloları sipariş edilecek.\n- İK duyuru şablonu incelenecek.', date: '08.07.2026 10:15' }
  ]);
  protected readonly activeNoteId = signal<number>(1);
  protected readonly noteTitleInput = signal<string>('Pazartesi Planları');
  protected readonly noteContentInput = signal<string>('1. IT şifre kasasının yedeklerini al.\n2. Elif ile bütçe dosyası hakkında görüş.');
  protected readonly isNoteShareMenuOpen = signal<boolean>(false);

  // Collaborative Workspaces
  protected readonly workspaces = signal<{id: number, name: string, desc: string, notes: string, files: any[]}[]>([
    { id: 1, name: 'Yıl Sonu Bütçe Değerlendirme', desc: 'Muhasebe ve IT ortak planlama odası', notes: 'Proje kapsamında IT donanım harcamaları Muhasebe tarafından bu alandan takip edilecektir.', files: [{ name: 'IT_Donanim_Butcesi.xlsx', size: '1.4 MB' }] }
  ]);
  protected readonly isNewWorkspaceModalOpen = signal<boolean>(false);

  // Full Screen Dual Chat Contacts
  protected readonly chatContacts = signal<{username: string, fullName: string, role: string, online: boolean}[]>([
    { username: 'admin', fullName: 'Ahmet Karaca', role: 'Global Admin', online: true },
    { username: 'elif', fullName: 'Elif Yılmaz', role: 'Dept Admin', online: true },
    { username: 'ai_bot', fullName: 'PortalOne AI', role: 'Yapay Zeka Asistanı', online: true },
    { username: 'misafir', fullName: 'Yeni Kayıt (Ziyaretçi)', role: 'Ziyaretçi', online: false }
  ]);
  protected readonly activeChatUser = signal<{username: string, fullName: string, role: string, online: boolean} | null>({
    username: 'elif', fullName: 'Elif Yılmaz', role: 'Dept Admin', online: true
  });
  protected readonly fullChatInput = signal<string>('');
  protected readonly chatMessageSearchQuery = signal<string>('');

  // Admin tabs & config parameters
  protected readonly adminSubTab = signal<'users' | 'network' | 'logs' | 'home-edit'>('users');
  protected readonly adminSubnetInput = signal<string>('10.100.0.0/16');
  protected readonly adminMaxFileSize = signal<number>(50);
  protected readonly adminExtensions = signal<string>('.pdf, .docx, .xlsx, .png, .jpg');
  protected readonly homeImageUrl = signal<string>('https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=600&q=80');
  protected readonly homeHeadline = signal<string>('PortalOne Yenilenen Yüzüyle Yayında!');
  protected readonly homeDescription = signal<string>('Tüm departman belgelerinin, notların ve onay mekanizmalarının tek bir çatı altında yönetildiği yeni kurumsal portalımıza hoş geldiniz.');
  protected readonly logSearchUser = signal<string>('');
  protected readonly logSearchAction = signal<string>('');

  // Admin Workspace Management State
  protected readonly adminUsers = signal<AdminUser[]>([]);
  protected readonly approvalRequests = signal<AdminApprovalRequest[]>([]);

  // Chat State
  protected readonly chatInput = signal<string>('');
  protected readonly messages = signal<{sender: string, text: string, time: string, isSharedNote?: boolean, noteTitle?: string}[]>([
    { sender: 'Sistem Yöneticisi', text: 'Merhaba, portal üzerinden ilgili departman klasörlerine erişebilirsiniz.', time: '09:00' },
    { sender: 'hr_user', text: 'Dosyalar sekmesi üzerinden kişisel belgelerinizi yönetebilirsiniz.', time: '09:30' }
  ]);

  // Carousel News Slides
  protected readonly activeSlide = signal<number>(0);
  protected readonly slides = [
    {
      title: 'Şirket Portalı Güncellemesi Tamamlandı',
      description: 'Yenilenen ağ yapısı ve çalışma alanları sayesinde tüm verilere tek bir yerden erişebilirsiniz.',
      image: '/news_banner.png',
      tag: 'Duyurular'
    },
    {
      title: 'Siber Güvenlik Farkındalık Eğitimi',
      description: 'IT departmanı tarafından hazırlanan siber güvenlik modülünü Cuma gününe kadar tamamlamanız rica olunur.',
      image: '/news_banner.png',
      tag: 'Eğitimler'
    },
    {
      title: 'Yeni Hibrit Çalışma Alanları',
      description: '3. kattaki ortak çalışma odaları kullanıma açılmıştır. Rezervasyon modülünden yerinizi ayırtabilirsiniz.',
      image: '/news_banner.png',
      tag: 'Sosyal Alanlar'
    }
  ];

  // Turkish char case-insensitive conversion helper
  private normalizeTurkish(str: string): string {
    return str
      .replace(/I/g, 'ı')
      .replace(/İ/g, 'i')
      .replace(/Ş/g, 'ş')
      .replace(/Ç/g, 'ç')
      .replace(/Ğ/g, 'ğ')
      .replace(/Ü/g, 'ü')
      .replace(/Ö/g, 'ö')
      .toLowerCase();
  }

  // Dynamic filtered lists for Windows Search Menu with Turkish character normalization and typo tolerance
  protected readonly filteredShortcuts = computed(() => {
    const query = this.normalizeTurkish(this.searchQuery().trim());
    const list = this.allShortcuts();
    if (!query) return list;

    return list.filter(s => {
      const name = this.normalizeTurkish(s.name);
      const desc = this.normalizeTurkish(s.description);
      const dept = this.normalizeTurkish(s.departmentName);

      // 1. Partial contains check
      if (name.includes(query) || desc.includes(query) || dept.includes(query)) {
        return true;
      }

      // 2. Simple typo tolerance subsequence match
      let queryIdx = 0;
      for (let i = 0; i < name.length && queryIdx < query.length; i++) {
        if (name[i] === query[queryIdx]) {
          queryIdx++;
        }
      }
      return queryIdx === query.length;
    });
  });

  // Tab / Page map for navigation
  private readonly tabsList = [
    { name: 'Ana Sayfa', tab: 'home', subTab: null, description: 'Portal ana gösterge paneli ve araçları.' },
    { name: 'Dosyalar & Belgeler', tab: 'workspace', subTab: 'dms', description: 'Kurumsal dosya yöneticisi ve doküman havuzu.' },
    { name: 'Not Defteri', tab: 'workspace', subTab: 'notepad', description: 'Kişisel notlar ve taslak çalışmaları.' },
    { name: 'Ortak Çalışma Alanı', tab: 'workspace', subTab: 'workspaces', description: 'Proje çalışma odaları ve işbirlikleri.' },
    { name: 'Chat (Sohbet)', tab: 'chat', subTab: null, description: 'Çalışanlar arası sohbet ve kurumsal iletişim.' },
    { name: 'Yönetici Paneli', tab: 'admin', subTab: null, description: 'IT ve Sistem yönetici kontrol paneli.' }
  ];

  protected readonly unifiedSearchResults = computed(() => {
    const query = this.normalizeTurkish(this.searchQuery().trim());
    if (!query) {
      return { shortcuts: [], tabs: [], documents: [], users: [] };
    }

    // 1. Filter Shortcuts
    const filteredShortcuts = this.allShortcuts().filter(s => {
      const nameNorm = this.normalizeTurkish(s.name);
      const descNorm = this.normalizeTurkish(s.description || '');
      const deptNorm = this.normalizeTurkish(s.departmentName || '');
      return nameNorm.includes(query) || descNorm.includes(query) || deptNorm.includes(query);
    });

    // 2. Filter Tabs/Pages
    const filteredTabs = this.tabsList.filter(t => {
      const nameNorm = this.normalizeTurkish(t.name);
      const descNorm = this.normalizeTurkish(t.description);
      return nameNorm.includes(query) || descNorm.includes(query);
    });

    // 3. Filter Documents/Files
    const filteredDocs = this.documents().filter(d => {
      const titleNorm = this.normalizeTurkish(d.title);
      const contentNorm = this.normalizeTurkish(d.content || '');
      const commentNorm = this.normalizeTurkish(d.uploaderComment || '');
      return titleNorm.includes(query) || contentNorm.includes(query) || commentNorm.includes(query);
    });

    // 4. Filter Employees/Users (Combine database users and chatContacts)
    const allUsersList: { username: string, fullName: string, role: string }[] = [];
    
    // Add database users
    this.adminUsers().forEach(u => {
      allUsersList.push({
        username: u.username,
        fullName: u.fullName,
        role: u.role
      });
    });

    // Add frontend chat contacts if not already added
    this.chatContacts().forEach(c => {
      if (!allUsersList.some(u => u.username.toLowerCase() === c.username.toLowerCase())) {
        allUsersList.push({
          username: c.username,
          fullName: c.fullName,
          role: c.role
        });
      }
    });

    const filteredUsers = allUsersList.filter(u => {
      const nameNorm = this.normalizeTurkish(u.fullName || '');
      const usernameNorm = this.normalizeTurkish(u.username || '');
      const roleNorm = this.normalizeTurkish(u.role || '');
      return nameNorm.includes(query) || usernameNorm.includes(query) || roleNorm.includes(query);
    });

    return {
      shortcuts: filteredShortcuts,
      tabs: filteredTabs,
      documents: filteredDocs,
      users: filteredUsers
    };
  });

  protected handleTabResultClick(result: any) {
    this.activeTab.set(result.tab);
    if (result.subTab) {
      this.workspaceSubTab.set(result.subTab);
    }
    this.isSearchOpen.set(false);
  }

  protected handleDocResultClick(doc: any) {
    this.activeTab.set('workspace');
    this.workspaceSubTab.set('dms');
    this.selectDoc(doc);
    this.isSearchOpen.set(false);
  }

  protected handleUserResultClick(user: any) {
    this.activeTab.set('chat');
    this.selectChatUser({
      username: user.username,
      fullName: user.fullName || user.username,
      role: user.role || 'Çalışan',
      online: true
    });
    this.isSearchOpen.set(false);
  }

  // Groups shortcuts alphabetically for alphabetical list
  protected readonly alphabeticalShortcutsGrouped = computed(() => {
    const list = this.allShortcuts();
    const groups: Record<string, Shortcut[]> = {};
    list.forEach(s => {
      const char = s.name.charAt(0).toUpperCase();
      const key = (char >= 'A' && char <= 'Z') ? char : '#';
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });
    // Return sorted keys
    return Object.keys(groups).sort().map(key => ({
      key,
      items: groups[key]
    }));
  });

  // Filtered Announcements
  protected readonly filteredAnnouncements = computed(() => {
    const mode = this.announcementFilter();
    const list = this.announcements();
    if (mode === 'all') return list;
    
    // Filter announcements belonging to the active device's department
    const activeDept = this.device()?.department?.name;
    if (!activeDept) return [];
    return list.filter(a => a.departmentName.toLowerCase() === activeDept.toLowerCase());
  });

  protected readonly isAlertBannerVisible = signal<boolean>(true);

  ngOnInit() {
    // 1. Restore authenticated session
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('username');
    if (token && savedUser) {
      this.isLoggedIn.set(true);
      this.currentUser.set(savedUser);
      this.currentUserRole.set(localStorage.getItem('role'));
      this.currentUserFullName.set(localStorage.getItem('fullName'));
    }

    // 2. Restore rememberMe credentials
    const savedRememberMe = localStorage.getItem('rememberMe') === 'true';
    if (savedRememberMe) {
      this.rememberMe.set(true);
      this.authUsername.set(localStorage.getItem('rememberedUsername') || '');
      this.authPassword.set(localStorage.getItem('rememberedPassword') || '');
    }

    // 3. Restore Pinned Apps
    const savedPins = localStorage.getItem('pinnedApps');
    if (savedPins) {
      this.pinnedShortcutIds.set(JSON.parse(savedPins));
    }

    // Restore personal events
    const savedEvents = localStorage.getItem('personalEvents');
    if (savedEvents) {
      this.personalEvents.set(JSON.parse(savedEvents));
    }

    // Restore custom shortcuts
    const savedCustoms = localStorage.getItem('custom_shortcuts');
    if (savedCustoms) {
      this.customShortcuts.set(JSON.parse(savedCustoms));
    }

    this.loadProfile();

    // Auto slide carousel every 6 seconds
    setInterval(() => {
      this.nextSlide();
    }, 6000);
  }

  // Load Profile from Dotnet backend
  protected loadProfile(ip?: string) {
    this.loading.set(true);
    this.error.set(null);

    const queryIp = ip ?? this.simulatedIp();
    let url = `${this.apiUrl}/profile?ip=${queryIp}&deviceName=${this.simulatedDeviceName()}&macAddress=${this.simulatedMac()}`;
    
    const user = this.currentUser();
    if (user) {
      url += `&username=${encodeURIComponent(user)}`;
    }

    this.http.get<any>(url).subscribe({
      next: (res) => {
        this.device.set(res.device);
        this.shortcuts.set(res.shortcuts);
        this.announcements.set(res.announcements);
        this.recentLogs.set(res.recentLogs);
        
        this.simulatedIp.set(res.device.ipAddress);
        this.simulatedDeviceName.set(res.device.deviceName);
        this.simulatedMac.set(res.device.macAddress);
        
        // Auto load workspaces and admin data if user logged in
        if (this.isLoggedIn()) {
          this.loadDocuments();
          this.loadApprovals();
          this.loadAdminUsers();
        }

        this.loading.set(false);
        this.isAlertBannerVisible.set(true);
      },
      error: (err) => {
        console.error('Failed to load portal profile', err);
        this.error.set('Could not connect to the ASP.NET Web API backend. Make sure the server is running on localhost:5100.');
        this.loading.set(false);
      }
    });
  }

  // Event handlers
  protected addPersonalEvent() {
    if (!this.newEventName().trim() || !this.newEventDate().trim()) return;
    const newEv: PortalEvent = {
      id: Date.now(),
      name: this.newEventName().trim(),
      date: this.newEventDate().trim(),
      isStatic: false
    };
    this.personalEvents.update(curr => {
      const updated = [...curr, newEv];
      localStorage.setItem('personalEvents', JSON.stringify(updated));
      return updated;
    });
    this.newEventName.set('');
    this.newEventDate.set('');
  }

  protected removePersonalEvent(id: number) {
    this.personalEvents.update(curr => {
      const updated = curr.filter(e => e.id !== id);
      localStorage.setItem('personalEvents', JSON.stringify(updated));
      return updated;
    });
  }

  // Pin / Favorite app logic
  protected togglePinApp(id: number) {
    this.pinnedShortcutIds.update(current => {
      let updated: number[];
      if (current.includes(id)) {
        updated = current.filter(x => x !== id);
      } else {
        updated = [...current, id];
      }
      localStorage.setItem('pinnedApps', JSON.stringify(updated));
      return updated;
    });
  }

  protected isPinned(id: number): boolean {
    return this.pinnedShortcutIds().includes(id);
  }

  // Folder Collapse/Expand logic
  protected toggleFolder(name: string) {
    this.expandedFolders.update(current => ({
      ...current,
      [name]: !current[name]
    }));
  }

  protected isFolderExpanded(name: string): boolean {
    return !!this.expandedFolders()[name];
  }

  // Notion Workspaces Logic
  protected loadDocuments() {
    const user = this.currentUser() || '';
    this.http.get<WorkspaceDocument[]>(`${this.workspaceUrl}/documents?username=${encodeURIComponent(user)}`).subscribe({
      next: (res) => {
        this.documents.set(res);
        // Sync active document selection if any
        if (this.activeDoc()) {
          const matched = res.find(d => d.id === this.activeDoc()?.id);
          this.activeDoc.set(matched || null);
          if (matched) this.loadCollaborators(matched.id!);
        }
      }
    });
  }

  protected selectDoc(doc: WorkspaceDocument) {
    this.activeDoc.set(doc);
    if (doc.id) {
      this.loadCollaborators(doc.id);
    }
  }

  protected createNewDocument(isFile: boolean = false) {
    const user = this.currentUser() || 'Guest';
    const payload: WorkspaceDocument = isFile ? {
      title: this.newFileTitle() || 'Yeni Dosya Yüklemesi',
      content: `# Dosya Ek Açıklaması\n\n${this.newFileComment()}`,
      ownerUsername: user,
      isPublic: false,
      isFile: true,
      fileUrl: this.newFileUrl() || 'https://company.com/files/document.pdf',
      fileSize: this.newFileSize() || '2.4 MB',
      uploaderComment: this.newFileComment() || 'Kullanıcı tarafından kurumsal çalışma alanına eklendi.'
    } : {
      title: 'Yeni Çalışma Sayfası',
      content: '# Yeni Not\n\nBuraya çalışma detaylarını giriniz...',
      ownerUsername: user,
      isPublic: false,
      isFile: false
    };

    this.http.post<WorkspaceDocument>(`${this.workspaceUrl}/documents`, payload).subscribe({
      next: (res) => {
        this.loadDocuments();
        this.selectDoc(res);
        this.newFileTitle.set('');
        this.newFileUrl.set('');
        this.newFileSize.set('');
        this.newFileComment.set('');
        this.isUploadPanelOpen.set(false);
      }
    });
  }

  protected saveActiveDocument() {
    const doc = this.activeDoc();
    const user = this.currentUser();
    if (!doc || !doc.id || !user) return;

    this.http.put<WorkspaceDocument>(`${this.workspaceUrl}/documents/${doc.id}?username=${encodeURIComponent(user)}`, doc).subscribe({
      next: (res) => {
        this.loadDocuments();
        alert('Sayfa başarıyla kaydedildi.');
      },
      error: (err) => {
        alert(err.error || 'Kaydetme yetkiniz yok veya hata oluştu.');
      }
    });
  }

  protected deleteActiveDocument() {
    const doc = this.activeDoc();
    const user = this.currentUser();
    if (!doc || !doc.id || !user) return;

    if (confirm('Bu çalışma alanını kalıcı olarak silmek istediğinize emin misiniz?')) {
      this.http.delete<any>(`${this.workspaceUrl}/documents/${doc.id}?username=${encodeURIComponent(user)}`).subscribe({
        next: () => {
          this.activeDoc.set(null);
          this.loadDocuments();
        },
        error: (err) => {
          alert(err.error || 'Silme yetkiniz yok.');
        }
      });
    }
  }

  // Collaborators Invitations
  protected loadCollaborators(docId: number) {
    this.http.get<DocumentCollaborator[]>(`${this.workspaceUrl}/documents/${docId}/collaborators`).subscribe({
      next: (res) => {
        this.collaborators.set(res);
      }
    });
  }

  protected inviteUser() {
    const doc = this.activeDoc();
    if (!doc || !doc.id || !this.inviteUsername().trim()) return;

    const payload: DocumentCollaborator = {
      documentId: doc.id,
      collaboratorUsername: this.inviteUsername().trim(),
      canEdit: this.inviteCanEdit()
    };

    this.http.post<any>(`${this.workspaceUrl}/documents/${doc.id}/collaborator`, payload).subscribe({
      next: () => {
        this.loadCollaborators(doc.id!);
        this.inviteUsername.set('');
        this.inviteCanEdit.set(false);
      },
      error: (err) => {
        alert(err.error || 'Davet gönderilemedi.');
      }
    });
  }

  protected removeCollaborator(username: string) {
    const doc = this.activeDoc();
    if (!doc || !doc.id) return;

    this.http.delete<any>(`${this.workspaceUrl}/documents/${doc.id}/collaborator/${encodeURIComponent(username)}`).subscribe({
      next: () => {
        this.loadCollaborators(doc.id!);
      }
    });
  }

  // Admin User & Roles management
  protected loadAdminUsers() {
    this.http.get<AdminUser[]>(`${this.apiUrl}/admin/users`).subscribe({
      next: (res) => {
        this.adminUsers.set(res);
      }
    });
  }

  protected changeUserRole(username: string, role: string) {
    this.http.put<any>(`${this.apiUrl}/admin/users/${encodeURIComponent(username)}/role?role=${encodeURIComponent(role)}`, {}).subscribe({
      next: () => {
        this.loadAdminUsers();
        // If current user is active device subnet, re-sync permissions
        if (this.currentUser()?.toLowerCase() === username.toLowerCase()) {
          this.currentUserRole.set(role);
          localStorage.setItem('role', role);
          this.loadProfile();
        }
      }
    });
  }

  // Admin Approval Requests
  protected loadApprovals() {
    this.http.get<AdminApprovalRequest[]>(`${this.workspaceUrl}/approvals`).subscribe({
      next: (res) => {
        this.approvalRequests.set(res);
      }
    });
  }

  protected actionApproval(id: number, approved: boolean) {
    const admin = this.currentUser();
    if (!admin) return;

    this.http.post<any>(`${this.workspaceUrl}/approvals/${id}/action?username=${encodeURIComponent(admin)}&approved=${approved}`, {}).subscribe({
      next: () => {
        this.loadApprovals();
        this.loadProfile(); // Reload logs
      }
    });
  }

  // Send Chat Message with mock automated bot replies
  protected sendChatMessage() {
    if (!this.chatInput().trim()) return;
    const text = this.chatInput().trim();
    const time = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    const user = this.currentUserFullName() || this.currentUser() || 'User';

    this.messages.update(current => [...current, { sender: user, text, time }]);
    this.chatInput.set('');

    // Mock response after 1 second
    setTimeout(() => {
      let reply = 'Sorunuzu aldım, en kısa sürede dönüş sağlayacağım.';
      const normalizedText = this.normalizeTurkish(text);
      if (normalizedText.includes('merhaba') || normalizedText.includes('selam')) {
        reply = 'Selam! Nasıl yardımcı olabilirim?';
      } else if (normalizedText.includes('dosya') || normalizedText.includes('belge')) {
        reply = 'İlgili belgelere üst menüden Dosyalar & Belgeler kısmından ulaşabilirsiniz.';
      } else if (normalizedText.includes('profil') || normalizedText.includes('şifre')) {
        reply = 'Profil bilgilerinizi güncellemek için sağ üstteki isminize tıklayabilirsiniz.';
      }
      this.messages.update(current => [...current, { sender: 'Kurumsal Destek Botu', text: reply, time }]);
    }, 1000);
  }

  // Open profile editor dialog
  protected openProfileModal() {
    this.profileFullName.set(this.currentUserFullName() || '');
    this.profileEmail.set(localStorage.getItem('email') || '');
    this.profilePhone.set(localStorage.getItem('phoneNumber') || '');
    this.profileBirthdate.set(localStorage.getItem('birthdate') || '');
    this.profilePassword.set('');
    this.isProfileModalOpen.set(true);
  }

  // Submit profile updates to backend
  protected saveProfileSettings() {
    const username = this.currentUser();
    if (!username) return;

    const payload = {
      username: username,
      fullName: this.profileFullName(),
      email: this.profileEmail(),
      phoneNumber: this.profilePhone(),
      newPassword: this.profilePassword() || null
    };

    this.http.post<any>(`${this.authUrl}/update-profile`, payload).subscribe({
      next: (res) => {
        localStorage.setItem('fullName', res.fullName);
        localStorage.setItem('birthdate', this.profileBirthdate());
        this.currentUserFullName.set(res.fullName);
        alert('Profil bilgileri başarıyla güncellendi!');
        this.isProfileModalOpen.set(false);
        this.loadProfile();
      },
      error: (err) => {
        alert(err.error || 'Profil güncellenirken hata oluştu.');
      }
    });
  }

  protected openChangePasswordModal() {
    this.profileOldPassword.set('');
    this.profileNewPassword.set('');
    this.profileConfirmNewPassword.set('');
    this.isProfileModalOpen.set(false);
    this.isChangePasswordModalOpen.set(true);
  }

  protected changePassword() {
    const oldPass = this.profileOldPassword().trim();
    const newPass = this.profileNewPassword().trim();
    const confirmPass = this.profileConfirmNewPassword().trim();

    if (!oldPass || !newPass || !confirmPass) {
      alert('Lütfen tüm alanları doldurun.');
      return;
    }

    if (newPass !== confirmPass) {
      alert('Yeni şifre ve şifre tekrarı uyuşmuyor.');
      return;
    }

    if (oldPass === newPass) {
      alert('Yeni şifreniz eski şifrenizle aynı olamaz.');
      return;
    }

    if (newPass.length < 6) {
      alert('Yeni şifreniz en az 6 karakter olmalıdır.');
      return;
    }

    const payload = {
      username: this.currentUser(),
      oldPassword: oldPass,
      newPassword: newPass
    };

    this.http.post<any>(`${this.authUrl}/change-password`, payload).subscribe({
      next: (res) => {
        alert('Şifreniz başarıyla güncellendi!');
        this.isChangePasswordModalOpen.set(false);
        this.isProfileModalOpen.set(true);
      },
      error: (err) => {
        alert(err.error?.error || 'Şifre güncellenirken bir hata oluştu.');
      }
    });
  }

  // Authentication Handlers
  protected toggleAuthMode() {
    this.authMode.update(mode => {
      if (mode === 'login') return 'register';
      return 'login';
    });
    this.authError.set(null);
    this.authSuccess.set(null);
  }

  protected switchAuthMode(mode: 'login' | 'register' | 'forgot' | 'verify_otp') {
    this.authMode.set(mode);
    this.authError.set(null);
    this.authSuccess.set(null);
  }

  protected handleAuthSubmit() {
    const mode = this.authMode();
    if (mode === 'login') {
      this.executeLogin();
    } else if (mode === 'register') {
      this.executeRegister();
    }
  }

  private executeLogin() {
    if (!this.authUsername().trim() || !this.authPassword().trim()) {
      this.authError.set('Lütfen kullanıcı adı ve şifre giriniz.');
      return;
    }

    this.authLoading.set(true);
    this.authError.set(null);

    const payload = {
      username: this.authUsername(),
      password: this.authPassword()
    };

    this.http.post<any>(`${this.authUrl}/login`, payload).subscribe({
      next: (res) => {
        this.authLoading.set(false);
        if (res.success) {
          localStorage.setItem('token', res.token);
          localStorage.setItem('username', res.username);
          localStorage.setItem('role', res.role);
          localStorage.setItem('fullName', res.fullName);

          this.isLoggedIn.set(true);
          this.currentUser.set(res.username);
          this.currentUserRole.set(res.role);
          this.currentUserFullName.set(res.fullName);

          if (this.rememberMe()) {
            localStorage.setItem('rememberMe', 'true');
            localStorage.setItem('rememberedUsername', this.authUsername());
            localStorage.setItem('rememberedPassword', this.authPassword());
          } else {
            localStorage.removeItem('rememberMe');
            localStorage.removeItem('rememberedUsername');
            localStorage.removeItem('rememberedPassword');
          }

          this.authSuccess.set('Başarıyla giriş yapıldı!');
          this.loadProfile();
        }
      },
      error: (err) => {
        this.authLoading.set(false);
        this.authError.set(err.error?.error || 'Geçersiz kullanıcı adı veya şifre.');
      }
    });
  }

  private executeRegister() {
    if (!this.authUsername().trim() || !this.authPassword().trim() || !this.authConfirmPassword().trim()) {
      this.authError.set('Lütfen kullanıcı adı ve şifre alanlarını doldurun.');
      return;
    }

    if (this.authPassword() !== this.authConfirmPassword()) {
      this.authError.set('Şifreler eşleşmiyor.');
      return;
    }

    this.authLoading.set(true);
    this.authError.set(null);

    const payload = {
      username: this.authUsername(),
      password: this.authPassword(),
      email: this.authEmail()
    };

    this.http.post<any>(`${this.authUrl}/register`, payload).subscribe({
      next: () => {
        this.authLoading.set(false);
        this.authSuccess.set('Hesap başarıyla oluşturuldu! Giriş yapabilirsiniz.');
        setTimeout(() => {
          this.authMode.set('login');
          this.authPassword.set('');
        }, 2000);
      },
      error: (err) => {
        this.authLoading.set(false);
        this.authError.set(err.error?.error || 'Kayıt başarısız. Kullanıcı adı alınmış olabilir.');
      }
    });
  }

  protected executeResetRequest() {
    if (!this.authUsername().trim() || !this.authEmail().trim()) {
      this.authError.set('Kullanıcı adı ve e-posta zorunludur.');
      return;
    }

    this.authLoading.set(true);
    this.authError.set(null);

    const payload = {
      username: this.authUsername(),
      email: this.authEmail()
    };

    this.http.post<any>(`${this.authUrl}/reset-password/request`, payload).subscribe({
      next: (res) => {
        this.authLoading.set(false);
        this.receivedOtp.set(res.otpCode);
        this.authSuccess.set(`Doğrulama kodu oluşturuldu! Kod: ${res.otpCode}`);
        setTimeout(() => {
          this.authMode.set('verify_otp');
        }, 2000);
      },
      error: (err) => {
        this.authLoading.set(false);
        this.authError.set(err.error?.error || 'Kullanıcı adı veya e-posta eşleşmiyor.');
      }
    });
  }

  protected executeResetVerify() {
    if (!this.authUsername().trim() || !this.otpCode().trim() || !this.newPassword().trim()) {
      this.authError.set('Tüm alanlar zorunludur.');
      return;
    }

    this.authLoading.set(true);
    this.authError.set(null);

    const payload = {
      username: this.authUsername(),
      otpCode: this.otpCode(),
      newPassword: this.newPassword()
    };

    this.http.post<any>(`${this.authUrl}/reset-password/verify`, payload).subscribe({
      next: () => {
        this.authLoading.set(false);
        this.authSuccess.set('Şifreniz başarıyla sıfırlandı! Giriş yapabilirsiniz.');
        setTimeout(() => {
          this.authMode.set('login');
          this.authPassword.set('');
          this.otpCode.set('');
          this.newPassword.set('');
          this.receivedOtp.set('');
        }, 2000);
      },
      error: (err) => {
        this.authLoading.set(false);
        this.authError.set(err.error?.error || 'Doğrulama kodu hatalı veya süresi geçmiş.');
      }
    });
  }

  protected logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    localStorage.removeItem('fullName');
    
    this.isLoggedIn.set(false);
    this.currentUser.set(null);
    this.currentUserRole.set(null);
    this.currentUserFullName.set(null);
    
    this.activeTab.set('home');
    this.isProfileModalOpen.set(false);
    this.isChatDrawerOpen.set(false);
    this.isAnnouncementsDrawerOpen.set(false);
    this.loadProfile();
  }

  // Preset IP in simulator
  protected setPresetIp(ip: string) {
    this.simulatedIp.set(ip);
    this.applySimulation();
  }

  // Apply Simulation
  protected applySimulation() {
    this.loadProfile(this.simulatedIp());
    this.isSimulatorOpen.set(false);
  }

  protected onActiveUserSimChange(user: 'ahmet' | 'elif' | 'misafir') {
    this.activeUserSim.set(user);
    if (user === 'ahmet') {
      localStorage.setItem('username', 'admin');
      localStorage.setItem('role', 'Admin');
      localStorage.setItem('fullName', 'Ahmet (Global Admin)');
      this.currentUser.set('admin');
      this.currentUserRole.set('Admin');
      this.currentUserFullName.set('Ahmet (Global Admin)');
    } else if (user === 'elif') {
      localStorage.setItem('username', 'elif');
      localStorage.setItem('role', 'Finance Department');
      localStorage.setItem('fullName', 'Elif (Muhasebe Dept Admin)');
      this.currentUser.set('elif');
      this.currentUserRole.set('Finance Department');
      this.currentUserFullName.set('Elif (Muhasebe Dept Admin)');
    } else if (user === 'misafir') {
      localStorage.setItem('username', 'misafir');
      localStorage.setItem('role', 'Guest');
      localStorage.setItem('fullName', 'Misafir (Ziyaretçi)');
      this.currentUser.set('misafir');
      this.currentUserRole.set('Guest');
      this.currentUserFullName.set('Misafir (Ziyaretçi)');
    }
    this.loadProfile();
  }

  protected onNetworkModeChange(mode: 'intranet' | 'extranet') {
    this.networkVpnMode.set(mode);
    if (mode === 'extranet') {
      // Extranet locks IT and Accounting critical shortcuts
      this.shortcuts.update(list => list.map(s => {
        const nameLower = s.name.toLowerCase();
        const isCritical = nameLower.includes('şifre') || 
                           nameLower.includes('bütçe') || 
                           nameLower.includes('admin') || 
                           nameLower.includes('sunucu') ||
                           nameLower.includes('veritabanı') ||
                           nameLower.includes('database');
        if (isCritical) {
          return { ...s, isAccessible: false, isLocked: true };
        }
        return s;
      }));
    } else {
      // Intranet restores normal accessibility
      this.loadProfile();
    }
  }

  protected filteredFiles() {
    const filter = this.dmsFilter();
    const user = this.currentUser();
    const list = this.documents();
    if (filter === 'received') {
      return list.filter(d => d.ownerUsername.toLowerCase() !== user?.toLowerCase());
    }
    if (filter === 'sent') {
      return list.filter(d => d.ownerUsername.toLowerCase() === user?.toLowerCase());
    }
    if (filter === 'public') {
      return list.filter(d => d.isPublic);
    }
    return list;
  }

  protected lockDocument(doc: WorkspaceDocument) {
    doc.lockedBy = this.currentUserFullName() || this.currentUser() || 'User';
    alert(`"${doc.title}" belgesi düzenleme için kilitlendi (Check-Out).`);
  }

  protected unlockDocument(doc: WorkspaceDocument) {
    doc.lockedBy = undefined;
    alert(`"${doc.title}" belgesinin kilidi açıldı (Check-In).`);
  }

  protected openVersionHistory(doc: WorkspaceDocument) {
    alert(`"${doc.title}" Sürüm Geçmişi:\nv1.0 - 2026-07-08 (Oluşturan: ${doc.ownerUsername}) - İlk Sürüm`);
  }

  protected deleteActiveDocumentDirect(doc: WorkspaceDocument) {
    if (confirm(`"${doc.title}" belgesini silmek istediğinize emin misiniz?`)) {
      this.http.delete<any>(`${this.workspaceUrl}/documents/${doc.id}?username=${encodeURIComponent(this.currentUser() || '')}`).subscribe({
        next: () => {
          this.loadDocuments();
          alert('Belge başarıyla silindi.');
        },
        error: (err) => {
          alert(err.error || 'Silme yetkiniz yok.');
        }
      });
    }
  }

  protected selectNote(note: any) {
    this.activeNoteId.set(note.id);
    this.noteTitleInput.set(note.title);
    this.noteContentInput.set(note.content);
  }

  protected createNewNote() {
    const newId = this.personalNotes().length + 1;
    const newNote = {
      id: newId,
      title: 'Yeni Not',
      content: '',
      date: new Date().toLocaleString('tr-TR').slice(0, 16)
    };
    this.personalNotes.update(list => [...list, newNote]);
    this.selectNote(newNote);
  }

  protected saveNote() {
    this.personalNotes.update(list => list.map(n => {
      if (n.id === this.activeNoteId()) {
        return {
          ...n,
          title: this.noteTitleInput(),
          content: this.noteContentInput(),
          date: new Date().toLocaleString('tr-TR').slice(0, 16)
        };
      }
      return n;
    }));
    alert('Not başarıyla kaydedildi.');
  }

  protected shareNoteInChat() {
    const activeUser = this.activeChatUser();
    if (!activeUser) {
      alert('Lütfen paylaşmak için sohbetten bir arkadaş seçin.');
      return;
    }
    const note = this.personalNotes().find(n => n.id === this.activeNoteId());
    if (!note) return;

    const payload = {
      sender: this.currentUser() || 'admin',
      text: `Sizinle bir not paylaştı: "${note.title}"`,
      time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      isSharedNote: true,
      noteTitle: note.title
    };

    // Add to messages signal
    this.messages.update(list => [...list, payload]);
    this.isNoteShareMenuOpen.set(false);
    alert(`"${note.title}" notu sohbet üzerinden ${activeUser.fullName} ile paylaşıldı.`);
  }

  protected copyNoteLink() {
    const note = this.personalNotes().find(n => n.id === this.activeNoteId());
    if (!note) return;
    const url = `http://localhost:4400/share/note/${note.id}`;
    navigator.clipboard.writeText(url);
    this.isNoteShareMenuOpen.set(false);
    alert('Not paylaşım bağlantısı panoya kopyalandı.');
  }

  protected openWorkspaceDetail(ws: any) {
    alert(`Çalışma Odası: ${ws.name}\nAçıklama: ${ws.desc}\nOrtak Notlar: ${ws.notes}`);
  }

  protected createNewWorkspace() {
    const name = prompt('Ortak Çalışma Grubu Adı:');
    if (!name) return;
    const desc = prompt('Açıklama:');
    const newWs = {
      id: this.workspaces().length + 1,
      name: name,
      desc: desc || '',
      notes: 'Ortak notlar...',
      files: []
    };
    this.workspaces.update(list => [...list, newWs]);
    alert('Yeni ortak çalışma alanı başarıyla açıldı.');
  }

  protected selectChatUser(usr: any) {
    this.activeChatUser.set(usr);
  }

  protected sendFullChatMessage() {
    const input = this.fullChatInput().trim();
    if (!input) return;

    const user = this.currentUser() || 'admin';
    const payload = {
      sender: user,
      text: input,
      time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      isSharedNote: false,
      noteTitle: ''
    };

    this.messages.update(list => [...list, payload]);
    this.fullChatInput.set('');
    this.chatMessageSearchQuery.set(''); // Clear search filter when sending message

    // Simulate reply after 1 second
    setTimeout(() => {
      let replyText = 'Sorunuzu aldım, en kısa sürede dönüş sağlayacağım.';
      const activeUser = this.activeChatUser();

      if (activeUser?.username === 'ai_bot') {
        const normInput = this.normalizeTurkish(input);
        
        // 1. Files / Documents queries
        if (normInput.includes('dosya') || normInput.includes('belge') || normInput.includes('dokuman') || normInput.includes('yükle') || normInput.includes('dms')) {
          const docList = this.documents();
          if (docList.length > 0) {
            const docNames = docList.map((d, i) => `${i + 1}. ${d.title} (${d.fileSize || 'Belge'})`).join('\n');
            replyText = `Sistemde kayıtlı güncel dosyalar şunlardır:\n${docNames}\n\nBu dosyalara üst menüdeki "Dosyalar & Belgeler" sekmesinden veya sol aramadan erişebilirsiniz.`;
          } else {
            replyText = 'Sistemde şu an yüklü bir dosya bulunmamaktadır.';
          }
        }
        // 2. Users / Employees queries
        else if (normInput.includes('calisan') || normInput.includes('uye') || normInput.includes('kullanici') || normInput.includes('kimler var') || normInput.includes('personel')) {
          const userList = this.adminUsers();
          if (userList.length > 0) {
            const userNames = userList.map((u, i) => `${i + 1}. ${u.fullName} (@${u.username}) - ${u.role}`).join('\n');
            replyText = `Sistemde kayıtlı çalışma arkadaşlarımız şunlardır:\n${userNames}\n\nBu kişilerle sohbete başlamak için sol aramada isimlerini aratabilirsiniz.`;
          } else {
            replyText = 'Sistemde kayıtlı kullanıcı bulunamadı.';
          }
        }
        // 3. Network / Subnet / IP queries
        else if (normInput.includes('ip') || normInput.includes('subnet') || normInput.includes('baglanti') || normInput.includes('ag durum') || normInput.includes('vpn') || normInput.includes('network')) {
          const dev = this.device();
          if (dev) {
            replyText = `Şu anki simüle edilen bağlantı bilgileriniz:\n- IP Adresi: ${dev.ipAddress}\n- Subnet/Departman: ${dev.department?.name || 'Bilinmiyor'}\n- Cihaz Adı: ${dev.deviceName}\n- MAC Adresi: ${dev.macAddress}\n\nBu bilgileri sağ üstteki ağ durum simgesine tıklayıp Simülatörden güncelleyebilirsiniz.`;
          } else {
            replyText = 'Bağlantı bilgileriniz yüklenemedi.';
          }
        }
        // 4. Pinned shortcuts / Tools queries
        else if (normInput.includes('arac') || normInput.includes('kisayol') || normInput.includes('tool') || normInput.includes('uygulama') || normInput.includes('gmail')) {
          const shortcutList = this.allShortcuts();
          if (shortcutList.length > 0) {
            const shortcutsNames = shortcutList.map((s, i) => `${i + 1}. ${s.name} (${s.departmentId ? 'Departmana Özel' : 'Genel'})`).join('\n');
            replyText = `Sistemde erişilebilir olan kurumsal araçlar şunlardır:\n${shortcutsNames}\n\nYeni bir araç eklemek veya kısayolları düzenlemek için ana sayfadaki "Kısayollarımı Düzenle" (Düzenle) modalını kullanabilirsiniz.`;
          } else {
            replyText = 'Erişilebilir kısayol bulunamadı.';
          }
        }
        // 5. Notepad / personal notes queries
        else if (normInput.includes('notlar') || normInput.includes('notum') || normInput.includes('not defter') || normInput.includes('taslak')) {
          const notesList = this.personalNotes();
          if (notesList.length > 0) {
            const noteNames = notesList.map((n, i) => `${i + 1}. ${n.title} (${n.date})`).join('\n');
            replyText = `Not defterinizde kayıtlı notlarınız:\n${noteNames}\n\nNotlarınızı düzenlemek veya yeni not eklemek için "Dosyalar & Belgeler -> Not Defteri" sekmesini ziyaret edebilirsiniz.`;
          } else {
            replyText = 'Not defterinizde henüz kayıtlı bir not bulunmamaktadır.';
          }
        }
        // 6. Announcements queries
        else if (normInput.includes('duyuru') || normInput.includes('ilan') || normInput.includes('haber') || normInput.includes('megafon')) {
          const annList = this.announcements();
          if (annList.length > 0) {
            const annNames = annList.map((a, i) => `${i + 1}. ${a.title} (${a.departmentName || 'Genel'})`).join('\n');
            replyText = `Departmanınıza özel ve genel aktif duyurular şunlardır:\n${annNames}\n\nDuyuruların detaylarına sağ alt köşedeki megafon simgesine 📢 tıklayarak ulaşabilirsiniz.`;
          } else {
            replyText = 'Şu an aktif bir duyuru bulunmamaktadır.';
          }
        }
        // 7. Password change queries
        else if (normInput.includes('sifre') || normInput.includes('parola') || normInput.includes('yenile')) {
          replyText = 'Şifrenizi değiştirmek veya güncellemek için sağ üst köşedeki profil isminize tıklayıp açılan modal pencereden "Şifremi Değiştirmek İstiyorum" butonunu kullanabilirsiniz.';
        }
        // 7.5 Location and Navigation queries
        else if (normInput.includes('nerede') || normInput.includes('yeri') || normInput.includes('nasil ulasirim') || normInput.includes('nasil giderim') || normInput.includes('nereden')) {
          if (normInput.includes('dosya') || normInput.includes('belge') || normInput.includes('yukle') || normInput.includes('ekle') || normInput.includes('dms')) {
            replyText = 'Dosya yükleme ve yönetimi işlemleri için:\n1. Üst menüden "Dosyalar & Belgeler" sekmesine tıklayın.\n2. Sol menüden "Dosya Yöneticisi" veya "Doküman Havuzu" alt başlığına geçin.\n3. Dosya eklemek için sağ üst taraftaki mavi "Yeni Dosya Ekle" butonunu kullanabilirsiniz.';
          } else if (normInput.includes('not') || normInput.includes('defter') || normInput.includes('taslak')) {
            replyText = 'Not Defterine ulaşmak için:\n1. Üst menüden "Dosyalar & Belgeler" sekmesine gidin.\n2. Sol menüden "Not Defteri" alt başlığını seçin.\n3. Buradan yeni kişisel notlar oluşturabilir, bunları kaydedebilir ve sohbetteki arkadaşlarınızla paylaşabilirsiniz.';
          } else if (normInput.includes('simulat') || normInput.includes('ag') || normInput.includes('ip') || normInput.includes('vpn') || normInput.includes('subnet')) {
            replyText = 'Ağ ve VPN Altyapı Simülatörüne gitmek için:\n- Sayfanın sağ üst köşesinde bulunan, yeşil noktalı IP adresinizin yazılı olduğu "Ağ Durum Rozeti"ne tıklamanız yeterlidir. Açılan simülatör panelinden intranet/extranet ayarlarını yapabilirsiniz.';
          } else if (normInput.includes('profil') || normInput.includes('sifre') || normInput.includes('parola') || normInput.includes('kullanici')) {
            replyText = 'Profil ayarları ve şifre değiştirme ekranı için:\n- Sayfanın en sağ üst köşesinde yer alan aktif kullanıcı simülatörünün hemen yanındaki kullanıcı adınıza tıklayarak kişisel bilgilerinizi güncelleyebilir veya şifre sıfırlama talebi gönderebilirsiniz.';
          } else if (normInput.includes('takvim') || normInput.includes('etkinlik') || normInput.includes('ajanda') || normInput.includes('plan')) {
            replyText = 'Takvim ve Ajanda özellikleri için:\n- Üst menüden "Ana Sayfa" sekmesine tıklayın.\n- Sayfanın sağ kolonunda yer alan takvimi göreceksiniz. Günlere tıklayarak etkinlik ekleyebilir ya da filtreleme yapabilirsiniz.';
          } else if (normInput.includes('admin') || normInput.includes('yonetici') || normInput.includes('onay')) {
            replyText = 'Yönetici Kontrol Paneli için:\n- Üst menünün en sağında yer alan "Yönetici Paneli" sekmesine tıklayın. Buradan ağ güvenliği limitlerini değiştirebilir, logları izleyebilir veya onay bekleyen belgeleri onaylayabilirsiniz (Sadece Admin yetkisiyle görünür).';
          } else if (normInput.includes('duyuru') || normInput.includes('megafon') || normInput.includes('ilan')) {
            replyText = 'Duyurular paneli için:\n- Sayfanın sağ alt köşesindeki reaktif megafon simgesine 📢 tıklayarak genel ve departman bazlı en son duyuruları içeren sağa kayan paneli (drawer) açabilirsiniz.';
          } else if (normInput.includes('chat') || normInput.includes('sohbet') || normInput.includes('destek')) {
            replyText = 'Sohbet özellikleri sistemde iki farklı yerdedir:\n1. Üst menüdeki "Chat (Sohbet)" sekmesinden geniş ekran mesajlaşma paneline ulaşabilirsiniz.\n2. Sağ alt köşedeki sohbet balonu simgesine tıklayarak hızlı destek botunu kayar panel olarak açabilirsiniz.';
          } else {
            replyText = 'Sistemdeki hangi özelliğin yerini öğrenmek istiyorsunuz? Bana "dosya yükleme nerede", "not defteri nerede", "simülatör nerede", "profil nerede" veya "takvim nerede" gibi sorular sorabilirsiniz.';
          }
        }
        // 8. General hello / intro
        else if (normInput.includes('merhaba') || normInput.includes('selam')) {
          replyText = 'Merhaba! Ben PortalOne yapay zeka asistanıyım. Sistemdeki dosyalar, çalışanlar, notlar, duyurular, ağ bağlantınız veya kurulu uygulamalar hakkında bana dilediğiniz soruyu sorabilirsiniz.';
        }
        // 9. Default fallback
        else {
          replyText = `Sorduğunuz "${input}" konusuna dair sistemde reaktif bir eşleşme bulamadım. Ancak bana "dosyalar", "çalışanlar", "IP adresim", "notlarım", "duyurular" veya "araçlar" yazarak sistemdeki güncel canlı verileri listelememi isteyebilirsiniz.`;
        }
      }

      const reply = {
        sender: activeUser?.username || 'elif',
        text: replyText,
        time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        isSharedNote: false,
        noteTitle: ''
      };
      this.messages.update(list => [...list, reply]);
    }, 1000);
  }

  protected filteredChatMessages() {
    const list = this.messages();
    const query = this.normalizeTurkish(this.chatMessageSearchQuery().trim());
    if (!query) return list;

    return list.filter(msg => {
      const textNorm = this.normalizeTurkish(msg.text || '');
      const senderNorm = this.normalizeTurkish(msg.sender || '');
      return textNorm.includes(query) || senderNorm.includes(query);
    });
  }

  protected updateHomePageInfo() {
    alert('Ana sayfa manşet paneli güncellendi!');
  }

  protected saveAdminSettings() {
    alert('Ağ güvenliği ve dosya yükleme limitleri başarıyla kaydedildi.');
  }

  protected filteredLogs() {
    const userQ = this.logSearchUser().toLowerCase();
    const actionQ = this.logSearchAction().toLowerCase();
    return this.recentLogs().filter(log => {
      const nameMatch = !userQ || log.deviceName.toLowerCase().includes(userQ) || log.departmentName.toLowerCase().includes(userQ);
      const actionMatch = !actionQ || log.action.toLowerCase().includes(actionQ);
      return nameMatch && actionMatch;
    });
  }

  // Log user clicks on tools
  protected handleToolClick(shortcut: any) {
    if (!shortcut.isAccessible) {
      alert(`Erişim Engellendi! Cihaz/Kullanıcı profiliniz (${this.device()?.department?.name ?? 'Guest'}) bu kilitli araca ("${shortcut.name}") erişim yetkisine sahip değil.`);
      return;
    }

    const dev = this.device();
    if (!dev) return;

    const payload: DeviceLog = {
      deviceName: dev.deviceName,
      ipAddress: dev.ipAddress,
      macAddress: dev.macAddress,
      action: `Clicked shortcut: ${shortcut.name}`,
      timestamp: new Date().toISOString(),
      departmentName: dev.department?.name ?? 'Guest Network'
    };

    this.http.post<any>(`${this.apiUrl}/log`, payload).subscribe({
      next: () => {
        this.http.get<any>(`${this.apiUrl}/profile?ip=${dev.ipAddress}&username=${this.currentUser() || ''}`).subscribe(res => {
          this.recentLogs.set(res.recentLogs);
        });
      }
    });

    window.open(shortcut.url, '_blank');
  }

  // Carousel slider navigations
  protected nextSlide() {
    this.activeSlide.update(curr => (curr + 1) % this.slides.length);
  }

  protected prevSlide() {
    this.activeSlide.update(curr => (curr - 1 + this.slides.length) % this.slides.length);
  }

  protected selectSlide(index: number) {
    this.activeSlide.set(index);
  }

  protected dismissAlert() {
    this.isAlertBannerVisible.set(false);
  }

  protected addCustomShortcutLocal() {
    const title = this.customShortcutTitle().trim();
    let url = this.customShortcutUrl().trim();
    if (!title || !url) {
      alert('Lütfen hem başlık hem de geçerli bir URL girin.');
      return;
    }
    // Prefix with http/https if missing
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    const newItem = {
      id: Date.now(),
      name: title,
      url: url,
      icon: 'globe',
      color: '#0078d4',
      description: 'Kullanıcı tarafından eklenen özel kısayol.',
      departmentId: null,
      isLocked: false,
      isAccessible: true,
      isCustom: true
    };
    this.customShortcuts.update(list => [...list, newItem]);
    localStorage.setItem('custom_shortcuts', JSON.stringify(this.customShortcuts()));
    this.customShortcutTitle.set('');
    this.customShortcutUrl.set('');
  }

  protected removeCustomShortcutLocal(id: number) {
    this.customShortcuts.update(list => list.filter(item => item.id !== id));
    localStorage.setItem('custom_shortcuts', JSON.stringify(this.customShortcuts()));
  }

  protected onShortcutContextMenu(event: MouseEvent, app: any) {
    event.preventDefault();
    this.contextMenuX.set(event.clientX);
    this.contextMenuY.set(event.clientY);
    this.contextMenuApp.set(app);
    this.contextMenuVisible.set(true);
  }

  @HostListener('document:click')
  protected closeContextMenu() {
    this.contextMenuVisible.set(false);
  }

  protected removeShortcutViaContextMenu() {
    const app = this.contextMenuApp();
    if (!app) return;

    if (app.isCustom) {
      this.removeCustomShortcutLocal(app.id);
    } else {
      this.togglePinApp(app.id);
    }
    this.contextMenuVisible.set(false);
  }

  protected prevMonth() {
    this.currentMonth.update(m => {
      if (m === 0) {
        this.currentYear.update(y => y - 1);
        return 11;
      }
      return m - 1;
    });
  }

  protected nextMonth() {
    this.currentMonth.update(m => {
      if (m === 11) {
        this.currentYear.update(y => y + 1);
        return 0;
      }
      return m + 1;
    });
  }

  protected selectCalendarDay(day: number | null) {
    if (day === null) return;
    const year = this.currentYear();
    const month = this.currentMonth();
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (this.selectedCalendarDate() === dateStr) {
      this.selectedCalendarDate.set(null);
    } else {
      this.selectedCalendarDate.set(dateStr);
    }
  }

  protected getCellDateString(day: number | null): string {
    if (day === null) return '';
    return `${this.currentYear()}-${String(this.currentMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
}
