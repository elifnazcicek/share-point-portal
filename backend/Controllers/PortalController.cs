using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SharePointBackend.Data;
using SharePointBackend.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;

namespace SharePointBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PortalController : ControllerBase
    {
        private readonly PortalDbContext _context;
        private readonly IConfiguration _config;

        public PortalController(PortalDbContext context, IConfiguration config)
        {
            _context = context;
            _config = config;
        }

        // Helper to map IP address to Department Id
        private int? GetDepartmentIdFromIp(string ip)
        {
            if (string.IsNullOrEmpty(ip)) return null;

            if (ip.StartsWith("192.168.1.")) return 1; // IT
            if (ip.StartsWith("192.168.2.")) return 2; // HR
            if (ip.StartsWith("192.168.3.")) return 3; // Finance
            if (ip.StartsWith("192.168.4.")) return 4; // Marketing
            if (ip.StartsWith("192.168.5.")) return 5; // Operations

            return null; // Guest/External
        }

        // GET: api/portal/profile
        [HttpGet("profile")]
        public async Task<IActionResult> GetProfile(string? ip, string? deviceName, string? macAddress, string? username)
        {
            // Default parameters if missing
            string clientIp = ip ?? HttpContext.Connection.RemoteIpAddress?.ToString() ?? "192.168.1.100";
            // Clean IPv6 loopback to a test IP
            if (clientIp == "::1" || clientIp == "127.0.0.1") clientIp = "192.168.1.15"; // Default mock IT IP

            string dName = deviceName ?? "WORKSTATION-01";
            string mac = macAddress ?? "00-50-56-C0-00-08";

            int? deptId = null;
            Department? department = null;

            // Prioritize user authenticated role/department matching
            if (!string.IsNullOrEmpty(username))
            {
                var dbUser = await _context.Users.FirstOrDefaultAsync(u => u.Username.ToLower() == username.ToLower());
                if (dbUser != null && !string.IsNullOrEmpty(dbUser.Role))
                {
                    department = await _context.Departments.FirstOrDefaultAsync(d => d.Name.ToLower() == dbUser.Role.ToLower());
                    if (department != null)
                    {
                        deptId = department.Id;
                    }
                }
            }

            // Fallback to network IP detection
            if (deptId == null)
            {
                deptId = GetDepartmentIdFromIp(clientIp);
                if (deptId.HasValue)
                {
                    department = await _context.Departments.FindAsync(deptId.Value);
                }
            }

            string deptName = department?.Name ?? "Guest Network";

            // 1. Fetch Shortcuts & determine accessibility
            var dbShortcuts = await _context.Shortcuts.Include(s => s.Department).ToListAsync();
            var shortcutsDto = dbShortcuts.Select(s => new
            {
                s.Id,
                s.Name,
                s.Url,
                s.Icon,
                s.Color,
                s.Description,
                s.DepartmentId,
                DepartmentName = s.Department?.Name ?? "Public",
                s.IsLocked,
                IsAccessible = !s.IsLocked || (deptId.HasValue && s.DepartmentId == deptId.Value)
            }).ToList();

            // 2. Fetch Announcements
            var announcements = await _context.Announcements
                .Where(a => a.DepartmentId == null || (deptId.HasValue && a.DepartmentId == deptId.Value))
                .OrderByDescending(a => a.CreatedAt)
                .Select(a => new {
                    a.Id,
                    a.Title,
                    a.Content,
                    a.Priority,
                    a.CreatedAt,
                    DepartmentName = a.Department != null ? a.Department.Name : "General"
                })
                .ToListAsync();

            // 3. Fetch Custom Shortcuts for this device
            var customShortcuts = await _context.CustomShortcuts
                .Where(c => c.DeviceIp == clientIp)
                .ToListAsync();

            // 4. Log Access Audit
            var log = new DeviceLog
            {
                DeviceName = dName,
                IpAddress = clientIp,
                MacAddress = mac,
                Action = $"Accessed portal profile ({deptName})",
                Timestamp = DateTime.UtcNow,
                DepartmentName = deptName
            };
            _context.DeviceLogs.Add(log);
            await _context.SaveChangesAsync();

            // 5. Fetch Recent Logs for widget
            var recentLogs = await _context.DeviceLogs
                .OrderByDescending(l => l.Timestamp)
                .Take(10)
                .ToListAsync();

            return Ok(new
            {
                Device = new
                {
                    IpAddress = clientIp,
                    DeviceName = dName,
                    MacAddress = mac,
                    Department = department != null ? new { department.Id, department.Name, department.Description, department.IpRange } : null
                },
                Shortcuts = shortcutsDto,
                CustomShortcuts = customShortcuts,
                Announcements = announcements,
                RecentLogs = recentLogs
            });
        }

        // POST: api/portal/shortcut
        [HttpPost("shortcut")]
        public async Task<IActionResult> AddCustomShortcut([FromBody] CustomShortcut shortcut)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            _context.CustomShortcuts.Add(shortcut);
            
            // Audit Log
            var log = new DeviceLog
            {
                DeviceName = "WORKSTATION-01",
                IpAddress = shortcut.DeviceIp,
                MacAddress = "00-50-56-C0-00-08",
                Action = $"Added custom shortcut: {shortcut.Name}",
                Timestamp = DateTime.UtcNow,
                DepartmentName = GetDepartmentIdFromIp(shortcut.DeviceIp) switch
                {
                    1 => "IT Department",
                    2 => "HR Department",
                    3 => "Finance Department",
                    4 => "Marketing Department",
                    5 => "Operations Department",
                    _ => "Guest Network"
                }
            };
            _context.DeviceLogs.Add(log);
            
            await _context.SaveChangesAsync();
            return Ok(shortcut);
        }

        // DELETE: api/portal/shortcut/{id}
        [HttpDelete("shortcut/{id}")]
        public async Task<IActionResult> DeleteCustomShortcut(int id, [FromQuery] string ip)
        {
            var shortcut = await _context.CustomShortcuts.FindAsync(id);
            if (shortcut == null)
            {
                return NotFound();
            }

            if (shortcut.DeviceIp != ip)
            {
                return Forbid("Unauthorized to delete this shortcut");
            }

            _context.CustomShortcuts.Remove(shortcut);

            // Audit Log
            var log = new DeviceLog
            {
                DeviceName = "WORKSTATION-01",
                IpAddress = ip,
                MacAddress = "00-50-56-C0-00-08",
                Action = $"Deleted custom shortcut: {shortcut.Name}",
                Timestamp = DateTime.UtcNow,
                DepartmentName = GetDepartmentIdFromIp(ip) switch
                {
                    1 => "IT Department",
                    2 => "HR Department",
                    3 => "Finance Department",
                    4 => "Marketing Department",
                    5 => "Operations Department",
                    _ => "Guest Network"
                }
            };
            _context.DeviceLogs.Add(log);

            await _context.SaveChangesAsync();
            return Ok(new { Message = "Shortcut deleted successfully" });
        }

        // POST: api/portal/log
        [HttpPost("log")]
        public async Task<IActionResult> LogAction([FromBody] DeviceLog log)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            log.Timestamp = DateTime.UtcNow;
            _context.DeviceLogs.Add(log);
            await _context.SaveChangesAsync();
            return Ok(new { Status = "Logged" });
        }

        // GET: api/portal/admin/users
        [HttpGet("admin/users")]
        public async Task<IActionResult> GetAdminUsers()
        {
            var users = await _context.Users
                .Select(u => new { u.Username, u.FullName, u.Email, u.Role, u.IsActive })
                .ToListAsync();
            return Ok(users);
        }

        // PUT: api/portal/admin/users/{username}/role
        [HttpPut("admin/users/{username}/role")]
        public async Task<IActionResult> UpdateUserRole(string username, [FromQuery] string role)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Username.ToLower() == username.ToLower());
            if (user == null) return NotFound("Kullanıcı bulunamadı.");

            user.Role = role;

            // Audit log
            var log = new DeviceLog
            {
                DeviceName = "WORKSTATION-01",
                IpAddress = "192.168.1.15",
                MacAddress = "00-50-56-C0-00-08",
                Action = $"Updated user role for '{user.Username}' to '{role}'",
                Timestamp = DateTime.UtcNow,
                DepartmentName = "System Admin"
            };
            _context.DeviceLogs.Add(log);

            await _context.SaveChangesAsync();
            return Ok(new { user.Username, user.Role });
        }

        private static readonly HttpClient _httpClient = new HttpClient();

        // POST: api/portal/ai/chat
        [HttpPost("ai/chat")]
        public async Task<IActionResult> AskAi([FromBody] ChatRequestDto request)
        {
            if (string.IsNullOrEmpty(request.Message))
                return BadRequest("Mesaj boş olamaz.");

            // 1. Fetch active database records to serve as context
            var users = await _context.Users
                .Select(u => $"- {u.FullName} (@{u.Username}) - {u.Role} (E-posta: {u.Email})")
                .ToListAsync();

            var docs = await _context.WorkspaceDocuments
                .Select(d => $"- {d.Title} ({d.FileSize}, Yükleyen: {d.OwnerUsername})")
                .ToListAsync();

            var announcements = await _context.Announcements
                .Select(a => $"- {a.Title} ({ (a.Department != null ? a.Department.Name : "Genel Duyuru") })")
                .ToListAsync();

            var logs = await _context.DeviceLogs
                .OrderByDescending(l => l.Timestamp)
                .Take(5)
                .Select(l => $"- [{l.Timestamp:dd.MM.yyyy HH:mm}] {l.Action} (IP: {l.IpAddress})")
                .ToListAsync();

            // 2. Build system instruction prompt presenting live context
            string systemPrompt = "Sen PortalOne kurum içi yapay zeka asistanısın. Kullanıcılar sistemdeki dosyaları, çalışanları, duyuruları, kendi notlarını ve ağ durumlarını sorgulayabilir. " +
                                  "Aşağıda sistemin güncel canlı verileri listelenmiştir. Lütfen yanıtlarını bu verilere dayandırarak Türkçe, güler yüzlü ve yardımcı bir dille ver.\n\n" +
                                  "GÜNCEL CANLI SİSTEM VERİLERİ:\n\n" +
                                  "1. Sistemdeki Çalışanlar:\n" + string.Join("\n", users) + "\n\n" +
                                  "2. Yüklenen Dosyalar & Belgeler:\n" + string.Join("\n", docs) + "\n\n" +
                                  "3. Son Duyurular & Haberler:\n" + string.Join("\n", announcements) + "\n\n" +
                                  "4. Son Sistem Güvenlik ve İşlem Günlükleri (Logs):\n" + string.Join("\n", logs) + "\n\n" +
                                  "Kullanıcı Sorusu: " + request.Message;

            // 3. Read Gemini API Key and Model configuration
            string apiKey = _config["Gemini:ApiKey"] ?? "";
            string model = _config["Gemini:Model"] ?? "gemini-flash-latest";
            string url = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}";

            var requestBody = new
            {
                contents = new[]
                {
                    new
                    {
                        parts = new[]
                        {
                            new { text = systemPrompt }
                        }
                    }
                }
            };

            try
            {
                var response = await _httpClient.PostAsJsonAsync(url, requestBody);
                if (response.IsSuccessStatusCode)
                {
                    var result = await response.Content.ReadFromJsonAsync<GeminiResponse>();
                    string? aiResponse = result?.Candidates?[0]?.Content?.Parts?[0]?.Text;
                    if (!string.IsNullOrEmpty(aiResponse))
                    {
                        return Ok(new { response = aiResponse });
                    }
                }
                
                // Read error message from response if failed
                string errorDetail = await response.Content.ReadAsStringAsync();
                return Ok(new { response = $"Bulut yapay zeka servisi hata döndürdü: {response.StatusCode}. Detay: {errorDetail}" });
            }
            catch (Exception ex)
            {
                return Ok(new { response = $"Yapay zeka asistanı çalıştırılırken bir hata oluştu: {ex.Message}" });
            }
        }

        public class ChatRequestDto
        {
            public string Message { get; set; } = "";
            public string Username { get; set; } = "";
        }

        public class GeminiResponse
        {
            public GeminiCandidate[] Candidates { get; set; } = Array.Empty<GeminiCandidate>();
        }

        public class GeminiCandidate
        {
            public GeminiContent Content { get; set; } = new GeminiContent();
        }

        public class GeminiContent
        {
            public GeminiPart[] Parts { get; set; } = Array.Empty<GeminiPart>();
        }

        public class GeminiPart
        {
            public string Text { get; set; } = "";
        }
    }
}
