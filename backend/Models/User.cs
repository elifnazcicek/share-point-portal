using System;
using System.ComponentModel.DataAnnotations;

namespace SharePointBackend.Models
{
    public class User
    {
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string Username { get; set; } = string.Empty;

        [Required]
        [MaxLength(200)]
        public string PasswordHash { get; set; } = string.Empty;

        [MaxLength(150)]
        public string FullName { get; set; } = string.Empty;

        [MaxLength(50)]
        public string Role { get; set; } = "Guest"; // e.g. "IT Department", "HR Department", "Finance Department", "Marketing Department", "Operations Department"

        public bool IsActive { get; set; } = true;

        [MaxLength(50)]
        public string CreatedDate { get; set; } = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");

        [MaxLength(50)]
        public string? PhoneNumber { get; set; }

        [MaxLength(150)]
        public string? Email { get; set; }

        [MaxLength(50)]
        public string? SmsOtpCode { get; set; }

        public DateTime? SmsOtpExpiry { get; set; }
    }
}
