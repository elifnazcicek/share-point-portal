using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SharePointBackend.Data;
using SharePointBackend.Models;
using System;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;

namespace SharePointBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly PortalDbContext _context;

        public AuthController(PortalDbContext context)
        {
            _context = context;
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
                return BadRequest(new AuthResponse { Success = false, Error = "Kullanıcı adı ve şifre zorunludur." });

            var passwordHash = HashPassword(request.Password);

            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Username.ToLower() == request.Username.ToLower() && u.PasswordHash == passwordHash);

            if (user == null || !user.IsActive)
            {
                return Unauthorized(new AuthResponse { Success = false, Error = "Geçersiz kullanıcı adı veya şifre." });
            }

            // Mapped role determines department profile access
            return Ok(new AuthResponse
            {
                Success = true,
                Username = user.Username,
                FullName = user.FullName,
                Role = user.Role,
                Token = Guid.NewGuid().ToString() // Simple mock session token
            });
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
                return BadRequest(new AuthResponse { Success = false, Error = "Kullanıcı adı ve şifre zorunludur." });

            if (await _context.Users.AnyAsync(u => u.Username.ToLower() == request.Username.ToLower()))
                return BadRequest(new AuthResponse { Success = false, Error = "Bu kullanıcı adı zaten alınmış." });

            var user = new User
            {
                Username = request.Username,
                PasswordHash = HashPassword(request.Password),
                FullName = request.Username,
                Role = "HR Department", // Default department for newly registered users
                Email = request.Email,
                IsActive = true
            };

            _context.Users.Add(user);
            
            // Audit Log
            var log = new DeviceLog
            {
                DeviceName = "WORKSTATION-01",
                IpAddress = "192.168.1.15", // default
                MacAddress = "00-50-56-C0-00-08",
                Action = $"Registered new user: {user.Username} ({user.Role})",
                Timestamp = DateTime.UtcNow,
                DepartmentName = user.Role
            };
            _context.DeviceLogs.Add(log);

            await _context.SaveChangesAsync();

            return Ok(new AuthResponse
            {
                Success = true,
                Username = user.Username,
                FullName = user.FullName,
                Role = user.Role,
                Token = Guid.NewGuid().ToString()
            });
        }

        [HttpPost("reset-password/request")]
        public async Task<IActionResult> RequestPasswordReset([FromBody] ResetPasswordRequestDto request)
        {
            if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Email))
                return BadRequest(new AuthResponse { Success = false, Error = "Kullanıcı adı ve e-posta zorunludur." });

            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Username.ToLower() == request.Username.ToLower() && u.Email.ToLower() == request.Email.ToLower());

            if (user == null)
            {
                return BadRequest(new AuthResponse { Success = false, Error = "Kullanıcı adı veya e-posta adresi eşleşmiyor." });
            }

            // Generate 6-digit verification code
            var random = new Random();
            var otpCode = random.Next(100000, 999999).ToString();

            user.SmsOtpCode = otpCode;
            user.SmsOtpExpiry = DateTime.UtcNow.AddMinutes(10); // 10 minutes expiry

            // Log code in system logs for developer/user visibility
            var log = new DeviceLog
            {
                DeviceName = "WORKSTATION-01",
                IpAddress = "192.168.1.15",
                MacAddress = "00-50-56-C0-00-08",
                Action = $"Password reset request for {user.Username}. Generated OTP: {otpCode}",
                Timestamp = DateTime.UtcNow,
                DepartmentName = user.Role
            };
            _context.DeviceLogs.Add(log);

            await _context.SaveChangesAsync();

            // Return code in JSON for easy local testing / validation
            return Ok(new 
            {
                Success = true,
                Message = "Doğrulama kodu e-posta adresinize gönderildi (Mock: Aşağıdaki OtpCode alanını doğrulama için kullanın).",
                OtpCode = otpCode
            });
        }

        [HttpPost("reset-password/verify")]
        public async Task<IActionResult> VerifyPasswordReset([FromBody] ResetPasswordVerifyDto request)
        {
            if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.OtpCode) || string.IsNullOrWhiteSpace(request.NewPassword))
                return BadRequest(new AuthResponse { Success = false, Error = "Tüm alanlar zorunludur." });

            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Username.ToLower() == request.Username.ToLower());

            if (user == null || user.SmsOtpCode != request.OtpCode)
            {
                return BadRequest(new AuthResponse { Success = false, Error = "Doğrulama kodu hatalı." });
            }

            if (user.SmsOtpExpiry == null || user.SmsOtpExpiry < DateTime.UtcNow)
            {
                return BadRequest(new AuthResponse { Success = false, Error = "Doğrulama kodunun süresi dolmuş." });
            }

            // Reset password
            user.PasswordHash = HashPassword(request.NewPassword);
            user.SmsOtpCode = null;
            user.SmsOtpExpiry = null;

            // Log
            var log = new DeviceLog
            {
                DeviceName = "WORKSTATION-01",
                IpAddress = "192.168.1.15",
                MacAddress = "00-50-56-C0-00-08",
                Action = $"Password successfully reset for user: {user.Username}",
                Timestamp = DateTime.UtcNow,
                DepartmentName = user.Role
            };
            _context.DeviceLogs.Add(log);

            await _context.SaveChangesAsync();

            return Ok(new AuthResponse
            {
                Success = true,
                Username = user.Username,
                FullName = user.FullName,
                Role = user.Role,
                Token = Guid.NewGuid().ToString()
            });
        }

        private string HashPassword(string password)
        {
            using var sha256 = SHA256.Create();
            var bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(password));
            var builder = new StringBuilder();
            foreach (var b in bytes)
            {
                builder.Append(b.ToString("x2"));
            }
            return builder.ToString();
        }
    }

    public class LoginRequest
    {
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }

    public class RegisterRequest
    {
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string? FullName { get; set; }
        public string? Role { get; set; } // Department
        public string? Email { get; set; }
        public string? PhoneNumber { get; set; }
    }

    public class ResetPasswordRequestDto
    {
        public string Username { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
    }

    public class ResetPasswordVerifyDto
    {
        public string Username { get; set; } = string.Empty;
        public string OtpCode { get; set; } = string.Empty;
        public string NewPassword { get; set; } = string.Empty;
    }

    public class AuthResponse
    {
        public bool Success { get; set; }
        public string Username { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string Token { get; set; } = string.Empty;
        public string Error { get; set; } = string.Empty;
    }
}
