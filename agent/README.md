# BigPOS Agent Setup

## What It Does
The agent runs on a LAN computer (e.g. a mini-PC or the POS terminal itself). It:
1. Polls `print_jobs` from Supabase every second
2. Claims jobs atomically, renders ESC/POS bytes locally
3. Sends bytes to thermal printers via TCP :9100 (no driver needed)
4. Sends printer reachability status back to Supabase every 15s
5. Scans the LAN for new printers every 60s

## Prerequisites
- Node.js 18+ installed
- Network access to your Supabase project
- Network access to thermal printers (same LAN)

## Installation

### 1. Build the agent
```bash
cd agent
npm install
npm run build
```

### 2. Provision the agent
In the BigPOS admin panel:
1. Go to **Settings → Printers → Agents**
2. Click **Generate Install Token**
3. Copy the token

Then run the provisioning script:
```bash
node dist/provision.js \
  --token      <INSTALL_TOKEN> \
  --url        https://<your-project>.supabase.co \
  --service-key <SERVICE_ROLE_KEY>
```

- **`--token`** — the one-time install token copied from the admin panel (expires in 24h)
- **`--url`** — your Supabase project URL (Supabase Dashboard → Settings → API → Project URL)
- **`--service-key`** — the `service_role` secret key (Supabase Dashboard → Settings → API → Project API keys)

This creates `~/.bigpos-agent/keystore.json` with the agent's permanent credentials.

> ⚠️ Keep the `service_role` key secret — treat it like a DB password. It grants full database access.

### 3. Start the agent
```bash
npm start
```

### Windows — Run as a service
```bash
# Install (run as Administrator)
node dist/service/windows.js install

# Uninstall
node dist/service/windows.js uninstall
```

### Linux — Run as a systemd service
```bash
# First build, then:
sudo bash install-linux.sh
```

## Keystore
The keystore is stored at `~/.bigpos-agent/keystore.json` with `600` permissions.
It contains:
- `agentToken` — secret, never transmitted after provisioning
- `restaurantId` — Supabase restaurant UUID
- `supabaseUrl` — your Supabase project URL
- `supabaseServiceKey` — service_role key (bypasses RLS for agent operations)

**Keep this file secure.** Treat `supabaseServiceKey` like a database password.

## Printer Discovery
The agent automatically scans the LAN every 60s for devices on TCP :9100.
Newly found IPs appear in the admin panel as **inactive** printer candidates.
An admin must name and activate them.

## Offline Resilience
If Supabase is unreachable, the agent buffers jobs in a local SQLite database at
`~/.bigpos-agent/buffer.sqlite3` and re-submits them when connectivity is restored.

## Logs
- **Linux:** `journalctl -u bigpos-agent -f`
- **Windows:** `C:\ProgramData\bigpos-agent\daemon\<name>.err.log`
- **SQLite audit log:** `~/.bigpos-agent/buffer.sqlite3` (table `print_log`)
