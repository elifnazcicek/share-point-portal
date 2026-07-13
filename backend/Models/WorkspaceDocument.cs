using System;
using System.ComponentModel.DataAnnotations;

namespace SharePointBackend.Models
{
    public class WorkspaceDocument
    {
        public int Id { get; set; }

        [Required]
        [MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        [Required]
        public string Content { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string OwnerUsername { get; set; } = string.Empty;

        public bool IsPublic { get; set; } = false;

        [Required]
        [MaxLength(50)]
        public string CreatedDate { get; set; } = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");

        [MaxLength(50)]
        public string ModifiedDate { get; set; } = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");

        // Metadata for file uploads
        public bool IsFile { get; set; } = false;
        public string? FileUrl { get; set; }
        public string? FileSize { get; set; }
        public string? UploaderComment { get; set; } // Comment on upload

        // Privacy and Access Controls
        [MaxLength(50)]
        public string Privacy { get; set; } = "Public"; // Public, Private, Department

        [MaxLength(50)]
        public string EditPermission { get; set; } = "Everyone"; // Everyone, OwnerOnly

        [MaxLength(255)]
        public string? AccessPassword { get; set; }
    }
}
