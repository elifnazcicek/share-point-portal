using System;
using System.ComponentModel.DataAnnotations;

namespace SharePointBackend.Models
{
    public class AdminApprovalRequest
    {
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string RequestedByUsername { get; set; } = string.Empty;

        [Required]
        [MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        [Required]
        public string Description { get; set; } = string.Empty;

        public bool IsApproved { get; set; } = false;
        public bool IsPending { get; set; } = true;

        [Required]
        [MaxLength(50)]
        public string CreatedDate { get; set; } = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");

        public string? ActionedByUsername { get; set; }
        public string? ActionedDate { get; set; }
    }
}
