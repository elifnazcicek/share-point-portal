using System;
using System.ComponentModel.DataAnnotations;

namespace SharePointBackend.Models
{
    public class Announcement
    {
        public int Id { get; set; }

        [Required]
        [MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        [Required]
        public string Content { get; set; } = string.Empty;

        [MaxLength(50)]
        public string Priority { get; set; } = "info"; // info, success, warning, danger

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public int? DepartmentId { get; set; } // Nullable, if null broadcast to all
        public Department? Department { get; set; }
    }
}
