using System.ComponentModel.DataAnnotations;

namespace SharePointBackend.Models
{
    public class Department
    {
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(255)]
        public string Description { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string IpRange { get; set; } = string.Empty; // e.g. "192.168.1.0/24"
    }
}
