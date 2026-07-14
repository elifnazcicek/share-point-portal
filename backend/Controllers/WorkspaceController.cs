using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SharePointBackend.Data;
using SharePointBackend.Models;
using System;
using System.Linq;
using System.Threading.Tasks;
using System.IO;
using System.Text;
using ExcelDataReader;

namespace SharePointBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class WorkspaceController : ControllerBase
    {
        private readonly PortalDbContext _context;

        public WorkspaceController(PortalDbContext context)
        {
            _context = context;
        }

        // GET: api/workspace/documents?username=user1
        [HttpGet("documents")]
        public async Task<IActionResult> GetDocuments(string? username)
        {
            var user = username ?? string.Empty;

            // Fetch user's role (department name) to apply Department Privacy filter
            var currentUserObj = await _context.Users.FirstOrDefaultAsync(u => u.Username.ToLower() == user.ToLower());
            string currentUserRole = currentUserObj?.Role ?? string.Empty;

            // Fetch public docs, owned docs, or docs shared with user
            var sharedDocIds = await _context.DocumentCollaborators
                .Where(c => c.CollaboratorUsername.ToLower() == user.ToLower())
                .Select(c => c.DocumentId)
                .ToListAsync();

            var docs = await _context.WorkspaceDocuments.ToListAsync();

            var filteredDocs = docs.Where(d =>
                d.Privacy == "Public" || d.IsPublic ||
                d.OwnerUsername.ToLower() == user.ToLower() ||
                sharedDocIds.Contains(d.Id) ||
                (d.Privacy == "Department" && !string.IsNullOrEmpty(currentUserRole) &&
                 _context.Users.Any(u => u.Username.ToLower() == d.OwnerUsername.ToLower() && u.Role == currentUserRole))
            ).ToList();

            bool needsSave = false;
            foreach (var d in filteredDocs)
            {
                if (d.IsFile && string.IsNullOrEmpty(d.Content) && !string.IsNullOrEmpty(d.FileUrl))
                {
                    var ext = Path.GetExtension(d.Title ?? string.Empty).ToLowerInvariant();
                    if (ext == ".xlsx" || ext == ".xls")
                    {
                        var uploadDir = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads");
                        var fileName = Path.GetFileName(d.FileUrl);
                        if (!string.IsNullOrEmpty(fileName))
                        {
                            var filePath = Path.Combine(uploadDir, fileName);
                            if (System.IO.File.Exists(filePath))
                            {
                                try
                                {
                                    d.Content = ConvertExcelToHtmlTable(filePath);
                                    _context.WorkspaceDocuments.Update(d);
                                    needsSave = true;
                                }
                                catch {}
                            }
                        }
                    }
                    else if (ext == ".txt" || ext == ".md" || ext == ".html" || ext == ".css" || ext == ".js" || ext == ".json")
                    {
                        var uploadDir = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads");
                        var fileName = Path.GetFileName(d.FileUrl);
                        if (!string.IsNullOrEmpty(fileName))
                        {
                            var filePath = Path.Combine(uploadDir, fileName);
                            if (System.IO.File.Exists(filePath))
                            {
                                try
                                {
                                    d.Content = System.IO.File.ReadAllText(filePath);
                                    _context.WorkspaceDocuments.Update(d);
                                    needsSave = true;
                                }
                                catch {}
                            }
                        }
                    }
                }
            }

            if (needsSave)
            {
                await _context.SaveChangesAsync();
            }

            var result = filteredDocs.Select(d => {
                bool isPasswordProtected = !string.IsNullOrEmpty(d.AccessPassword);
                bool isOwner = d.OwnerUsername.ToLower() == user.ToLower();
                bool hasAccess = isOwner || sharedDocIds.Contains(d.Id);

                // Obfuscate text and file URLs for password-protected files if user doesn't have direct ownership/collaborator rights yet
                bool shouldObfuscate = isPasswordProtected && !hasAccess;

                return new
                {
                    d.Id,
                    d.Title,
                    Content = shouldObfuscate ? "Bu dosya şifrelenmiştir. Erişmek için şifre girmeniz gerekmektedir." : d.Content,
                    d.OwnerUsername,
                    IsPublic = d.Privacy == "Public" || d.IsPublic,
                    d.Privacy,
                    d.EditPermission,
                    IsPasswordProtected = isPasswordProtected,
                    d.CreatedDate,
                    d.ModifiedDate,
                    d.IsFile,
                    FileUrl = shouldObfuscate ? null : d.FileUrl,
                    d.FileSize,
                    d.UploaderComment,
                    LastModifiedBy = d.LastModifiedBy ?? d.OwnerUsername,
                    // Check edit permissions
                    CanEdit = (isOwner || _context.DocumentCollaborators.Any(c => c.DocumentId == d.Id && c.CollaboratorUsername.ToLower() == user.ToLower() && c.CanEdit)) &&
                              (d.EditPermission == "Everyone" || isOwner)
                };
            }).ToList();

            return Ok(result);
        }

        // POST: api/workspace/documents
        [HttpPost("documents")]
        public async Task<IActionResult> CreateDocument([FromBody] WorkspaceDocument document)
        {
            if (string.IsNullOrWhiteSpace(document.Title))
                return BadRequest("Başlık zorunludur.");

            document.CreatedDate = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");
            document.ModifiedDate = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");
            document.Privacy = string.IsNullOrWhiteSpace(document.Privacy) ? "Public" : document.Privacy;
            document.EditPermission = string.IsNullOrWhiteSpace(document.EditPermission) ? "Everyone" : document.EditPermission;
            document.LastModifiedBy = document.OwnerUsername;

            _context.WorkspaceDocuments.Add(document);
            await _context.SaveChangesAsync();

            return Ok(document);
        }

        // PUT: api/workspace/documents/5?username=user1
        [HttpPut("documents/{id}")]
        public async Task<IActionResult> UpdateDocument(int id, [FromQuery] string username, [FromBody] WorkspaceDocument request)
        {
            var doc = await _context.WorkspaceDocuments.FindAsync(id);
            if (doc == null) return NotFound("Belge bulunamadı.");

            // Verify permissions
            bool isOwner = doc.OwnerUsername.ToLower() == username.ToLower();
            bool isCollaboratorWithEdit = await _context.DocumentCollaborators
                .AnyAsync(c => c.DocumentId == id && c.CollaboratorUsername.ToLower() == username.ToLower() && c.CanEdit);

            // Enforce OwnerOnly edit restriction
            if (doc.EditPermission == "OwnerOnly" && !isOwner)
            {
                return Forbid("Bu belge sadece sahibi tarafından düzenlenebilir.");
            }

            if (!isOwner && !isCollaboratorWithEdit)
            {
                return Forbid("Bu belgeyi düzenleme yetkiniz yok.");
            }

            // Version tracking logic
            bool isContentChanged = doc.Content != request.Content || doc.FileUrl != request.FileUrl;
            if (isContentChanged)
            {
                var maxVer = await _context.DocumentVersions
                    .Where(v => v.DocumentId == id)
                    .Select(v => (int?)v.VersionNumber)
                    .MaxAsync() ?? 0;

                if (maxVer == 0)
                {
                    var originalVersion = new DocumentVersion
                    {
                        DocumentId = id,
                        VersionNumber = 1,
                        FileUrl = doc.FileUrl ?? string.Empty,
                        FileSize = doc.FileSize ?? string.Empty,
                        ModifiedBy = doc.LastModifiedBy ?? doc.OwnerUsername,
                        ModifiedDate = doc.ModifiedDate ?? doc.CreatedDate,
                        Comment = doc.UploaderComment ?? "İlk Sürüm",
                        Content = doc.Content ?? string.Empty
                    };
                    _context.DocumentVersions.Add(originalVersion);
                    maxVer = 1;
                }

                var newVerNum = maxVer + 1;
                var nextVersion = new DocumentVersion
                {
                    DocumentId = id,
                    VersionNumber = newVerNum,
                    FileUrl = request.FileUrl ?? doc.FileUrl ?? string.Empty,
                    FileSize = request.FileSize ?? doc.FileSize ?? string.Empty,
                    ModifiedBy = username,
                    ModifiedDate = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss"),
                    Comment = request.UploaderComment ?? $"Sürüm {newVerNum} Güncellemesi",
                    Content = request.Content ?? string.Empty
                };
                _context.DocumentVersions.Add(nextVersion);
            }

            doc.Title = request.Title;
            doc.Content = request.Content;
            doc.ModifiedDate = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");
            doc.LastModifiedBy = username;

            // Update file properties if any
            if (request.IsFile)
            {
                doc.IsFile = true;
                doc.FileUrl = request.FileUrl;
                doc.FileSize = request.FileSize;
                doc.UploaderComment = request.UploaderComment;
            }

            await _context.SaveChangesAsync();
            return Ok(doc);
        }

        // DELETE: api/workspace/documents/5?username=user1
        [HttpDelete("documents/{id}")]
        public async Task<IActionResult> DeleteDocument(int id, [FromQuery] string username)
        {
            var doc = await _context.WorkspaceDocuments.FindAsync(id);
            if (doc == null) return NotFound("Belge bulunamadı.");

            if (doc.OwnerUsername.ToLower() != username.ToLower())
            {
                return Forbid("Sadece belge sahibi silebilir.");
            }

            // Remove collaborators too
            var collaborators = await _context.DocumentCollaborators.Where(c => c.DocumentId == id).ToListAsync();
            _context.DocumentCollaborators.RemoveRange(collaborators);

            _context.WorkspaceDocuments.Remove(doc);
            await _context.SaveChangesAsync();

            return Ok(new { Success = true });
        }

        // GET: api/workspace/documents/5/collaborators
        [HttpGet("documents/{id}/collaborators")]
        public async Task<IActionResult> GetCollaborators(int id)
        {
            var collaborators = await _context.DocumentCollaborators
                .Where(c => c.DocumentId == id)
                .ToListAsync();

            return Ok(collaborators);
        }

        // POST: api/workspace/documents/5/collaborator
        [HttpPost("documents/{id}/collaborator")]
        public async Task<IActionResult> InviteCollaborator(int id, [FromBody] DocumentCollaborator request)
        {
            var userExists = await _context.Users.AnyAsync(u => u.Username.ToLower() == request.CollaboratorUsername.ToLower());
            if (!userExists)
            {
                return BadRequest("Kullanıcı bulunamadı.");
            }

            // Check if already collaborating
            var exists = await _context.DocumentCollaborators
                .AnyAsync(c => c.DocumentId == id && c.CollaboratorUsername.ToLower() == request.CollaboratorUsername.ToLower());

            if (exists)
            {
                return BadRequest("Bu kullanıcı zaten davet edilmiş.");
            }

            request.DocumentId = id;
            _context.DocumentCollaborators.Add(request);
            await _context.SaveChangesAsync();

            return Ok(request);
        }

        // DELETE: api/workspace/documents/5/collaborator/username1
        [HttpDelete("documents/{id}/collaborator/{username}")]
        public async Task<IActionResult> RemoveCollaborator(int id, string username)
        {
            var collab = await _context.DocumentCollaborators
                .FirstOrDefaultAsync(c => c.DocumentId == id && c.CollaboratorUsername.ToLower() == username.ToLower());

            if (collab == null) return NotFound("Davet bulunamadı.");

            _context.DocumentCollaborators.Remove(collab);
            await _context.SaveChangesAsync();

            return Ok(new { Success = true });
        }

        // GET: api/workspace/approvals
        [HttpGet("approvals")]
        public async Task<IActionResult> GetApprovals()
        {
            var approvals = await _context.AdminApprovalRequests.OrderByDescending(r => r.CreatedDate).ToListAsync();
            return Ok(approvals);
        }

        // POST: api/workspace/approvals
        [HttpPost("approvals")]
        public async Task<IActionResult> CreateApproval([FromBody] AdminApprovalRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Title) || string.IsNullOrWhiteSpace(request.RequestedByUsername))
                return BadRequest("Talep başlığı ve kullanıcı adı zorunludur.");

            request.IsPending = true;
            request.IsApproved = false;
            request.CreatedDate = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");

            _context.AdminApprovalRequests.Add(request);
            
            // Log Action
            var log = new DeviceLog
            {
                DeviceName = "WORKSTATION-01",
                IpAddress = "192.168.1.15",
                MacAddress = "00-50-56-C0-00-08",
                Action = $"Submitted approval request: {request.Title}",
                Timestamp = DateTime.UtcNow,
                DepartmentName = "Pending Approval"
            };
            _context.DeviceLogs.Add(log);

            await _context.SaveChangesAsync();
            return Ok(request);
        }

        // POST: api/workspace/approvals/5/action?username=admin&approved=true
        [HttpPost("approvals/{id}/action")]
        public async Task<IActionResult> ActionApproval(int id, [FromQuery] string username, [FromQuery] bool approved)
        {
            var req = await _context.AdminApprovalRequests.FindAsync(id);
            if (req == null) return NotFound("Onay talebi bulunamadı.");

            req.IsPending = false;
            req.IsApproved = approved;
            req.ActionedByUsername = username;
            req.ActionedDate = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");

            // Audit Log
            var log = new DeviceLog
            {
                DeviceName = "WORKSTATION-01",
                IpAddress = "192.168.1.15",
                MacAddress = "00-50-56-C0-00-08",
                Action = $"Admin ({username}) actioned approval request '{req.Title}': {(approved ? "APPROVED" : "REJECTED")}",
                Timestamp = DateTime.UtcNow,
                DepartmentName = "System Admin"
            };
            _context.DeviceLogs.Add(log);

            await _context.SaveChangesAsync();
            return Ok(req);
        }

        // POST: api/workspace/documents/{id}/verify-password
        [HttpPost("documents/{id}/verify-password")]
        public async Task<IActionResult> VerifyPassword(int id, [FromBody] PasswordVerifyDto request)
        {
            var doc = await _context.WorkspaceDocuments.FindAsync(id);
            if (doc == null) return NotFound("Belge bulunamadı.");

            if (doc.AccessPassword == request.Password)
            {
                return Ok(new
                {
                    Success = true,
                    Content = doc.Content,
                    FileUrl = doc.FileUrl
                });
            }

            return BadRequest("Hatalı erişim şifresi.");
        }

        // PUT: api/workspace/documents/{id}/privacy?username=user1
        [HttpPut("documents/{id}/privacy")]
        public async Task<IActionResult> UpdatePrivacy(int id, [FromQuery] string username, [FromBody] PrivacyUpdateDto request)
        {
            var doc = await _context.WorkspaceDocuments.FindAsync(id);
            if (doc == null) return NotFound("Belge bulunamadı.");

            if (doc.OwnerUsername.ToLower() != username.ToLower())
            {
                return Forbid("Sadece belge sahibi gizlilik ayarlarını değiştirebilir.");
            }

            doc.Privacy = request.Privacy;
            doc.EditPermission = request.EditPermission;
            doc.AccessPassword = string.IsNullOrWhiteSpace(request.AccessPassword) ? null : request.AccessPassword;
            doc.ModifiedDate = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");

            await _context.SaveChangesAsync();
            return Ok(doc);
        }

        // POST: api/workspace/upload
        [HttpPost("upload")]
        public async Task<IActionResult> UploadFile(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest("Geçersiz dosya.");

            var uploadDir = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads");
            if (!Directory.Exists(uploadDir))
            {
                Directory.CreateDirectory(uploadDir);
            }

            var fileName = Guid.NewGuid().ToString() + Path.GetExtension(file.FileName);
            var filePath = Path.Combine(uploadDir, fileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            var fileUrl = $"http://localhost:5100/uploads/{fileName}";
            string sizeStr = file.Length >= 1024 * 1024
                ? $"{(double)file.Length / (1024 * 1024):F1} MB"
                : $"{(double)file.Length / 1024:F0} KB";

            // Parse file content if it is text or excel!
            string? fileContent = null;
            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (ext == ".txt" || ext == ".md" || ext == ".html" || ext == ".css" || ext == ".js" || ext == ".json")
            {
                try
                {
                    fileContent = await System.IO.File.ReadAllTextAsync(filePath);
                }
                catch {}
            }
            else if (ext == ".xlsx" || ext == ".xls")
            {
                fileContent = ConvertExcelToHtmlTable(filePath);
            }

            return Ok(new
            {
                FileUrl = fileUrl,
                FileSize = sizeStr,
                Title = file.FileName,
                Content = fileContent
            });
        }

        private string ConvertExcelToHtmlTable(string filePath)
        {
            try
            {
                System.Text.Encoding.RegisterProvider(System.Text.CodePagesEncodingProvider.Instance);
                using (var stream = System.IO.File.Open(filePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
                {
                    using (var reader = ExcelReaderFactory.CreateReader(stream))
                    {
                        var result = reader.AsDataSet(new ExcelDataSetConfiguration()
                        {
                            ConfigureDataTable = (_) => new ExcelDataTableConfiguration()
                            {
                                UseHeaderRow = true
                            }
                        });

                        if (result.Tables.Count == 0)
                            return "<p style='color:red;text-align:center;padding:20px;'>Excel dosyası boş veya sayfası bulunamadı.</p>";

                        var table = result.Tables[0]; // Read first sheet
                        var html = new StringBuilder();
                        html.Append("<table class='excel-table'>");

                        // Headers
                        html.Append("<thead><tr>");
                        foreach (System.Data.DataColumn column in table.Columns)
                        {
                            html.AppendFormat("<th>{0}</th>", System.Net.WebUtility.HtmlEncode(column.ColumnName));
                        }
                        html.Append("</tr></thead>");

                        // Rows
                        html.Append("<tbody>");
                        foreach (System.Data.DataRow row in table.Rows)
                        {
                            html.Append("<tr>");
                            foreach (var item in row.ItemArray)
                            {
                                html.AppendFormat("<td>{0}</td>", System.Net.WebUtility.HtmlEncode(item?.ToString() ?? ""));
                            }
                            html.Append("</tr>");
                        }
                        html.Append("</tbody></table>");

                        return html.ToString();
                    }
                }
            }
            catch (Exception ex)
            {
                return $"<p style='color:red;padding:20px;'>Excel okuma hatası: {System.Net.WebUtility.HtmlEncode(ex.Message)}</p>";
            }
        }

        // GET: api/workspace/documents/{id}/versions
        [HttpGet("documents/{id}/versions")]
        public async Task<IActionResult> GetVersions(int id)
        {
            var versions = await _context.DocumentVersions
                .Where(v => v.DocumentId == id)
                .OrderByDescending(v => v.VersionNumber)
                .ToListAsync();

            return Ok(versions);
        }

        // POST: api/workspace/documents/{id}/restore/{versionNumber}?username=user1
        [HttpPost("documents/{id}/restore/{versionNumber}")]
        public async Task<IActionResult> RestoreVersion(int id, int versionNumber, [FromQuery] string username)
        {
            var doc = await _context.WorkspaceDocuments.FindAsync(id);
            if (doc == null) return NotFound("Belge bulunamadı.");

            bool isOwner = doc.OwnerUsername.ToLower() == username.ToLower();
            bool isCollaboratorWithEdit = await _context.DocumentCollaborators
                .AnyAsync(c => c.DocumentId == id && c.CollaboratorUsername.ToLower() == username.ToLower() && c.CanEdit);

            if (doc.EditPermission == "OwnerOnly" && !isOwner)
            {
                return Forbid("Bu belgeyi sadece sahibi geri yükleyebilir.");
            }

            if (!isOwner && !isCollaboratorWithEdit)
            {
                return Forbid("Bu belgeyi geri yükleme yetkiniz yok.");
            }

            var version = await _context.DocumentVersions
                .FirstOrDefaultAsync(v => v.DocumentId == id && v.VersionNumber == versionNumber);

            if (version == null) return NotFound("Sürüm bulunamadı.");

            var maxVer = await _context.DocumentVersions
                .Where(v => v.DocumentId == id)
                .Select(v => (int?)v.VersionNumber)
                .MaxAsync() ?? 0;

            if (maxVer == 0)
            {
                var originalVersion = new DocumentVersion
                {
                    DocumentId = id,
                    VersionNumber = 1,
                    FileUrl = doc.FileUrl ?? string.Empty,
                    FileSize = doc.FileSize ?? string.Empty,
                    ModifiedBy = doc.LastModifiedBy ?? doc.OwnerUsername,
                    ModifiedDate = doc.ModifiedDate ?? doc.CreatedDate,
                    Comment = doc.UploaderComment ?? "İlk Sürüm",
                    Content = doc.Content ?? string.Empty
                };
                _context.DocumentVersions.Add(originalVersion);
                maxVer = 1;
            }

            var newVerNum = maxVer + 1;
            var nextVersion = new DocumentVersion
            {
                DocumentId = id,
                VersionNumber = newVerNum,
                FileUrl = version.FileUrl,
                FileSize = version.FileSize,
                ModifiedBy = username,
                ModifiedDate = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss"),
                Comment = $"v{versionNumber}.0 sürümünden geri yüklendi.",
                Content = version.Content
            };
            _context.DocumentVersions.Add(nextVersion);

            doc.FileUrl = version.FileUrl;
            doc.FileSize = version.FileSize;
            doc.Content = version.Content;
            doc.ModifiedDate = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");
            doc.LastModifiedBy = username;
            doc.UploaderComment = $"v{versionNumber}.0 sürümünden geri yüklendi.";

            await _context.SaveChangesAsync();
            return Ok(doc);
        }
    }

    public class PasswordVerifyDto
    {
        public string Password { get; set; } = string.Empty;
    }

    public class PrivacyUpdateDto
    {
        public string Privacy { get; set; } = "Public";
        public string EditPermission { get; set; } = "Everyone";
        public string? AccessPassword { get; set; }
    }
}
