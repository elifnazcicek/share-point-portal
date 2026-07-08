import { Component, OnInit, signal, computed, inject } from '@angular/core';
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

interface CustomShortcut {
  id?: number;
  name: string;
  url: string;
  icon: string;
  color: string;
  deviceIp: string;
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
  protected readonly authRole = signal<string>('IT Department'); // Default registering department
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

  // Signals for portal state
  protected readonly device = signal<Device | null>(null);
  protected readonly shortcuts = signal<Shortcut[]>([]);
  protected readonly customShortcuts = signal<CustomShortcut[]>([]);
  protected readonly announcements = signal<Announcement[]>([]);
  protected readonly recentLogs = signal<DeviceLog[]>([]);
  protected readonly loading = signal<boolean>(true);
  protected readonly error = signal<string | null>(null);

  // Search and Filter
  protected readonly searchQuery = signal<string>('');

  // Simulator State
  protected readonly isSimulatorOpen = signal<boolean>(false);
  protected readonly simulatedIp = signal<string>('192.168.1.15'); // Default to IT subnet
  protected readonly simulatedDeviceName = signal<string>('WORKSTATION-01');
  protected readonly simulatedMac = signal<string>('00-50-56-C0-00-08');

  // Add Custom App Modal State
  protected readonly isAddModalOpen = signal<boolean>(false);
  protected readonly newShortcutName = signal<string>('');
  protected readonly newShortcutUrl = signal<string>('');
  protected readonly newShortcutIcon = signal<string>('link');
  protected readonly newShortcutColor = signal<string>('#3b82f6');

  // Carousel News Slides
  protected readonly activeSlide = signal<number>(0);
  protected readonly slides = [
    {
      title: 'Company Intranet Revamp Launched',
      description: 'Welcome to the new network-aware SharePoint Portal. Access localized department tools instantly.',
      image: '/news_banner.png',
      tag: 'Announcements'
    },
    {
      title: 'Annual Cybersecurity Refresher',
      description: 'All departments are requested to complete the shield cybersecurity awareness module by this Friday.',
      image: '/news_banner.png',
      tag: 'Training'
    },
    {
      title: 'Office Collaboration Hubs',
      description: 'Discover the new hybrid work spaces on floor 3. Reserve rooms using the Leave & Scheduling system.',
      image: '/news_banner.png',
      tag: 'Workplace'
    }
  ];

  // Dynamic filtered lists
  protected readonly filteredShortcuts = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const list = this.shortcuts();
    if (!query) return list;
    return list.filter(s => 
      s.name.toLowerCase().includes(query) || 
      s.description.toLowerCase().includes(query) ||
      s.departmentName.toLowerCase().includes(query)
    );
  });

  protected readonly activeAnnouncement = computed(() => {
    const list = this.announcements();
    return list.length > 0 ? list[0] : null;
  });

  protected readonly isAlertBannerVisible = signal<boolean>(true);

  ngOnInit() {
    // 1. Restore authenticated session if exists
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('username');
    if (token && savedUser) {
      this.isLoggedIn.set(true);
      this.currentUser.set(savedUser);
      this.currentUserRole.set(localStorage.getItem('role'));
      this.currentUserFullName.set(localStorage.getItem('fullName'));
    }

    // 2. Restore rememberMe credentials if selected
    const savedRememberMe = localStorage.getItem('rememberMe') === 'true';
    if (savedRememberMe) {
      this.rememberMe.set(true);
      this.authUsername.set(localStorage.getItem('rememberedUsername') || '');
      this.authPassword.set(localStorage.getItem('rememberedPassword') || '');
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
    
    // Pass logged-in username to resolve department permissions
    const user = this.currentUser();
    if (user) {
      url += `&username=${encodeURIComponent(user)}`;
    }

    this.http.get<any>(url).subscribe({
      next: (res) => {
        this.device.set(res.device);
        this.shortcuts.set(res.shortcuts);
        this.customShortcuts.set(res.customShortcuts);
        this.announcements.set(res.announcements);
        this.recentLogs.set(res.recentLogs);
        
        // Update simulation inputs with actual values returned
        this.simulatedIp.set(res.device.ipAddress);
        this.simulatedDeviceName.set(res.device.deviceName);
        this.simulatedMac.set(res.device.macAddress);
        
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

          // Save/clear Remember Me credentials
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
          this.loadProfile(); // Reload with user role department context
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
      fullName: this.authFullName(),
      role: this.authRole(),
      email: this.authEmail(),
      phoneNumber: this.authPhone()
    };

    this.http.post<any>(`${this.authUrl}/register`, payload).subscribe({
      next: (res) => {
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
    
    this.loadProfile(); // Reload to fall back to network/IP-based routing
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

  // Open / Close custom shortcut modal
  protected openAddModal() {
    this.newShortcutName.set('');
    this.newShortcutUrl.set('https://');
    this.newShortcutIcon.set('link');
    this.newShortcutColor.set('#0078d4');
    this.isAddModalOpen.set(true);
  }

  // Submit custom shortcut
  protected submitCustomShortcut() {
    const dev = this.device();
    if (!dev) return;

    const payload: CustomShortcut = {
      name: this.newShortcutName(),
      url: this.newShortcutUrl(),
      icon: this.newShortcutIcon(),
      color: this.newShortcutColor(),
      deviceIp: dev.ipAddress
    };

    this.http.post<any>(`${this.apiUrl}/shortcut`, payload).subscribe({
      next: () => {
        this.isAddModalOpen.set(false);
        this.loadProfile(dev.ipAddress);
      },
      error: (err) => {
        console.error('Error adding custom shortcut', err);
        alert('Failed to add custom shortcut');
      }
    });
  }

  // Delete custom shortcut
  protected deleteCustomShortcut(id: number | undefined) {
    if (id === undefined) return;
    const dev = this.device();
    if (!dev) return;

    if (confirm('Are you sure you want to remove this shortcut?')) {
      this.http.delete<any>(`${this.apiUrl}/shortcut/${id}?ip=${dev.ipAddress}`).subscribe({
        next: () => {
          this.loadProfile(dev.ipAddress);
        },
        error: (err) => {
          console.error('Error deleting shortcut', err);
          alert('Failed to delete shortcut');
        }
      });
    }
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
        // Reload logs
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
}
