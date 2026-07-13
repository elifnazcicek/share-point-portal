using Microsoft.EntityFrameworkCore;
using SharePointBackend.Models;
using System;
using System.Security.Cryptography;
using System.Text;

namespace SharePointBackend.Data
{
    public class PortalDbContext : DbContext
    {
        public PortalDbContext(DbContextOptions<PortalDbContext> options) : base(options)
        {
        }

        public DbSet<Department> Departments { get; set; }
        public DbSet<Shortcut> Shortcuts { get; set; }
        public DbSet<Announcement> Announcements { get; set; }
        public DbSet<DeviceLog> DeviceLogs { get; set; }
        public DbSet<CustomShortcut> CustomShortcuts { get; set; }
        public DbSet<User> Users { get; set; }
        public DbSet<WorkspaceDocument> WorkspaceDocuments { get; set; }
        public DbSet<DocumentCollaborator> DocumentCollaborators { get; set; }
        public DbSet<AdminApprovalRequest> AdminApprovalRequests { get; set; }
        public DbSet<DocumentVersion> DocumentVersions { get; set; }

        private string HashPassword(string password)
        {
            using var sha256 = SHA256.Create();
            var bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(password));
            var builder = new StringBuilder();
            foreach (var b in bytes)
            {
                builder.Append(b.ToString("x2"));
            }
            return builder.ToString();
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Configure relationships if needed
            modelBuilder.Entity<Shortcut>()
                .HasOne(s => s.Department)
                .WithMany()
                .HasForeignKey(s => s.DepartmentId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<Announcement>()
                .HasOne(a => a.Department)
                .WithMany()
                .HasForeignKey(a => a.DepartmentId)
                .OnDelete(DeleteBehavior.SetNull);

            // Seed Departments
            modelBuilder.Entity<Department>().HasData(
                new Department { Id = 1, Name = "IT Department", Description = "Information Technology & Network Operations", IpRange = "192.168.1.0/24" },
                new Department { Id = 2, Name = "HR Department", Description = "Human Resources & Talent Management", IpRange = "192.168.2.0/24" },
                new Department { Id = 3, Name = "Finance Department", Description = "Financial Reporting, Expenses & Budgeting", IpRange = "192.168.3.0/24" },
                new Department { Id = 4, Name = "Marketing Department", Description = "Marketing, Brand Strategy & CRM", IpRange = "192.168.4.0/24" },
                new Department { Id = 5, Name = "Operations Department", Description = "Operations, Logistics & Shift Planning", IpRange = "192.168.5.0/24" }
            );

            // Seed Shortcuts
            modelBuilder.Entity<Shortcut>().HasData(
                // Public Apps
                new Shortcut { Id = 1, Name = "Office 365 Outlook", Url = "https://outlook.office.com", Icon = "mail", Color = "#e63946", Description = "Corporate email and calendar access.", DepartmentId = null, IsLocked = false },
                new Shortcut { Id = 2, Name = "Corporate Website", Url = "https://company.com", Icon = "globe", Color = "#1d3557", Description = "Main company landing page.", DepartmentId = null, IsLocked = false },
                new Shortcut { Id = 3, Name = "Helpdesk Support", Url = "https://helpdesk.company.com", Icon = "help-circle", Color = "#457b9d", Description = "Submit IT or facilities help tickets.", DepartmentId = null, IsLocked = false },

                // HR Apps
                new Shortcut { Id = 4, Name = "Travel Management", Url = "https://travel.company.com", Icon = "plane", Color = "#0077b6", Description = "Book and manage business travels.", DepartmentId = 2, IsLocked = true },
                new Shortcut { Id = 5, Name = "Leave Management", Url = "https://leave.company.com", Icon = "calendar", Color = "#0096c7", Description = "Request time off and check balances.", DepartmentId = 2, IsLocked = true },
                new Shortcut { Id = 6, Name = "Onboarding Portal", Url = "https://onboard.company.com", Icon = "user-plus", Color = "#03045e", Description = "New employee registration and courses.", DepartmentId = 2, IsLocked = true },

                // IT Apps
                new Shortcut { Id = 7, Name = "Shield Security Console", Url = "https://shield.company.com", Icon = "shield", Color = "#d90429", Description = "Corporate cyber threat monitoring.", DepartmentId = 1, IsLocked = true },
                new Shortcut { Id = 8, Name = "Networking Diagnostics", Url = "https://net.company.com", Icon = "activity", Color = "#ef233c", Description = "Internal network status tools.", DepartmentId = 1, IsLocked = true },
                new Shortcut { Id = 9, Name = "Server Status Admin", Url = "https://admin.company.com", Icon = "server", Color = "#2b2d42", Description = "Virtual machine management console.", DepartmentId = 1, IsLocked = true },

                // Finance Apps
                new Shortcut { Id = 10, Name = "Expenses Dashboard", Url = "https://expenses.company.com", Icon = "dollar-sign", Color = "#2a9d8f", Description = "Submit receipts and view expenses.", DepartmentId = 3, IsLocked = true },
                new Shortcut { Id = 11, Name = "Power BI Reports", Url = "https://powerbi.company.com", Icon = "bar-chart-2", Color = "#f4a261", Description = "Corporate BI dashboards & analytics.", DepartmentId = 3, IsLocked = true },

                // Marketing Apps
                new Shortcut { Id = 12, Name = "Salesforce CRM", Url = "https://crm.company.com", Icon = "trending-up", Color = "#e76f51", Description = "Customer relation database access.", DepartmentId = 4, IsLocked = true },
                new Shortcut { Id = 13, Name = "Media & Brand Assets", Url = "https://assets.company.com", Icon = "image", Color = "#8338ec", Description = "Logos, brand guidelines & flyers.", DepartmentId = 4, IsLocked = true },

                // Operations Apps
                new Shortcut { Id = 14, Name = "Operations Pipeline", Url = "https://ops.company.com", Icon = "cpu", Color = "#06d6a0", Description = "Real-time production and pipeline overview.", DepartmentId = 5, IsLocked = true },
                new Shortcut { Id = 15, Name = "Shift Planner", Url = "https://shifts.company.com", Icon = "clock", Color = "#ffd166", Description = "Team scheduling and calendar management.", DepartmentId = 5, IsLocked = true }
            );

            // Seed Announcements
            modelBuilder.Entity<Announcement>().HasData(
                new Announcement 
                { 
                    Id = 1, 
                    Title = "Fire Alarm System Testing", 
                    Content = "Please note that the fire alarm system will undergo testing this Friday at 9:00 AM. Expect intermittent siren activity.", 
                    Priority = "warning", 
                    CreatedAt = DateTime.UtcNow.AddDays(-1), 
                    DepartmentId = null 
                },
                new Announcement 
                { 
                    Id = 2, 
                    Title = "Quarterly Business Review", 
                    Content = "Our Q2 Business Review will happen on Thursday at 2:00 PM. High-level performance results will be shared.", 
                    Priority = "info", 
                    CreatedAt = DateTime.UtcNow.AddDays(-2), 
                    DepartmentId = null 
                },
                new Announcement 
                { 
                    Id = 3, 
                    Title = "Critical Server Patching", 
                    Content = "All core database servers will be patched tonight starting at 11:00 PM. High latency is expected on staging servers.", 
                    Priority = "danger", 
                    CreatedAt = DateTime.UtcNow, 
                    DepartmentId = 1 // IT
                },
                new Announcement 
                { 
                    Id = 4, 
                    Title = "New Health Insurance Policy Options", 
                    Content = "HR is introducing updated health plans for 2026. Please complete your enrollment choices in the portal before next Friday.", 
                    Priority = "success", 
                    CreatedAt = DateTime.UtcNow.AddDays(-3), 
                    DepartmentId = 2 // HR
                },
                new Announcement 
                { 
                    Id = 5, 
                    Title = "End-of-Month Audit Preparations", 
                    Content = "All expense receipts must be uploaded to the Expenses app by Friday noon to allow for the monthly close out.", 
                    Priority = "warning", 
                    CreatedAt = DateTime.UtcNow, 
                    DepartmentId = 3 // Finance
                }
            );

            // Seed Users
            modelBuilder.Entity<User>().HasData(
                new User { Id = 1, Username = "admin", PasswordHash = HashPassword("admin123"), FullName = "System Administrator", Role = "IT Department", Email = "admin@company.com", PhoneNumber = "555-0100" },
                new User { Id = 2, Username = "it_user", PasswordHash = HashPassword("it123"), FullName = "IT Specialist", Role = "IT Department", Email = "it@company.com", PhoneNumber = "555-0101" },
                new User { Id = 3, Username = "hr_user", PasswordHash = HashPassword("hr123"), FullName = "HR Manager", Role = "HR Department", Email = "hr@company.com", PhoneNumber = "555-0102" },
                new User { Id = 4, Username = "fin_user", PasswordHash = HashPassword("fin123"), FullName = "Financial Analyst", Role = "Finance Department", Email = "finance@company.com", PhoneNumber = "555-0103" },
                new User { Id = 5, Username = "ops_user", PasswordHash = HashPassword("ops123"), FullName = "Operations Supervisor", Role = "Operations Department", Email = "ops@company.com", PhoneNumber = "555-0104" }
            );

            // Seed Documents
            modelBuilder.Entity<WorkspaceDocument>().HasData(
                new WorkspaceDocument
                {
                    Id = 1,
                    Title = "Şirket El Kitabı (Handbook)",
                    Content = "# Şirket Çalışma El Kitabı\n\nKurumsal portalımıza hoş geldiniz! Bu çalışma alanı tüm personelimizin okuması için kamuya açıktır. Şirket kurallarını ve çalışma standartlarını buradan inceleyebilirsiniz.",
                    OwnerUsername = "admin",
                    IsPublic = true,
                    CreatedDate = DateTime.UtcNow.AddDays(-10).ToString("yyyy-MM-dd HH:mm:ss"),
                    ModifiedDate = DateTime.UtcNow.AddDays(-10).ToString("yyyy-MM-dd HH:mm:ss"),
                    Privacy = "Public",
                    EditPermission = "Everyone",
                    AccessPassword = null,
                    LastModifiedBy = "admin"
                },
                new WorkspaceDocument
                {
                    Id = 2,
                    Title = "Q3 Finansal Bütçe Planı",
                    Content = "# Q3 Departman Bütçeleri\n\nBu gizli not, şirketimizin üçüncü çeyrek departman bütçe planlamalarını barındırır. Sadece yetkilendirilen çalışanlar düzenleme hakkına sahiptir.",
                    OwnerUsername = "fin_user",
                    IsPublic = false,
                    CreatedDate = DateTime.UtcNow.AddDays(-2).ToString("yyyy-MM-dd HH:mm:ss"),
                    ModifiedDate = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss"),
                    Privacy = "Private",
                    EditPermission = "OwnerOnly",
                    AccessPassword = null,
                    LastModifiedBy = "admin"
                },
                new WorkspaceDocument
                {
                    Id = 3,
                    Title = "Yıllık İSG Güvenlik Protokolü.pdf",
                    Content = "# İş Sağlığı ve Güvenliği Protokolü\n\nTüm departmanların uyması gereken 2026 yılı güncel İSG kuralları ve acil durum tahliye planı.",
                    OwnerUsername = "admin",
                    IsPublic = true,
                    CreatedDate = DateTime.UtcNow.AddDays(-15).ToString("yyyy-MM-dd HH:mm:ss"),
                    ModifiedDate = DateTime.UtcNow.AddDays(-15).ToString("yyyy-MM-dd HH:mm:ss"),
                    IsFile = true,
                    FileUrl = "https://company.com/files/isg-protokolu-2026.pdf",
                    FileSize = "3.2 MB",
                    UploaderComment = "Yıllık denetim öncesi güncellenen ana İSG dokümanı.",
                    Privacy = "Public",
                    EditPermission = "Everyone",
                    AccessPassword = null,
                    LastModifiedBy = "admin"
                },
                new WorkspaceDocument
                {
                    Id = 4,
                    Title = "2026 İK İzin ve Prim Yönetmeliği.docx",
                    Content = "# İK İzin ve Prim Yönetmeliği\n\nÇalışanların yıllık izin hakları, prim hakediş kriterleri ve yan haklar detayları.",
                    OwnerUsername = "hr_user",
                    IsPublic = true,
                    CreatedDate = DateTime.UtcNow.AddDays(-5).ToString("yyyy-MM-dd HH:mm:ss"),
                    ModifiedDate = DateTime.UtcNow.AddDays(-5).ToString("yyyy-MM-dd HH:mm:ss"),
                    IsFile = true,
                    FileUrl = "https://company.com/files/ik-izin-yonetmelik.docx",
                    FileSize = "1.8 MB",
                    UploaderComment = "Yönetim kurulu onaylı güncel yönetmelik.",
                    Privacy = "Public",
                    EditPermission = "Everyone",
                    AccessPassword = null,
                    LastModifiedBy = "hr_user"
                },
                new WorkspaceDocument
                {
                    Id = 5,
                    Title = "Departman Gider Tablosu Q2.xlsx",
                    Content = "# Q2 Finansal Gider Analizi\n\nNisan-Haziran dönemine ait tüm departmanların detaylandırılmış harcama kalemleri.",
                    OwnerUsername = "fin_user",
                    IsPublic = false,
                    CreatedDate = DateTime.UtcNow.AddDays(-1).ToString("yyyy-MM-dd HH:mm:ss"),
                    ModifiedDate = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss"),
                    IsFile = true,
                    FileUrl = "https://company.com/files/departman-giderleri-q2.xlsx",
                    FileSize = "4.5 MB",
                    UploaderComment = "Çeyrek sonu kapatma rakamları.",
                    Privacy = "Private",
                    EditPermission = "OwnerOnly",
                    AccessPassword = null,
                    LastModifiedBy = "fin_user"
                },
                new WorkspaceDocument
                {
                    Id = 6,
                    Title = "Kurumsal Ağ Topolojisi Şeması.png",
                    Content = "# Şirket İçi Ağ Mimarisi\n\nIntranet, DMZ, güvenli subnet ve VPN erişim şemasını gösteren ağ topoloji görseli.",
                    OwnerUsername = "it_user",
                    IsPublic = false,
                    CreatedDate = DateTime.UtcNow.AddDays(-20).ToString("yyyy-MM-dd HH:mm:ss"),
                    ModifiedDate = DateTime.UtcNow.AddDays(-20).ToString("yyyy-MM-dd HH:mm:ss"),
                    IsFile = true,
                    FileUrl = "https://company.com/files/network-topology-v2.png",
                    FileSize = "8.4 MB",
                    UploaderComment = "Yeni omurga switch kurulumu sonrası ağ şeması güncellemesi.",
                    Privacy = "Department",
                    EditPermission = "OwnerOnly",
                    AccessPassword = null,
                    LastModifiedBy = "it_user"
                }
            );

            // Seed Collaborators
            modelBuilder.Entity<DocumentCollaborator>().HasData(
                new DocumentCollaborator { Id = 1, DocumentId = 2, CollaboratorUsername = "admin", CanEdit = true },
                new DocumentCollaborator { Id = 2, DocumentId = 2, CollaboratorUsername = "hr_user", CanEdit = false }
            );

            // Seed DocumentVersions
            modelBuilder.Entity<DocumentVersion>().HasData(
                new DocumentVersion
                {
                    Id = 1,
                    DocumentId = 2,
                    VersionNumber = 1,
                    FileUrl = "https://company.com/files/budget-v1.docx",
                    FileSize = "1.2 MB",
                    ModifiedBy = "fin_user",
                    ModifiedDate = DateTime.UtcNow.AddDays(-5).ToString("yyyy-MM-dd HH:mm:ss"),
                    Comment = "İlk taslak sürüm oluşturuldu."
                },
                new DocumentVersion
                {
                    Id = 2,
                    DocumentId = 2,
                    VersionNumber = 2,
                    FileUrl = "https://company.com/files/budget-v2.docx",
                    FileSize = "1.4 MB",
                    ModifiedBy = "admin",
                    ModifiedDate = DateTime.UtcNow.AddDays(-2).ToString("yyyy-MM-dd HH:mm:ss"),
                    Comment = "Yönetici geri bildirimleri bütçeye eklendi."
                }
            );

            // Seed Mock Admin Approval Request
            modelBuilder.Entity<AdminApprovalRequest>().HasData(
                new AdminApprovalRequest
                {
                    Id = 1,
                    RequestedByUsername = "it_user",
                    Title = "Kurumsal Sunucu Mimari Şeması (server-architecture.png)",
                    Description = "Lütfen IT subnet'inde kullanılmak üzere hazırladığım sunucu mimari şemasını onaylayın. Ek açıklama: server-diagnostic.txt alt yapısına göre test edilmiştir.",
                    IsApproved = false,
                    IsPending = true,
                    CreatedDate = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss")
                }
            );
        }
    }
}
