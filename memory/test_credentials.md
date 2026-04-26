# Test Credentials

## Franchise Command Centre (Super Admin)
- **URL:** `/admin`
- **Email:** `admin@bookslot.io`
- **Password:** `Admin123!`
- **Note:** Super admin login uses a dedicated route — NOT `/api/auth/login`. Use `/api/admin/login` (or whatever the admin auth pathway is in `/app/backend/server.py`). Do NOT assume the standard tenant auth endpoint works.

## Demo Clients (All use password: `Demo123!`)

### Salon — Bella Hair Studio  ⭐ DEMO TENANT FOR ONYX & GOLD THEME
- **Login:** `/login` with `salon@bookslot.io` / `Demo123!`
- **Public booking:** `/book/bella-hair-studio-d5d6d8`
- **Industry Theme:** Rose/Pink (AI: **Bella** — has glamorous portrait avatar at `/bella-avatar.jpg`)
- **Tenant Theme Preset:** `onyx_gold` (rich black + antique-gold leaf, Cinzel serif typography)
- **Staff:** Sarah Mitchell, Mia Rossi, Jake Turner
- **Services:** Cuts, Colour, Highlights, Balayage, Blow Dry, etc.
- **VIP Threshold:** 500 EUR (set in Settings → Booking Rules → VIP Clients)
- **Existing demo appointment for rebook/blast tests:** `appt_151aaf879e3f`

### Dentist — Bright Smile Dental
- **Login:** `/login` with `dentist@bookslot.io` / `Demo123!`
- **Industry Theme:** Blue (AI: Dr. Assist)
- **Staff:** Dr. James Chen, Dr. Emma Walsh, Lisa Park
- **Services:** Check-up, Filling, Root Canal, Crown, Whitening, etc.

### Vet — Happy Paws Vet Clinic
- **Login:** `/login` with `vet@bookslot.io` / `Demo123!`
- **Industry Theme:** Green (AI: PawPal)
- **Staff:** Dr. Amy Brooks, Dr. Tom Reid, Nurse Kelly
- **Services:** Wellness Exam, Vaccination, Dental, Surgery, X-Ray, etc.

### Original Demo Tenant
- **Login:** `/login` with `demo@bookslot.io` / `Demo123!`
- **Industry Theme:** Rose/Pink (Salon)
