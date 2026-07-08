using System;
using System.ComponentModel.DataAnnotations;

namespace SharePointBackend.Models
{
    public class DeviceLog
    {
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string DeviceName { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string IpAddress { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string MacAddress { get; set; } = string.Empty;

        [Required]
        [MaxLength(255)]
        public string Action { get; set; } = string.Empty; // e.g. "Accessed Portal", "Clicked Shortcut: Travel management"

        public DateTime Timestamp { get; set; } = DateTime.UtcNow;

        [MaxLength(100)]
        public string DepartmentName { get; set; } = "None";
    }
}
