using System.ComponentModel.DataAnnotations;

namespace SharePointBackend.Models
{
    public class CustomShortcut
    {
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [MaxLength(500)]
        public string Url { get; set; } = string.Empty;

        [MaxLength(100)]
        public string Icon { get; set; } = "link";

        [MaxLength(50)]
        public string Color { get; set; } = "#3b82f6";

        [Required]
        [MaxLength(50)]
        public string DeviceIp { get; set; } = string.Empty; // Associate shortcut with device IP

        [MaxLength(100)]
        public string? Username { get; set; }
    }
}
