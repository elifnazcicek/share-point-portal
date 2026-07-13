using System.ComponentModel.DataAnnotations;

namespace SharePointBackend.Models
{
    public class DocumentVersion
    {
        public int Id { get; set; }
        public int DocumentId { get; set; }
        public int VersionNumber { get; set; }

        [Required]
        [MaxLength(500)]
        public string FileUrl { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string FileSize { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string ModifiedBy { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string ModifiedDate { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Comment { get; set; }
    }
}
