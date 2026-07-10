using System;
using System.ComponentModel.DataAnnotations;

namespace SharePointBackend.Models
{
    public class DocumentCollaborator
    {
        public int Id { get; set; }

        [Required]
        public int DocumentId { get; set; }

        [Required]
        [MaxLength(100)]
        public string CollaboratorUsername { get; set; } = string.Empty;

        public bool CanEdit { get; set; } = false; // True = edit/write, False = read-only
    }
}
