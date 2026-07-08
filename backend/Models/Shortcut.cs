using System.ComponentModel.DataAnnotations;

namespace SharePointBackend.Models
{
    public class Shortcut
    {
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [MaxLength(500)]
        public string Url { get; set; } = string.Empty;

        [MaxLength(100)]
        public string Icon { get; set; } = "link"; // Lucide icon name

        [MaxLength(50)]
        public string Color { get; set; } = "#3b82f6"; // Hex color

        [MaxLength(255)]
        public string Description { get; set; } = string.Empty;

        public int? DepartmentId { get; set; } // Nullable, if null visible to all
        public Department? Department { get; set; }

        public bool IsLocked { get; set; } = false; // If true, only visible/accessible to authorized department
    }
}
