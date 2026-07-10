using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SharePointBackend.Data;
using SharePointBackend.Models;
using System;
using System.Linq;
using System.Threading.Tasks;

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

            // Fetch public docs, owned docs, or docs shared with user
            var sharedDocIds = await _context.DocumentCollaborators
                .Where(c => c.CollaboratorUsername.ToLower() == user.ToLower())
                .Select(c => c.DocumentId)
                .ToListAsync();

            var docs = await _context.WorkspaceDocuments
                .Where(d => d.IsPublic || d.OwnerUsername.ToLower() == user.ToLower() || sharedDocIds.Contains(d.Id))
                .ToListAsync();

            var result = docs.Select(d => new
            {
                d.Id,
                d.Title,
                d.Content,
                d.OwnerUsername,
                d.IsPublic,
                d.CreatedDate,
                d.ModifiedDate,
                d.IsFile,
                d.FileUrl,
                d.FileSize,
                d.UploaderComment,
                // Check if user has edit permission
                CanEdit = d.OwnerUsername.ToLower() == user.ToLower() || 
                          _context.DocumentCollaborators.Any(c => c.DocumentId == d.Id && c.CollaboratorUsername.ToLower() == user.ToLower() && c.CanEdit)
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

            if (!isOwner && !isCollaboratorWithEdit)
            {
                return Forbid("Bu belgeyi düzenleme yetkiniz yok.");
            }

            doc.Title = request.Title;
            doc.Content = request.Content;
            doc.IsPublic = request.IsPublic;
            doc.ModifiedDate = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");

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
    }
}
