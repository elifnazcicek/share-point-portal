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
  privacy?: string;
  editPermission?: string;
  isPasswordProtected?: boolean;
  isUnlockedInMemory?: boolean;
  lastModifiedBy?: string;
  accessPassword?: string | null;
  departmentName?: string;
}

interface DocumentVersion {
  id?: number;
  documentId: number;
  versionNumber: number;
  fileUrl: string;
  fileSize: string;
  modifiedBy: string;
  modifiedDate: string;
  comment?: string;
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
  protected readonly globalCustomShortcuts = signal<any[]>([]);
  protected readonly customShortcutTitle = signal<string>('');
  protected readonly customShortcutUrl = signal<string>('');
  protected readonly customShortcutTargetDept = signal<string>('Everyone');
  protected readonly allShortcuts = computed(() => {
    const userRole = this.currentUserRole() || 'Guest';
    const filteredGlobals = this.globalCustomShortcuts().filter(s => {
      if (!s.targetDept || s.targetDept === 'Everyone') return true;
      if (userRole === 'Admin' || userRole === 'IT Department') return true;
      return s.targetDept.toLowerCase() === userRole.toLowerCase();
    });
    return [...this.shortcuts(), ...filteredGlobals, ...this.customShortcuts()];
  });
  protected readonly announcements = signal<Announcement[]>([]);
  protected readonly recentLogs = signal<DeviceLog[]>([]);
  protected readonly loading = signal<boolean>(true);
  protected readonly error = signal<string | null>(null);

  // UI Navigation Tabs
  protected readonly activeTab = signal<'home' | 'workspace' | 'admin' | 'chat'>('home'); // Categorized top bar states
  protected readonly workspaceSubTab = signal<'dms' | 'notepad' | 'workspaces'>('dms');
  protected readonly activeUserSim = signal<'ahmet' | 'elif' | 'it_user' | 'misafir'>('ahmet');
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
  protected readonly lunchMenu = signal<{ Pazartesi: string, Sali: string, Carsamba: string, Persembe: string, Cuma: string }>({
    Pazartesi: 'Mercimek Çorbası, İzmir Köfte, Pirinç Pilavı, Cacık',
    Sali: 'Yayla Çorbası, Tavuk Sote, Makarna, Kemalpaşa Tatlısı',
    Carsamba: 'Ezogelin Çorbası, Kuru Fasulye, Bulgur Pilavı, Turşu',
    Persembe: 'Tarhana Çorbası, Fırın Poşetinde Tavuk, Fırın Patates, Salata',
    Cuma: 'Düğün Çorbası, Kadınbudu Köfte, Erişte, Ayran'
  });
  protected readonly isLunchMenuModalOpen = signal<boolean>(false);
  protected readonly lunchPazartesi = signal<string>('');
  protected readonly lunchSali = signal<string>('');
  protected readonly lunchCarsamba = signal<string>('');
  protected readonly lunchPersembe = signal<string>('');
  protected readonly lunchCuma = signal<string>('');

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

  // New Upload Form state (embedded next to upload drop area)
  protected readonly selectedUploadFile = signal<File | null>(null);
  protected readonly uploadFileTitle = signal<string>('');
  protected readonly uploadFilePrivacy = signal<string>('Public');
  protected readonly uploadFilePassword = signal<string>('');
  protected readonly uploadFileComment = signal<string>('');
  protected readonly uploadFileEditPermission = signal<string>('Everyone');

  // DMS and Notepad sub-state
  protected readonly dmsFilter = signal<'all' | 'received' | 'sent' | 'public'>('all');
  protected readonly personalNotesAll = signal<Record<string, {id: number, title: string, content: string, date: string}[]>>({
    'admin': [
      { id: 1, title: 'Pazartesi Planları', content: '1. IT şifre kasasının yedeklerini al.\n2. Elif ile bütçe dosyası hakkında görüş.', date: '08.07.2026 09:00' },
      { id: 2, title: 'Alınacaklar Listesi', content: '- Sunucu odası için yeni patch kabloları sipariş edilecek.\n- İK duyuru şablonu incelenecek.', date: '08.07.2026 10:15' }
    ],
    'fin_user': [
      { id: 1, title: 'Bütçe Hesaplamaları', content: '- Muhasebe hesap mutabakatları yapılacak.\n- Maaş ödemeleri listesi onaylanacak.', date: '09.07.2026 11:00' }
    ],
    'it_user': [
      { id: 1, title: 'Network Bakım Planı', content: '- Switch konfigürasyon yedekleri alınacak.\n- VPN erişim izinleri gözden geçirilecek.', date: '10.07.2026 14:30' }
    ],
    'misafir': [
      { id: 1, title: 'Ziyaretçi Notu', content: 'Ziyaretçi deneme notudur.', date: '11.07.2026 16:00' }
    ]
  });
  protected readonly personalNotes = computed(() => {
    const user = this.currentUser() || 'admin';
    return this.personalNotesAll()[user] || [];
  });
  protected readonly activeNoteId = signal<number>(1);
  protected readonly noteTitleInput = signal<string>('Pazartesi Planları');
  protected readonly noteContentInput = signal<string>('1. IT şifre kasasının yedeklerini al.\n2. Elif ile bütçe dosyası hakkında görüş.');
  protected readonly isNoteShareMenuOpen = signal<boolean>(false);
  protected readonly isShareNoteModalOpen = signal<boolean>(false);
  protected readonly noteToShare = signal<any | null>(null);

  // Collaborative Workspaces
  protected readonly workspaces = signal<{id: number, name: string, desc: string, notes: string, files: any[], members: string[], chat?: any[]}[]>([
    { 
      id: 1, 
      name: 'Yıl Sonu Bütçe Değerlendirme', 
      desc: 'Muhasebe ve IT ortak planlama odası', 
      notes: 'Proje kapsamında IT donanım harcamaları Muhasebe tarafından bu alandan takip edilecektir.', 
      files: [
        { name: 'IT_Donanim_Budcesi.xlsx', type: 'Excel', uploadedBy: 'admin', uploadedDate: '2026-07-04 10:11', lastEditedBy: 'admin', lastEditedDate: '2026-07-04 10:11', size: '1.4 MB' },
        { name: '2026_Finansal_Rapor.pdf', type: 'PDF', uploadedBy: 'fin_user', uploadedDate: '2026-07-05 14:20', lastEditedBy: 'fin_user', lastEditedDate: '2026-07-05 14:20', size: '2.8 MB' },
        { name: 'IT_Altyapi_Gereksinimleri.docx', type: 'Word', uploadedBy: 'it_user', uploadedDate: '2026-07-06 09:30', lastEditedBy: 'it_user', lastEditedDate: '2026-07-06 09:30', size: '950 KB' },
        { name: 'Sunucu_Kesinti_Analizi.pdf', type: 'PDF', uploadedBy: 'admin', uploadedDate: '2026-07-07 11:15', lastEditedBy: 'admin', lastEditedDate: '2026-07-07 11:15', size: '1.2 MB' }
      ], 
      members: ['admin', 'fin_user', 'it_user'],
      chat: [
        { sender: 'admin', senderName: 'Ahmet Karaca', text: 'Arkadaşlar, bütçe planlama odasını açtım.', time: '10:00' },
        { sender: 'fin_user', senderName: 'Elif Yılmaz', text: 'Teşekkürler Ahmet Bey, bütçe excel dosyasını yükledim.', time: '10:05' },
        { sender: 'it_user', senderName: 'Murat (IT)', text: 'Harika. Altyapı ihtiyaç listesini de hazırlayıp ekliyorum.', time: '10:15' }
      ]
    }
  ]);
  protected readonly isNewWorkspaceModalOpen = signal<boolean>(false);
  protected readonly isWorkspaceOnlyView = signal<boolean>(false);
  protected readonly activeWorkspace = signal<any | null>(null);
  protected readonly activeFileHistory = signal<any | null>(null);
  protected readonly wsNotesInput = signal<string>('');
  protected readonly isWorkspaceChatOpen = signal<boolean>(true);
  protected readonly wsChatMessageInput = signal<string>('');
  protected readonly wsUploadTitle = signal<string>('');
  protected readonly wsUploadPrivacy = signal<string>('Public');
  protected readonly wsUploadPermission = signal<string>('Everyone');
  protected readonly wsUploadNote = signal<string>('');
  protected readonly wsSelectedFile = signal<File | null>(null);
  protected readonly wsNameInput = signal<string>('');
  protected readonly wsDescInput = signal<string>('');
  protected readonly wsInvitedMembers = signal<string[]>([]);
  protected readonly chatContextMenuVisible = signal<boolean>(false);
  protected readonly chatContextMenuX = signal<number>(0);
  protected readonly chatContextMenuY = signal<number>(0);
  protected readonly chatContextMenuMsg = signal<any | null>(null);
  protected readonly chatContextMenuIdx = signal<number>(-1);
  protected readonly chatContextMenuType = signal<'workspace' | 'main'>('workspace');
  protected readonly replyingToMessage = signal<any | null>(null);
  protected readonly isMentionListOpen = signal<boolean>(false);
  protected readonly mentionChatType = signal<'workspace' | 'main'>('workspace');

  protected readonly visibleWorkspaces = computed(() => {
    const user = this.currentUser();
    if (!user) return [];
    if (user === 'admin') return this.workspaces();
    return this.workspaces().filter(ws => ws.members && ws.members.includes(user));
  });

  // Full Screen Dual Chat Contacts
  protected readonly chatContacts = signal<{username: string, fullName: string, role: string, online: boolean}[]>([
    { username: 'admin', fullName: 'Ahmet Karaca', role: 'Global Admin', online: true },
    { username: 'fin_user', fullName: 'Elif Yılmaz', role: 'Accounting Dept Admin', online: true },
    { username: 'it_user', fullName: 'Murat (IT Sorumlusu)', role: 'IT Sorumlusu', online: true },
    { username: 'ai_bot', fullName: 'PortalOne AI', role: 'Yapay Zeka Asistanı', online: true },
    { username: 'misafir', fullName: 'Misafir (Ziyaretçi)', role: 'Ziyaretçi', online: false }
  ]);
  protected readonly activeChatUser = signal<{username: string, fullName: string, role: string, online: boolean} | null>({
    username: 'fin_user', fullName: 'Elif Yılmaz', role: 'Accounting Dept Admin', online: true
  });
  protected readonly fullChatInput = signal<string>('');
  protected readonly chatMessageSearchQuery = signal<string>('');

  // Admin tabs & config parameters
  protected readonly adminSubTab = signal<'users' | 'network' | 'logs' | 'home-edit' | 'approvals' | 'delegation'>('users');
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
  protected readonly pendingApprovalsCount = computed(() => {
    return this.approvalRequests().filter(r => r.isPending).length;
  });

  // Chat State
  protected readonly chatInput = signal<string>('');
  protected readonly chatHistories = signal<Record<string, {sender: string, text: string, time: string, isSharedNote?: boolean, noteTitle?: string, isPinned?: boolean, replyTo?: {senderName: string, text: string}}[]>>({
    'admin_fin_user': [
      { sender: 'fin_user', text: 'Merhaba Ahmet Bey, bütçe sunumu için raporu hazırladım. Dosyalar kısmından inceleyebilirsiniz.', time: '09:30' }
    ],
    'admin_it_user': [
      { sender: 'admin', text: 'Murat Bey, sunucu odasındaki kesinti hakkında bilgi alabilir miyim?', time: '10:00' },
      { sender: 'it_user', text: 'Ahmet Bey, ana switch üzerindeki güncelleme bitti, sistem stabil.', time: '10:05' }
    ],
    'admin_ai_bot': [
      { sender: 'ai_bot', text: 'Merhaba! Ben PortalOne yapay zeka asistanıyım. Sistemdeki aktif çalışanlar, belgeler, son duyurular veya cihaz ağ durumunuz hakkında bana dilediğiniz soruyu sorabilirsiniz.', time: '08:30' }
    ],
    'fin_user_ai_bot': [
      { sender: 'ai_bot', text: 'Merhaba Elif Hanım! Muhasebe ve finans verileriyle ilgili yapay zeka analizine hoş geldiniz.', time: '08:30' }
    ],
    'it_user_ai_bot': [
      { sender: 'ai_bot', text: 'Merhaba Murat Bey! IT ve Ağ izleme asistanına hoş geldiniz.', time: '08:30' }
    ]
  });

  protected readonly drawerMessages = signal<{sender: string, text: string, time: string}[]>([
    { sender: 'Kurumsal Destek Botu', text: 'Merhaba! Ben kurumsal hızlı destek robotuyum. Portal ile ilgili genel sorularınızı buradan yanıtlayabilirim.', time: '09:00' }
  ]);

  private getChatKey(userA: string, userB: string): string {
    const sorted = [userA, userB].sort();
    return `${sorted[0]}_${sorted[1]}`;
  }

  protected readonly activeChatMessages = computed(() => {
    const activeUser = this.activeChatUser();
    const currentUser = this.currentUser();
    if (!activeUser || !currentUser) return [];
    const key = this.getChatKey(currentUser, activeUser.username);
    return this.chatHistories()[key] || [];
  });

  // File Privacy Modal States
  protected readonly isPrivacyModalOpen = signal<boolean>(false);
  protected readonly selectedPrivacyDoc = signal<WorkspaceDocument | null>(null);
  protected readonly modalPrivacy = signal<string>("Public");
  protected readonly modalEditPermission = signal<string>("Everyone");
  protected readonly modalAccessPassword = signal<string>("");

  // File Password Verification Prompt Modal States
  protected readonly isPasswordPromptOpen = signal<boolean>(false);
  protected readonly passwordPromptDoc = signal<WorkspaceDocument | null>(null);
  protected readonly enteredPassword = signal<string>("");
  protected readonly passwordError = signal<string | null>(null);
  protected readonly previewZoomLevel = signal<number>(1.0);

  // Version History States
  protected readonly selectedVersions = signal<DocumentVersion[]>([]);
  protected readonly isVersionModalOpen = signal<boolean>(false);
  protected readonly versionHistoryDoc = signal<WorkspaceDocument | null>(null);

  // Carousel News Slides
  protected readonly activeSlide = signal<number>(0);
  protected readonly slides = signal<any[]>([
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
  ]);

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
    { name: 'Sohbet', tab: 'chat', subTab: null, description: 'Çalışanlar arası sohbet ve kurumsal iletişim.' },
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

    // Restore personal notes
    const savedNotes = localStorage.getItem('personalNotesAll');
    if (savedNotes) {
      try {
        this.personalNotesAll.set(JSON.parse(savedNotes));
      } catch (e) {}
    }

    // Restore workspaces
    const savedWorkspaces = localStorage.getItem('workspacesAll');
    if (savedWorkspaces) {
      try {
        const parsed = JSON.parse(savedWorkspaces);
        if (parsed.length > 0) {
          const first = parsed[0];
          if (!first.members || !first.members.includes('admin') || !first.files || first.files.length < 4 || !first.files[0].uploadedBy) {
            const defaults = this.workspaces();
            localStorage.setItem('workspacesAll', JSON.stringify(defaults));
            this.workspaces.set(defaults);
          } else {
            this.workspaces.set(parsed);
          }
        } else {
          this.workspaces.set(parsed);
        }
      } catch (e) {
        localStorage.setItem('workspacesAll', JSON.stringify(this.workspaces()));
      }
    } else {
      localStorage.setItem('workspacesAll', JSON.stringify(this.workspaces()));
    }

    // Check for standalone workspace URL parameter
    const params = new URLSearchParams(window.location.search);
    const wsIdParam = params.get('workspace');
    if (wsIdParam) {
      const wsId = parseInt(wsIdParam, 10);
      const currentList = this.workspaces();
      const foundWs = currentList.find(w => w.id === wsId);
      if (foundWs) {
        this.isWorkspaceOnlyView.set(true);
        this.activeWorkspace.set(foundWs);
        this.wsNotesInput.set(foundWs.notes || '');
      }
    }

    // Restore Lunch Menu
    const savedLunch = localStorage.getItem('lunchMenu');
    if (savedLunch) {
      try {
        this.lunchMenu.set(JSON.parse(savedLunch));
      } catch (e) {}
    }

    // Restore custom shortcuts
    this.loadCustomShortcutsForUser();

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

  private loadCustomShortcutsForUser() {
    // 1. Load global custom shortcuts
    const savedGlobals = localStorage.getItem('custom_shortcuts_global');
    if (savedGlobals) {
      this.globalCustomShortcuts.set(JSON.parse(savedGlobals));
    } else {
      this.globalCustomShortcuts.set([]);
    }

    // 2. Load personal custom shortcuts
    const username = this.currentUser() || 'anonymous';
    const savedCustoms = localStorage.getItem(`custom_shortcuts_${username}`);
    if (savedCustoms) {
      this.customShortcuts.set(JSON.parse(savedCustoms));
    } else {
      this.customShortcuts.set([]);
    }
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

  protected onUpdateFileSelected(event: any, doc: WorkspaceDocument) {
    const file = event.target?.files?.[0];
    if (!file || !doc || !doc.id) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('username', this.currentUser() || 'Guest');

    this.loading.set(true);
    this.http.post<any>(`${this.workspaceUrl}/upload`, formData).subscribe({
      next: (res) => {
        doc.fileUrl = res.fileUrl;
        doc.fileSize = res.fileSize;
        doc.lastModifiedBy = this.currentUser() || 'Guest';

        this.http.put<WorkspaceDocument>(`${this.workspaceUrl}/documents/${doc.id}?username=${encodeURIComponent(this.currentUser() || 'Guest')}`, doc).subscribe({
          next: () => {
            this.loadDocuments();
            this.loading.set(false);
            alert('Dosya başarıyla yüklendi ve güncellendi!');
          },
          error: (err) => {
            this.loading.set(false);
            alert('Dosya veritabanında güncellenirken hata oluştu.');
          }
        });
      },
      error: (err) => {
        this.loading.set(false);
        alert('Yeni dosya sunucuya yüklenirken hata oluştu.');
      }
    });
  }

  protected zoomIn() {
    this.previewZoomLevel.update(z => Math.min(2.0, z + 0.1));
  }

  protected zoomOut() {
    this.previewZoomLevel.update(z => Math.max(0.5, z - 0.1));
  }

  protected resetZoom() {
    this.previewZoomLevel.set(1.0);
  }

  protected onPreviewWheel(event: WheelEvent) {
    event.preventDefault();
    const direction = event.deltaY < 0 ? 1 : -1;
    this.previewZoomLevel.update(z => {
      const nextZoom = z + (direction * 0.05);
      return Math.min(2.0, Math.max(0.5, nextZoom));
    });
  }

  protected openLunchMenuModal() {
    const current = this.lunchMenu();
    this.lunchPazartesi.set(current.Pazartesi);
    this.lunchSali.set(current.Sali);
    this.lunchCarsamba.set(current.Carsamba);
    this.lunchPersembe.set(current.Persembe);
    this.lunchCuma.set(current.Cuma);
    this.isLunchMenuModalOpen.set(true);
  }

  protected saveLunchMenu() {
    const updated = {
      Pazartesi: this.lunchPazartesi(),
      Sali: this.lunchSali(),
      Carsamba: this.lunchCarsamba(),
      Persembe: this.lunchPersembe(),
      Cuma: this.lunchCuma()
    };
    this.lunchMenu.set(updated);
    localStorage.setItem('lunchMenu', JSON.stringify(updated));
    this.isLunchMenuModalOpen.set(false);
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
        const req = this.approvalRequests().find(r => r.id === id);
        if (approved && req && req.title.startsWith('NewWorkspaceRequest:')) {
          const wsName = req.title.replace('NewWorkspaceRequest:', '');
          let desc = '';
          let members: string[] = ['admin'];

          const descMatch = req.description.match(/Açıklama:\s*(.*?)\s*\|/);
          if (descMatch) desc = descMatch[1];

          const membersMatch = req.description.match(/Üyeler:\s*(.*)$/);
          if (membersMatch) {
            members = membersMatch[1].split(',').map(m => m.trim()).filter(Boolean);
          }

          const newWs = {
            id: this.workspaces().length + 1,
            name: wsName,
            desc: desc,
            notes: 'Ortak notlar...',
            files: [],
            members: members
          };

          this.workspaces.update(list => {
            const updated = [...list, newWs];
            localStorage.setItem('workspacesAll', JSON.stringify(updated));
            return updated;
          });
          alert(`"${wsName}" ortak çalışma odası başarıyla onaylandı ve oluşturuldu.`);
        } else if (!approved && req && req.title.startsWith('NewWorkspaceRequest:')) {
          const wsName = req.title.replace('NewWorkspaceRequest:', '');
          alert(`"${wsName}" ortak çalışma odası talebi reddedildi.`);
        }

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

    this.drawerMessages.update(current => [...current, { sender: user, text, time }]);
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
      this.drawerMessages.update(current => [...current, { sender: 'Kurumsal Destek Botu', text: reply, time }]);
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
          this.loadCustomShortcutsForUser();
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
    this.loadCustomShortcutsForUser();
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

  protected onActiveUserSimChange(user: 'ahmet' | 'elif' | 'it_user' | 'misafir') {
    this.activeUserSim.set(user);
    let username = 'admin';
    if (user === 'ahmet') {
      localStorage.setItem('username', 'admin');
      localStorage.setItem('role', 'Admin');
      localStorage.setItem('fullName', 'Ahmet (Global Admin)');
      this.currentUser.set('admin');
      this.currentUserRole.set('Admin');
      this.currentUserFullName.set('Ahmet (Global Admin)');
      username = 'admin';
    } else if (user === 'elif') {
      localStorage.setItem('username', 'fin_user');
      localStorage.setItem('role', 'Finance Department');
      localStorage.setItem('fullName', 'Elif (Muhasebe Dept Admin)');
      this.currentUser.set('fin_user');
      this.currentUserRole.set('Finance Department');
      this.currentUserFullName.set('Elif (Muhasebe Dept Admin)');
      username = 'fin_user';
    } else if (user === 'it_user') {
      localStorage.setItem('username', 'it_user');
      localStorage.setItem('role', 'IT Department');
      localStorage.setItem('fullName', 'Murat (IT Departman Sorumlusu)');
      this.currentUser.set('it_user');
      this.currentUserRole.set('IT Department');
      this.currentUserFullName.set('Murat (IT Departman Sorumlusu)');
      username = 'it_user';
    } else if (user === 'misafir') {
      localStorage.setItem('username', 'misafir');
      localStorage.setItem('role', 'Guest');
      localStorage.setItem('fullName', 'Misafir (Ziyaretçi)');
      this.currentUser.set('misafir');
      this.currentUserRole.set('Guest');
      this.currentUserFullName.set('Misafir (Ziyaretçi)');
      username = 'misafir';
    }

    // Set default active chat user based on simulator profile
    if (username === 'admin') {
      this.activeChatUser.set({ username: 'fin_user', fullName: 'Elif Yılmaz', role: 'Accounting Dept Admin', online: true });
    } else {
      this.activeChatUser.set({ username: 'admin', fullName: 'Ahmet Karaca', role: 'Global Admin', online: true });
    }

    // Auto select the first note of the new profile
    const notes = this.personalNotesAll()[username];
    if (notes && notes.length > 0) {
      this.selectNote(notes[0]);
    } else {
      this.selectNote(null);
    }

    this.loadCustomShortcutsForUser();
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

  protected openPrivacyModal(doc: WorkspaceDocument) {
    this.selectedPrivacyDoc.set(doc);
    this.modalPrivacy.set(doc.privacy || 'Public');
    this.modalEditPermission.set(doc.editPermission || 'Everyone');
    this.modalAccessPassword.set(''); // Clear input for security
    this.isPrivacyModalOpen.set(true);
  }

  protected savePrivacySettings() {
    const doc = this.selectedPrivacyDoc();
    if (!doc || !doc.id) return;

    const payload = {
      privacy: this.modalPrivacy(),
      editPermission: this.modalEditPermission(),
      accessPassword: this.modalPrivacy() === 'Private' ? this.modalAccessPassword() : ''
    };

    const user = this.currentUser() || 'admin';
    this.http.put<any>(`${this.workspaceUrl}/documents/${doc.id}/privacy?username=${encodeURIComponent(user)}`, payload).subscribe({
      next: () => {
        this.isPrivacyModalOpen.set(false);
        this.loadDocuments();
        alert('Dosya gizlilik ve güvenlik ayarları başarıyla kaydedildi.');
      },
      error: (err) => {
        alert(err.error || 'Ayarlar kaydedilirken hata oluştu.');
      }
    });
  }

  protected openDocumentSecurely(doc: WorkspaceDocument) {
    if (doc.isPasswordProtected && !doc.isUnlockedInMemory) {
      this.passwordPromptDoc.set(doc);
      this.enteredPassword.set('');
      this.passwordError.set(null);
      this.isPasswordPromptOpen.set(true);
    } else {
      this.previewDocumentDirect(doc);
    }
  }

  protected verifyDocumentPassword() {
    const doc = this.passwordPromptDoc();
    const password = this.enteredPassword().trim();
    if (!doc || !doc.id) return;

    this.http.post<any>(`${this.workspaceUrl}/documents/${doc.id}/verify-password`, { password }).subscribe({
      next: (res) => {
        // Unlock doc content and URL in memory
        doc.content = res.content;
        doc.fileUrl = res.fileUrl;
        doc.isUnlockedInMemory = true;

        this.isPasswordPromptOpen.set(false);
        this.previewDocumentDirect(doc);
      },
      error: (err) => {
        this.passwordError.set(err.error?.error || 'Hatalı erişim şifresi.');
      }
    });
  }

  private previewDocumentDirect(doc: WorkspaceDocument) {
    this.previewZoomLevel.set(1.0);
    this.activeDoc.set(doc);
    if (doc.id) {
      this.loadCollaborators(doc.id);
    }
  }

  protected getFilePreviewType(doc: WorkspaceDocument): 'pdf' | 'excel' | 'word' | 'image' | 'text' {
    if (!doc.isFile) return 'text';
    const titleLower = doc.title.toLowerCase();
    if (titleLower.endsWith('.pdf')) return 'pdf';
    if (titleLower.endsWith('.xlsx') || titleLower.endsWith('.xls')) return 'excel';
    if (titleLower.endsWith('.docx') || titleLower.endsWith('.doc')) return 'word';
    if (titleLower.endsWith('.png') || titleLower.endsWith('.jpg') || titleLower.endsWith('.jpeg')) return 'image';
    return 'pdf';
  }

  protected openVersionHistory(doc: WorkspaceDocument) {
    if (!doc || !doc.id) return;
    this.versionHistoryDoc.set(doc);
    this.http.get<DocumentVersion[]>(`${this.workspaceUrl}/documents/${doc.id}/versions`).subscribe({
      next: (res) => {
        this.selectedVersions.set(res);
        this.isVersionModalOpen.set(true);
      },
      error: (err) => {
        alert('Sürüm geçmişi yüklenirken hata oluştu.');
      }
    });
  }

  protected restoreDocumentVersion(ver: DocumentVersion) {
    if (!ver || !ver.documentId) return;
    const user = this.currentUser() || 'admin';

    if (confirm(`Bu belgeyi v${ver.versionNumber}.0 sürümüne geri yüklemek istediğinize emin misiniz?`)) {
      this.http.post<any>(`${this.workspaceUrl}/documents/${ver.documentId}/restore/${ver.versionNumber}?username=${encodeURIComponent(user)}`, {}).subscribe({
        next: () => {
          this.isVersionModalOpen.set(false);
          this.loadDocuments();
          alert('Belge başarıyla eski sürümüne geri yüklendi.');
        },
        error: (err) => {
          alert(err.error || 'Sürüm geri yüklenirken bir hata oluştu.');
        }
      });
    }
  }

  protected getDocumentTypeDisplay(doc: WorkspaceDocument): string {
    if (!doc.isFile) return 'Not';
    const titleLower = doc.title.toLowerCase();
    if (titleLower.endsWith('.xlsx') || titleLower.endsWith('.xls')) return 'Excel';
    if (titleLower.endsWith('.pdf')) return 'PDF';
    if (titleLower.endsWith('.docx') || titleLower.endsWith('.doc')) return 'Word';
    if (titleLower.endsWith('.png') || titleLower.endsWith('.jpg') || titleLower.endsWith('.jpeg')) return 'Görsel';
    const ext = doc.title.split('.').pop() || '';
    return ext ? ext.toUpperCase() : 'Dosya';
  }

  protected triggerFileSelect() {
    const fileInput = document.getElementById('hidden-file-input');
    if (fileInput) fileInput.click();
  }

  protected onFileSelected(event: any) {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      this.selectedUploadFile.set(file);
      this.uploadFileTitle.set(file.name);
    }
  }

  protected onFileDropped(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    const element = document.getElementById('drag-drop-zone');
    if (element) {
      element.style.borderColor = 'var(--primary)';
      element.style.backgroundColor = 'rgba(0, 120, 212, 0.05)';
    }
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      this.selectedUploadFile.set(file);
      this.uploadFileTitle.set(file.name);
    }
  }

  protected onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    const element = document.getElementById('drag-drop-zone');
    if (element) {
      element.style.borderColor = 'var(--primary-dark)';
      element.style.backgroundColor = 'rgba(0, 120, 212, 0.1)';
    }
  }

  protected onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    const element = document.getElementById('drag-drop-zone');
    if (element) {
      element.style.borderColor = 'var(--primary)';
      element.style.backgroundColor = 'rgba(0, 120, 212, 0.05)';
    }
  }

  protected uploadSelectedFileWithMetadata() {
    const file = this.selectedUploadFile();
    if (!file) {
      alert('Lütfen önce bir dosya sürükleyin veya seçin.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    const title = this.uploadFileTitle() || file.name;
    const privacy = this.uploadFilePrivacy();
    const password = this.uploadFilePassword();
    const editPerm = this.uploadFileEditPermission();
    const comment = this.uploadFileComment() || 'Dosya seçilerek yüklendi.';

    this.http.post<any>(`${this.workspaceUrl}/upload`, formData).subscribe({
      next: (res) => {
        const payload: WorkspaceDocument = {
          title: title,
          content: `# ${title}\n\nEk Açıklama: ${comment}`,
          ownerUsername: this.currentUser() || 'Guest',
          isPublic: privacy === 'Public',
          privacy: privacy,
          editPermission: editPerm,
          isFile: true,
          fileUrl: res.fileUrl,
          fileSize: res.fileSize,
          uploaderComment: comment,
          accessPassword: (privacy === 'Private' || editPerm === 'OwnerOnly') && password ? password : null
        };

        this.http.post<WorkspaceDocument>(`${this.workspaceUrl}/documents`, payload).subscribe({
          next: () => {
            this.loadDocuments();
            this.cancelUploadSelection();
            alert('Dosya başarıyla yüklendi ve sisteme eklendi!');
          },
          error: (err) => {
            alert('Dosya döküman olarak kaydedilirken hata oluştu.');
          }
        });
      },
      error: (err) => {
        alert(err.error || 'Dosya yükleme hatası. Dosya boyutu limitini aşmış olabilir.');
      }
    });
  }

  protected cancelUploadSelection() {
    this.selectedUploadFile.set(null);
    this.uploadFileTitle.set('');
    this.uploadFilePrivacy.set('Public');
    this.uploadFilePassword.set('');
    this.uploadFileComment.set('');
    this.uploadFileEditPermission.set('Everyone');
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
    if (!note) {
      this.activeNoteId.set(-1);
      this.noteTitleInput.set('');
      this.noteContentInput.set('');
      return;
    }
    this.activeNoteId.set(note.id);
    this.noteTitleInput.set(note.title);
    this.noteContentInput.set(note.content);
  }

  protected createNewNote() {
    const user = this.currentUser() || 'admin';
    this.personalNotesAll.update(all => {
      const list = all[user] || [];
      const newId = list.length > 0 ? Math.max(...list.map(n => n.id)) + 1 : 1;
      const newNote = {
        id: newId,
        title: 'Yeni Not',
        content: '',
        date: new Date().toLocaleString('tr-TR').slice(0, 16)
      };
      const nextAll = { ...all, [user]: [...list, newNote] };
      localStorage.setItem('personalNotesAll', JSON.stringify(nextAll));
      setTimeout(() => this.selectNote(newNote), 0);
      return nextAll;
    });
  }

  protected saveNote() {
    const user = this.currentUser() || 'admin';
    this.personalNotesAll.update(all => {
      const list = all[user] || [];
      const updatedList = list.map(n => {
        if (n.id === this.activeNoteId()) {
          return {
            ...n,
            title: this.noteTitleInput(),
            content: this.noteContentInput(),
            date: new Date().toLocaleString('tr-TR').slice(0, 16)
          };
        }
        return n;
      });
      const nextAll = { ...all, [user]: updatedList };
      localStorage.setItem('personalNotesAll', JSON.stringify(nextAll));
      return nextAll;
    });
    alert('Not başarıyla kaydedildi.');
  }

  protected shareNoteInChat() {
    const note = this.personalNotes().find(n => n.id === this.activeNoteId());
    if (!note) return;
    this.noteToShare.set(note);
    this.isNoteShareMenuOpen.set(false);
    this.isShareNoteModalOpen.set(true);
  }

  protected getShareableContacts() {
    const curr = this.currentUser();
    return this.chatContacts().filter(c => c.username !== curr);
  }

  protected shareNoteWithContact(contact: any) {
    const note = this.noteToShare();
    if (!note || !contact) return;

    const payload = {
      sender: this.currentUser() || 'admin',
      text: `Sizinle bir not paylaştı: "${note.title}"`,
      time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      isSharedNote: true,
      noteTitle: note.title
    };

    // Add directly to the selected contact's chat history
    this.chatHistories.update(histories => {
      const userHistory = histories[contact.username] || [];
      return {
        ...histories,
        [contact.username]: [...userHistory, payload]
      };
    });

    // Close modal
    this.isShareNoteModalOpen.set(false);
    this.noteToShare.set(null);

    // Prompt user if they want to navigate to the chat room to view it
    if (confirm(`"${note.title}" notu ${contact.fullName} ile başarıyla paylaşıldı. Sohbeti açmak ister misiniz?`)) {
      this.activeChatUser.set(contact);
      this.activeTab.set('chat');
    }
  }

  protected copyNoteLink() {
    const note = this.personalNotes().find(n => n.id === this.activeNoteId());
    if (!note) return;
    const url = `http://localhost:4400/share/note/${note.id}`;
    navigator.clipboard.writeText(url);
    this.isNoteShareMenuOpen.set(false);
    alert('Not paylaşım bağlantısı panoya kopyalandı.');
  }

  protected downloadWorkspaceFile(name: string) {
    alert(`"${name}" dosyası başarıyla indiriliyor...`);
  }

  protected showWorkspaceAlert(msg: string) {
    alert(msg);
  }

  protected showFileVersionHistory(fileObj: any) {
    if (!fileObj.versions) {
      fileObj.versions = [
        { version: "v2.0 (Güncel)", uploadedBy: fileObj.uploadedBy || "admin", date: fileObj.uploadedDate || "2026-07-04 10:11", size: fileObj.size || "1.4 MB" },
        { version: "v1.1", uploadedBy: "it_user", date: "2026-07-03 14:05", size: "1.3 MB" },
        { version: "v1.0 (İlk Sürüm)", uploadedBy: "fin_user", date: "2026-07-02 09:15", size: "1.1 MB" }
      ];
    }
    this.activeFileHistory.set(fileObj);
  }

  protected downloadFileVersion(fileName: string, versionStr: string) {
    alert(`"${fileName}" dosyasının "${versionStr}" sürümü başarıyla indiriliyor...`);
  }

  protected toggleChat(event: Event) {
    event.stopPropagation();
    this.isWorkspaceChatOpen.set(!this.isWorkspaceChatOpen());
  }

  protected closeChatIfOpen(event: Event) {
    if (this.isWorkspaceChatOpen()) {
      this.isWorkspaceChatOpen.set(false);
    }
    this.chatContextMenuVisible.set(false);
    this.isMentionListOpen.set(false);
  }

  protected startReplyToMessage() {
    this.replyingToMessage.set(this.chatContextMenuMsg());
    this.chatContextMenuVisible.set(false);
  }

  protected cancelReply() {
    this.replyingToMessage.set(null);
  }

  protected onChatMessageContextMenu(event: MouseEvent, msg: any, idx: number, chatType: 'workspace' | 'main' = 'workspace') {
    event.preventDefault();
    event.stopPropagation();
    this.chatContextMenuX.set(event.clientX);
    this.chatContextMenuY.set(event.clientY);
    this.chatContextMenuMsg.set(msg);
    this.chatContextMenuIdx.set(idx);
    this.chatContextMenuType.set(chatType);
    this.chatContextMenuVisible.set(true);
  }

  protected deleteChatMessage() {
    const idx = this.chatContextMenuIdx();
    if (idx === -1) return;

    if (this.chatContextMenuType() === 'workspace') {
      const ws = this.activeWorkspace();
      if (!ws) return;

      this.workspaces.update(list => {
        const updated = list.map(item => {
          if (item.id === ws.id) {
            const chatList = item.chat || [];
            return {
              ...item,
              chat: chatList.filter((_, i) => i !== idx)
            };
          }
          return item;
        });
        localStorage.setItem('workspacesAll', JSON.stringify(updated));

        const nextWs = updated.find(item => item.id === ws.id);
        if (nextWs) this.activeWorkspace.set(nextWs);

        return updated;
      });
    } else {
      const activeUser = this.activeChatUser();
      const currentUser = this.currentUser();
      if (!activeUser || !currentUser) return;
      const key = this.getChatKey(currentUser, activeUser.username);

      this.chatHistories.update(histories => {
        const userHistory = histories[key] || [];
        return {
          ...histories,
          [key]: userHistory.filter((_, i) => i !== idx)
        };
      });
    }

    this.chatContextMenuVisible.set(false);
  }

  protected pinChatMessage() {
    const idx = this.chatContextMenuIdx();
    if (idx === -1) return;

    if (this.chatContextMenuType() === 'workspace') {
      const ws = this.activeWorkspace();
      if (!ws) return;

      this.workspaces.update(list => {
        const updated = list.map(item => {
          if (item.id === ws.id) {
            const chatList = item.chat || [];
            const willPin = !chatList[idx].isPinned;

            const updatedChat = chatList.map((m, i) => {
              if (i === idx) {
                return { ...m, isPinned: willPin };
              }
              // Clear previous pin status to ensure only one message is active pinned!
              return { ...m, isPinned: false };
            });

            return {
              ...item,
              chat: updatedChat
            };
          }
          return item;
        });
        localStorage.setItem('workspacesAll', JSON.stringify(updated));

        const nextWs = updated.find(item => item.id === ws.id);
        if (nextWs) this.activeWorkspace.set(nextWs);

        return updated;
      });
    } else {
      const activeUser = this.activeChatUser();
      const currentUser = this.currentUser();
      if (!activeUser || !currentUser) return;
      const key = this.getChatKey(currentUser, activeUser.username);

      this.chatHistories.update(histories => {
        const userHistory = histories[key] || [];
        const willPin = !userHistory[idx].isPinned;

        const updatedHistory = userHistory.map((m, i) => {
          if (i === idx) {
            return { ...m, isPinned: willPin };
          }
          // Clear previous pin status to ensure only one message is active pinned!
          return { ...m, isPinned: false };
        });

        return {
          ...histories,
          [key]: updatedHistory
        };
      });
    }

    this.chatContextMenuVisible.set(false);
  }

  protected unpinWorkspaceMessage(event: Event, msgToUnpin: any) {
    event.stopPropagation();
    const ws = this.activeWorkspace();
    if (!ws) return;

    this.workspaces.update(list => {
      const updated = list.map(item => {
        if (item.id === ws.id) {
          const chatList = item.chat || [];
          const updatedChat = chatList.map(m => {
            if (m.text === msgToUnpin.text && m.sender === msgToUnpin.sender) {
              return { ...m, isPinned: false };
            }
            return m;
          });
          return {
            ...item,
            chat: updatedChat
          };
        }
        return item;
      });
      localStorage.setItem('workspacesAll', JSON.stringify(updated));

      const nextWs = updated.find(item => item.id === ws.id);
      if (nextWs) this.activeWorkspace.set(nextWs);

      return updated;
    });
  }

  protected unpinMainMessage(event: Event, msgToUnpin: any) {
    event.stopPropagation();
    const activeUser = this.activeChatUser();
    const currentUser = this.currentUser();
    if (!activeUser || !currentUser) return;
    const key = this.getChatKey(currentUser, activeUser.username);

    this.chatHistories.update(histories => {
      const userHistory = histories[key] || [];
      const updatedHistory = userHistory.map(m => {
        if (m.text === msgToUnpin.text && m.sender === msgToUnpin.sender) {
          return { ...m, isPinned: false };
        }
        return m;
      });
      return {
        ...histories,
        [key]: updatedHistory
      };
    });
  }

  protected getActivePinnedMessage(ws: any): any | null {
    if (!ws || !ws.chat) return null;
    const pinned = (ws.chat as any[]).filter(m => m.isPinned);
    return pinned.length > 0 ? pinned[pinned.length - 1] : null;
  }

  protected getActivePinnedMainMessage(): any | null {
    const messages = this.activeChatMessages();
    const pinned = messages.filter((m: any) => m.isPinned);
    return pinned.length > 0 ? pinned[pinned.length - 1] : null;
  }

  protected getPinnedMessages(ws: any): any[] {
    if (!ws || !ws.chat) return [];
    return (ws.chat as any[]).filter(m => m.isPinned);
  }

  protected openWorkspaceDetail(ws: any) {
    window.open('?workspace=' + ws.id, '_blank');
  }

  protected windowClose() {
    window.close();
  }

  protected saveWorkspaceNotes() {
    const ws = this.activeWorkspace();
    if (!ws) return;

    this.workspaces.update(list => {
      const updated = list.map(item => {
        if (item.id === ws.id) {
          return {
            ...item,
            notes: this.wsNotesInput()
          };
        }
        return item;
      });
      localStorage.setItem('workspacesAll', JSON.stringify(updated));
      
      const nextWs = updated.find(item => item.id === ws.id);
      if (nextWs) this.activeWorkspace.set(nextWs);

      return updated;
    });

    alert('Çalışma odası ortak notları başarıyla güncellendi.');
  }

  protected triggerWorkspaceFileSelect() {
    const fileInput = document.getElementById('ws-file-input');
    if (fileInput) fileInput.click();
  }

  protected onWorkspaceFileSelected(event: any) {
    const files = event.target.files;
    if (files && files.length > 0) {
      this.wsSelectedFile.set(files[0]);
      this.wsUploadTitle.set(files[0].name.split('.').slice(0, -1).join('.'));
    }
  }

  protected uploadFileToWorkspace() {
    const file = this.wsSelectedFile();
    const ws = this.activeWorkspace();
    if (!file || !ws) {
      alert('Lütfen yüklenecek bir dosya seçin.');
      return;
    }

    const title = this.wsUploadTitle().trim() || file.name;
    const fileExt = file.name.split('.').pop() || '';
    const fullFileName = title.includes('.') ? title : `${title}.${fileExt}`;

    const formattedSize = file.size >= 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(file.size / 1024)} KB`;

    let fileType = 'Belge';
    if (['xls', 'xlsx'].includes(fileExt.toLowerCase())) fileType = 'Excel';
    else if (['pdf'].includes(fileExt.toLowerCase())) fileType = 'PDF';
    else if (['doc', 'docx'].includes(fileExt.toLowerCase())) fileType = 'Word';
    else if (['png', 'jpg', 'jpeg', 'gif'].includes(fileExt.toLowerCase())) fileType = 'Görsel';

    const user = this.currentUser() || 'admin';
    const dateStr = new Date().toISOString().replace('T', ' ').slice(0, 16);

    const newFileObj = {
      name: fullFileName,
      type: fileType,
      uploadedBy: user,
      uploadedDate: dateStr,
      lastEditedBy: user,
      lastEditedDate: dateStr,
      size: formattedSize
    };

    this.workspaces.update(list => {
      const updated = list.map(item => {
        if (item.id === ws.id) {
          return {
            ...item,
            files: [...(item.files || []), newFileObj]
          };
        }
        return item;
      });
      localStorage.setItem('workspacesAll', JSON.stringify(updated));

      const nextWs = updated.find(item => item.id === ws.id);
      if (nextWs) this.activeWorkspace.set(nextWs);

      return updated;
    });

    alert(`"${fullFileName}" dosyası başarıyla yüklendi.`);
    this.wsSelectedFile.set(null);
    this.wsUploadTitle.set('');
    this.wsUploadNote.set('');
  }

  protected clearWorkspaceUploadForm() {
    this.wsSelectedFile.set(null);
    this.wsUploadTitle.set('');
    this.wsUploadNote.set('');
  }

  protected deleteWorkspaceFile(fileObj: any) {
    const ws = this.activeWorkspace();
    if (!ws) return;

    if (confirm(`"${fileObj.name}" dosyasını silmek istediğinize emin misiniz?`)) {
      this.workspaces.update(list => {
        const updated = list.map(item => {
          if (item.id === ws.id) {
            return {
              ...item,
              files: (item.files || []).filter(f => f.name !== fileObj.name)
            };
          }
          return item;
        });
        localStorage.setItem('workspacesAll', JSON.stringify(updated));

        const nextWs = updated.find(item => item.id === ws.id);
        if (nextWs) this.activeWorkspace.set(nextWs);

        return updated;
      });
      alert('Dosya ortak çalışma alanından silindi.');
    }
  }

  protected sendWorkspaceChatMessage() {
    const text = this.wsChatMessageInput().trim();
    if (!text) return;

    const ws = this.activeWorkspace();
    if (!ws) return;

    const user = this.currentUser() || 'admin';
    const fullName = this.currentUserFullName() || 'Ahmet (Global Admin)';
    const replyData = this.replyingToMessage();

    const newMsg = {
      sender: user,
      senderName: fullName,
      text: text,
      time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      isPinned: false,
      replyTo: replyData ? { senderName: replyData.senderName || replyData.sender, text: replyData.text } : undefined
    };

    this.replyingToMessage.set(null);

    this.workspaces.update(list => {
      const updated = list.map(item => {
        if (item.id === ws.id) {
          const chatList = item.chat || [];
          return {
            ...item,
            chat: [...chatList, newMsg]
          };
        }
        return item;
      });
      localStorage.setItem('workspacesAll', JSON.stringify(updated));

      const nextWs = updated.find(item => item.id === ws.id);
      if (nextWs) this.activeWorkspace.set(nextWs);

      return updated;
    });

    this.wsChatMessageInput.set('');

    const otherMembers = (ws.members as string[]).filter((m: string) => m !== user);
    if (otherMembers.length > 0) {
      setTimeout(() => {
        const replier = otherMembers[Math.floor(Math.random() * otherMembers.length)];
        const replierName = replier === 'admin' ? 'Ahmet Karaca' : (replier === 'fin_user' ? 'Elif Yılmaz' : (replier === 'it_user' ? 'Murat (IT)' : replier));
        const replyMsg = {
          sender: replier,
          senderName: replierName,
          text: 'Mesajınızı aldım, ortak dosyalar tablosunu kontrol ediyorum.',
          time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
        };

        this.workspaces.update(list => {
          const updated = list.map(item => {
            if (item.id === ws.id) {
              const chatList = item.chat || [];
              return {
                ...item,
                chat: [...chatList, replyMsg]
              };
            }
            return item;
          });
          localStorage.setItem('workspacesAll', JSON.stringify(updated));

          const nextWs = updated.find(item => item.id === ws.id);
          if (nextWs) this.activeWorkspace.set(nextWs);

          return updated;
        });
      }, 1500);
    }
  }

  protected toggleWsInviteMember(username: string) {
    this.wsInvitedMembers.update(current => {
      if (current.includes(username)) {
        return current.filter(u => u !== username);
      } else {
        return [...current, username];
      }
    });
  }

  protected submitWorkspaceApproval() {
    const name = this.wsNameInput().trim();
    const desc = this.wsDescInput().trim();
    const user = this.currentUser() || 'Guest';
    if (!name) {
      alert('Lütfen çalışma odası adı giriniz.');
      return;
    }

    const members = Array.from(new Set(['admin', user, ...this.wsInvitedMembers()]));

    if (user === 'admin') {
      const newWs = {
        id: this.workspaces().length + 1,
        name: name,
        desc: desc,
        notes: 'Ortak notlar...',
        files: [],
        members: members
      };
      this.workspaces.update(list => {
        const updated = [...list, newWs];
        localStorage.setItem('workspacesAll', JSON.stringify(updated));
        return updated;
      });
      alert(`"${name}" ortak çalışma odası başarıyla oluşturuldu.`);
      this.isNewWorkspaceModalOpen.set(false);
      this.wsNameInput.set('');
      this.wsDescInput.set('');
      this.wsInvitedMembers.set([]);
      return;
    }

    const payload = {
      title: `NewWorkspaceRequest:${name}`,
      description: `Talep Eden: ${user} | Açıklama: ${desc} | Üyeler: ${members.join(', ')}`,
      requestedByUsername: user
    };

    this.http.post<any>(`${this.workspaceUrl}/approvals`, payload).subscribe({
      next: () => {
        alert('Çalışma odası oluşturma talebi onay için yöneticiye gönderildi.');
        this.isNewWorkspaceModalOpen.set(false);
        this.wsNameInput.set('');
        this.wsDescInput.set('');
        this.wsInvitedMembers.set([]);
        this.loadApprovals();
      },
      error: () => {
        alert('Talep gönderilirken hata oluştu.');
      }
    });
  }

  protected getWorkspaceDescFromRequest(description: string): string {
    const match = description.match(/Açıklama:\s*(.*?)\s*\|/);
    return match ? match[1] : 'Açıklama girilmemiş.';
  }

  protected getWorkspaceMembersFromRequest(description: string): string {
    const match = description.match(/Üyeler:\s*(.*)$/);
    return match ? match[1] : 'Sadece Admin';
  }

  protected createNewWorkspace() {
    this.isNewWorkspaceModalOpen.set(true);
  }

  protected selectChatUser(usr: any) {
    this.activeChatUser.set(usr);
  }

  protected sendFullChatMessage() {
    const input = this.fullChatInput().trim();
    if (!input) return;

    const user = this.currentUser() || 'admin';
    const replyData = this.replyingToMessage();

    const payload = {
      sender: user,
      text: input,
      time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      isSharedNote: false,
      noteTitle: '',
      isPinned: false,
      replyTo: replyData ? { senderName: replyData.senderName || (replyData.sender === 'admin' ? 'Ahmet Karaca' : (replyData.sender === 'fin_user' ? 'Elif Yılmaz' : (replyData.sender === 'it_user' ? 'Murat (IT)' : replyData.sender))), text: replyData.text } : undefined
    };

    this.replyingToMessage.set(null);
    this.appendMessageToActiveChat(payload);
    this.fullChatInput.set('');
    this.chatMessageSearchQuery.set(''); // Clear search filter when sending message

    const activeUser = this.activeChatUser();
    if (activeUser?.username === 'ai_bot') {
      const typingMsg = {
        sender: 'ai_bot',
        text: 'PortalOne AI yanıt yazıyor...',
        time: '...',
        isSharedNote: false,
        noteTitle: ''
      };

      // Add typing indicator
      this.appendMessageToActiveChat(typingMsg);

      // Trigger HTTP request with retry logic
      this.sendAiRequestWithRetry(input, user, typingMsg, 1, 3);
    }
  }

  private sendAiRequestWithRetry(message: string, username: string, typingMsg: any, attempt: number, maxAttempts: number) {
    this.http.post<{ response: string }>(`${this.apiUrl}/ai/chat`, {
      message: message,
      username: username
    }).subscribe({
      next: (res) => {
        // Remove typing indicator and add response
        this.removeMessageFromActiveChat(typingMsg);

        const reply = {
          sender: 'ai_bot',
          text: res.response,
          time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
          isSharedNote: false,
          noteTitle: ''
        };
        this.appendMessageToActiveChat(reply);
      },
      error: (err) => {
        if (attempt < maxAttempts) {
          // Wait 2 seconds and retry in the background while keeping the typing indicator visible
          setTimeout(() => {
            this.sendAiRequestWithRetry(message, username, typingMsg, attempt + 1, maxAttempts);
          }, 2000);
        } else {
          // All retries failed, remove typing indicator and show error
          this.removeMessageFromActiveChat(typingMsg);

          const reply = {
            sender: 'ai_bot',
            text: 'Üzgünüm, şu an bağlantı limitleri nedeniyle yanıt veremiyorum. Lütfen birkaç saniye sonra sorunuzu tekrar sorun.',
            time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
            isSharedNote: false,
            noteTitle: ''
          };
          this.appendMessageToActiveChat(reply);
        }
      }
    });
  }

  private appendMessageToActiveChat(msg: {sender: string, text: string, time: string, isSharedNote?: boolean, noteTitle?: string, isPinned?: boolean}) {
    const activeUser = this.activeChatUser();
    const currentUser = this.currentUser();
    if (!activeUser || !currentUser) return;
    const key = this.getChatKey(currentUser, activeUser.username);

    this.chatHistories.update(histories => {
      const userHistory = histories[key] || [];
      return {
        ...histories,
        [key]: [...userHistory, msg]
      };
    });

    setTimeout(() => {
      const el = document.querySelector('.chat-messages-area');
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  }

  private removeMessageFromActiveChat(msg: any) {
    const activeUser = this.activeChatUser();
    const currentUser = this.currentUser();
    if (!activeUser || !currentUser) return;
    const key = this.getChatKey(currentUser, activeUser.username);

    this.chatHistories.update(histories => {
      const userHistory = histories[key] || [];
      return {
        ...histories,
        [key]: userHistory.filter(m => m !== msg)
      };
    });
  }

  protected filteredChatMessages() {
    const list = this.activeChatMessages();
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
    this.activeSlide.update(curr => (curr + 1) % this.slides().length);
  }

  protected prevSlide() {
    this.activeSlide.update(curr => (curr - 1 + this.slides().length) % this.slides().length);
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
    const isIT = this.currentUserRole() === 'IT Department' || this.currentUserRole() === 'Admin';
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
      isCustom: true,
      targetDept: isIT ? this.customShortcutTargetDept() : 'Everyone'
    };
    
    if (isIT) {
      this.globalCustomShortcuts.update(list => [...list, newItem]);
      localStorage.setItem('custom_shortcuts_global', JSON.stringify(this.globalCustomShortcuts()));
    } else {
      this.customShortcuts.update(list => [...list, newItem]);
      const username = this.currentUser() || 'anonymous';
      localStorage.setItem(`custom_shortcuts_${username}`, JSON.stringify(this.customShortcuts()));
    }
    
    this.customShortcutTitle.set('');
    this.customShortcutUrl.set('');
    this.customShortcutTargetDept.set('Everyone');
  }

  protected removeCustomShortcutLocal(id: number) {
    const username = this.currentUser() || 'anonymous';
    const personalList = this.customShortcuts();
    if (personalList.some(item => item.id === id)) {
      this.customShortcuts.update(list => list.filter(item => item.id !== id));
      localStorage.setItem(`custom_shortcuts_${username}`, JSON.stringify(this.customShortcuts()));
    } else {
      this.globalCustomShortcuts.update(list => list.filter(item => item.id !== id));
      localStorage.setItem('custom_shortcuts_global', JSON.stringify(this.globalCustomShortcuts()));
    }
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

  protected toggleMentionList(chatType: 'workspace' | 'main') {
    this.mentionChatType.set(chatType);
    this.isMentionListOpen.set(!this.isMentionListOpen());
  }

  protected onWorkspaceChatInputChange(value: string) {
    this.wsChatMessageInput.set(value);
    const lastAtIndex = value.lastIndexOf('@');
    if (lastAtIndex !== -1 && lastAtIndex >= value.length - 15) {
      this.mentionChatType.set('workspace');
      this.isMentionListOpen.set(true);
    } else {
      this.isMentionListOpen.set(false);
    }
  }

  protected onMainChatInputChange(value: string) {
    this.fullChatInput.set(value);
    const lastAtIndex = value.lastIndexOf('@');
    if (lastAtIndex !== -1 && lastAtIndex >= value.length - 15) {
      this.mentionChatType.set('main');
      this.isMentionListOpen.set(true);
    } else {
      this.isMentionListOpen.set(false);
    }
  }

  protected getMentionSearchQuery(text: string): string {
    if (!text) return '';
    const lastAtIndex = text.lastIndexOf('@');
    if (lastAtIndex === -1) return '';
    return text.substring(lastAtIndex + 1).toLowerCase();
  }

  protected getFilteredWorkspaceFiles(ws: any): any[] {
    if (!ws || !ws.files) return [];
    const query = this.getMentionSearchQuery(this.wsChatMessageInput());
    if (!query) return ws.files;
    return ws.files.filter((f: any) => f.name.toLowerCase().includes(query));
  }

  protected getFilteredPortalFiles(): string[] {
    const allFiles = this.getAllPortalFiles();
    const query = this.getMentionSearchQuery(this.fullChatInput());
    if (!query) return allFiles;
    return allFiles.filter(name => name.toLowerCase().includes(query));
  }

  protected insertFileMention(fileName: string, chatType: 'workspace' | 'main') {
    if (chatType === 'workspace') {
      const currentText = this.wsChatMessageInput() || '';
      const lastAtIndex = currentText.lastIndexOf('@');
      if (lastAtIndex !== -1) {
        const prefix = currentText.substring(0, lastAtIndex);
        this.wsChatMessageInput.set(`${prefix}@[file:${fileName}] `);
      } else {
        this.wsChatMessageInput.set(`@[file:${fileName}] `);
      }
    } else {
      const currentText = this.fullChatInput() || '';
      const lastAtIndex = currentText.lastIndexOf('@');
      if (lastAtIndex !== -1) {
        const prefix = currentText.substring(0, lastAtIndex);
        this.fullChatInput.set(`${prefix}@[file:${fileName}] `);
      } else {
        this.fullChatInput.set(`@[file:${fileName}] `);
      }
    }
    this.isMentionListOpen.set(false);
  }

  protected getMessageSegments(text: string): { type: 'text' | 'mention', value: string, fileName?: string }[] {
    if (!text) return [];
    const segments: { type: 'text' | 'mention', value: string, fileName?: string }[] = [];
    const regex = /@\[file:(.*?)\]/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const matchIndex = match.index;
      if (matchIndex > lastIndex) {
        segments.push({
          type: 'text',
          value: text.substring(lastIndex, matchIndex)
        });
      }
      const fileName = match[1];
      segments.push({
        type: 'mention',
        value: `📄 ${fileName}`,
        fileName: fileName
      });
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      segments.push({
        type: 'text',
        value: text.substring(lastIndex)
      });
    }

    return segments.length > 0 ? segments : [{ type: 'text', value: text }];
  }

  protected openFileMention(fileName: string) {
    const fileUrl = `?file=${encodeURIComponent(fileName)}`;
    window.open(fileUrl, '_blank');
  }

  protected getAllPortalFiles(): string[] {
    const list: string[] = [];
    this.workspaces().forEach(ws => {
      if (ws.files) {
        ws.files.forEach((f: any) => {
          if (!list.includes(f.name)) list.push(f.name);
        });
      }
    });
    if (list.length === 0) {
      list.push('Butce_Plani_2026.xlsx', 'IT_Altyapi_Gereksinimleri.docx', 'Sunucu_Kesinti_Analizi.pdf');
    }
    return list;
  }

  protected readonly selectedSlideIndex = signal<number | null>(null);
  protected readonly slideOrder = signal<number>(1);

  protected onSlideImageSelected(event: any) {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.homeImageUrl.set(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  }

  protected startEditSlide(index: number) {
    const slide = this.slides()[index];
    this.homeHeadline.set(slide.title);
    this.homeDescription.set(slide.description);
    this.homeImageUrl.set(slide.image || '/news_banner.png');
    this.slideOrder.set(index + 1);
    this.selectedSlideIndex.set(index);
  }

  protected deleteSlide(index: number) {
    this.slides.update(list => {
      const updated = list.filter((_, i) => i !== index);
      const currentActive = this.activeSlide();
      if (currentActive >= updated.length) {
        this.activeSlide.set(Math.max(0, updated.length - 1));
      }
      return updated;
    });
    if (this.selectedSlideIndex() === index) {
      this.clearSlideForm();
    } else if (this.selectedSlideIndex() !== null && this.selectedSlideIndex()! > index) {
      this.selectedSlideIndex.update(idx => idx !== null ? idx - 1 : null);
    }
    alert('Slayt başarıyla silindi.');
  }

  protected saveSlideForm() {
    const title = this.homeHeadline().trim();
    const desc = this.homeDescription().trim();
    const image = this.homeImageUrl().trim() || '/news_banner.png';

    if (!title || !desc) {
      alert('Lütfen manşet başlığı ve açıklamasını doldurun.');
      return;
    }

    const newSlide = { title, description: desc, image, tag: 'Duyurular' };
    const index = this.selectedSlideIndex();

    this.slides.update(list => {
      const updated = [...list];
      if (index !== null && index >= 0 && index < list.length) {
        updated[index] = newSlide;
      } else {
        updated.push(newSlide);
      }
      return updated;
    });

    this.clearSlideForm();
    alert('Slayt başarıyla kaydedildi.');
  }

  protected clearSlideForm() {
    this.homeHeadline.set('');
    this.homeDescription.set('');
    this.homeImageUrl.set('/news_banner.png');
    this.slideOrder.set(this.slides().length + 1);
    this.selectedSlideIndex.set(null);
  }

  // Görev Devri ve Yetkilendirme State & Methods
  protected readonly delegations = signal<any[]>([
    {
      id: 'del-1',
      username: 'fin_user',
      fullName: 'Elif (Muhasebe Dept Admin)',
      taskKey: 'lunch-menu',
      taskName: 'Yemek Menüsü Güncelleme',
      duration: '1 Hafta',
      reason: 'Yönetici yoğunluğu nedeniyle yemek menüsü güncellenmesi geçici devredilmiştir.',
      startDate: new Date(),
      status: 'Aktif'
    }
  ]);

  protected readonly delegationTargetUser = signal<string>('fin_user');
  protected readonly delegationTaskKey = signal<string>('lunch-menu');
  protected readonly delegationDuration = signal<string>('1 Hafta');
  protected readonly delegationReason = signal<string>('');

  protected addDelegation() {
    const username = this.delegationTargetUser();
    const taskKey = this.delegationTaskKey();
    const duration = this.delegationDuration();
    const reason = this.delegationReason().trim();

    if (!username || !taskKey) {
      alert('Lütfen tüm zorunlu alanları doldurun.');
      return;
    }

    const taskNames: Record<string, string> = {
      'lunch-menu': 'Yemek Menüsü Güncelleme',
      'home-edit': 'Ana Sayfa Slayt Yönetimi',
      'logs': 'Audit Log Raporu Görüntüleme',
      'approvals': 'Onay Taleplerini Yönetme',
      'users': 'Kullanıcı Rol Ataması',
      'network': 'Güvenli Ağ & Limitler'
    };

    const userFullNames: Record<string, string> = {
      'fin_user': 'Elif (Muhasebe Dept Admin)',
      'it_user': 'Murat (IT Departman Sorumlusu)',
      'misafir': 'Misafir (Ziyaretçi)'
    };

    const newDelegation = {
      id: 'del-' + Date.now(),
      username,
      fullName: userFullNames[username] || username,
      taskKey,
      taskName: taskNames[taskKey] || taskKey,
      duration,
      reason: reason || 'Yönetici tarafından görev devri yapıldı.',
      startDate: new Date(),
      status: 'Aktif'
    };

    this.delegations.update(list => [...list, newDelegation]);
    this.delegationReason.set('');
    alert('Görev başarıyla devredildi.');
  }

  protected revokeDelegation(id: string) {
    this.delegations.update(list => 
      list.map(d => d.id === id ? { ...d, status: 'İptal' } : d)
    );
    alert('Devredilen görev başarıyla geri alındı.');
  }

  protected hasDelegatedPermission(taskKey: string): boolean {
    const currentUser = this.currentUser();
    if (this.currentUserRole() === 'Admin') return true;

    return this.delegations().some(d => 
      d.username === currentUser && 
      d.taskKey === taskKey && 
      d.status === 'Aktif'
    );
  }

  protected onAdminTabClick() {
    this.activeTab.set('admin');
    if (this.currentUserRole() !== 'Admin') {
      if (this.hasDelegatedPermission('users')) this.adminSubTab.set('users');
      else if (this.hasDelegatedPermission('network')) this.adminSubTab.set('network');
      else if (this.hasDelegatedPermission('logs')) this.adminSubTab.set('logs');
      else if (this.hasDelegatedPermission('home-edit')) this.adminSubTab.set('home-edit');
      else if (this.hasDelegatedPermission('approvals')) this.adminSubTab.set('approvals');
    } else {
      this.adminSubTab.set('users');
    }
  }
}
