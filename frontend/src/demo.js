// Pre-recorded demo data generated from dump_singles.py against real master.conf
// Ports match a real local run — launcher reassigns them each time, but structure is accurate.

export const DEMO_SERVERS = [
  { name: "auth-anthropic.com", kind: "auth", port: 46657, records: [{ hostname: "www.anthropic.com", port: 23001 }, { hostname: "api.anthropic.com", port: 23002 }] },
  { name: "auth-battle.net", kind: "auth", port: 64120, records: [{ hostname: "www.battle.net", port: 12839 }] },
  { name: "auth-cloudflare.com", kind: "auth", port: 38525, records: [{ hostname: "www.cloudflare.com", port: 11500 }, { hostname: "dash.cloudflare.com", port: 11501 }] },
  { name: "auth-co.uk", kind: "auth", port: 1750, records: [{ hostname: "bbc.co.uk", port: 6349 }, { hostname: "mcdonalds.co.uk", port: 28109 }, { hostname: "www.pinterest.co.uk", port: 6804 }] },
  { name: "auth-com.au", kind: "auth", port: 37088, records: [{ hostname: "google.com.au", port: 23819 }, { hostname: "www.vodafone.com.au", port: 9230 }, { hostname: "maps.google.com.au", port: 23818 }, { hostname: "claim-points.mcdonalds.com.au", port: 7219 }, { hostname: "mcdonalds.com.au", port: 8294 }] },
  { name: "auth-discord.com", kind: "auth", port: 41753, records: [{ hostname: "www.discord.com", port: 13001 }, { hostname: "cdn.discord.com", port: 13002 }] },
  { name: "auth-figma.com", kind: "auth", port: 20571, records: [{ hostname: "www.figma.com", port: 15001 }, { hostname: "api.figma.com", port: 15002 }] },
  { name: "auth-github.com", kind: "auth", port: 62882, records: [{ hostname: "api.github.com", port: 9443 }, { hostname: "gist.github.com", port: 9444 }, { hostname: "docs.github.com", port: 9445 }] },
  { name: "auth-heroku.com", kind: "auth", port: 34402, records: [{ hostname: "www.heroku.com", port: 20001 }, { hostname: "dashboard.heroku.com", port: 20002 }] },
  { name: "auth-huggingface.co", kind: "auth", port: 33528, records: [{ hostname: "www.huggingface.co", port: 24001 }, { hostname: "api.huggingface.co", port: 2400 }] },
  { name: "auth-linear.app", kind: "auth", port: 62225, records: [{ hostname: "www.linear.app", port: 17001 }, { hostname: "api.linear.app", port: 17002 }] },
  { name: "auth-minecraft.net", kind: "auth", port: 41078, records: [{ hostname: "www.minecraft.net", port: 6391 }] },
  { name: "auth-net.au", kind: "auth", port: 21573, records: [{ hostname: "www.abc.net.au", port: 7892 }, { hostname: "abc.net.au", port: 7893 }, { hostname: "account.iinet.net.au", port: 8201 }, { hostname: "www.iinet.net.au", port: 28394 }] },
  { name: "auth-netlify.com", kind: "auth", port: 49458, records: [{ hostname: "www.netlify.com", port: 19001 }, { hostname: "api.netlify.com", port: 19002 }, { hostname: "app.netlify.com", port: 19003 }] },
  { name: "auth-notion.so", kind: "auth", port: 34821, records: [{ hostname: "www.notion.so", port: 16001 }, { hostname: "api.notion.so", port: 16002 }] },
  { name: "auth-openai.com", kind: "auth", port: 22550, records: [{ hostname: "www.openai.com", port: 22001 }, { hostname: "api.openai.com", port: 22002 }, { hostname: "platform.openai.com", port: 22003 }] },
  { name: "auth-reddit.com", kind: "auth", port: 19587, records: [{ hostname: "www.reddit.com", port: 10240 }, { hostname: "old.reddit.com", port: 10241 }, { hostname: "api.reddit.com", port: 10242 }] },
  { name: "auth-spotify.com", kind: "auth", port: 63379, records: [{ hostname: "www.spotify.com", port: 14001 }, { hostname: "api.spotify.com", port: 14002 }, { hostname: "accounts.spotify.com", port: 14003 }] },
  { name: "auth-stackoverflow.com", kind: "auth", port: 41747, records: [{ hostname: "www.stackoverflow.com", port: 11300 }, { hostname: "api.stackoverflow.com", port: 11301 }] },
  { name: "auth-stripe.com", kind: "auth", port: 32364, records: [{ hostname: "www.stripe.com", port: 21001 }, { hostname: "api.stripe.com", port: 21002 }, { hostname: "dashboard.stripe.com", port: 21003 }] },
  { name: "auth-twitch.tv", kind: "auth", port: 51631, records: [{ hostname: "www.twitch.tv", port: 12001 }, { hostname: "api.twitch.tv", port: 12002 }, { hostname: "clips.twitch.tv", port: 12003 }] },
  { name: "auth-vercel.com", kind: "auth", port: 16281, records: [{ hostname: "www.vercel.com", port: 18001 }, { hostname: "api.vercel.com", port: 18002 }] },
  { name: "root", kind: "root", port: 1025, records: [{ hostname: "com", port: 23203 }, { hostname: "app", port: 53297 }, { hostname: "net", port: 31536 }, { hostname: "co", port: 62855 }, { hostname: "tv", port: 10104 }, { hostname: "uk", port: 40890 }, { hostname: "au", port: 29695 }, { hostname: "so", port: 54912 }] },
  { name: "tld-app", kind: "tld", port: 53297, records: [{ hostname: "linear.app", port: 62225 }] },
  { name: "tld-au", kind: "tld", port: 29695, records: [{ hostname: "com.au", port: 37088 }, { hostname: "net.au", port: 21573 }] },
  { name: "tld-co", kind: "tld", port: 62855, records: [{ hostname: "huggingface.co", port: 33528 }] },
  { name: "tld-com", kind: "tld", port: 23203, records: [{ hostname: "spotify.com", port: 63379 }, { hostname: "reddit.com", port: 19587 }, { hostname: "heroku.com", port: 34402 }, { hostname: "netlify.com", port: 49458 }, { hostname: "github.com", port: 62882 }, { hostname: "vercel.com", port: 16281 }, { hostname: "openai.com", port: 22550 }, { hostname: "stackoverflow.com", port: 41747 }, { hostname: "anthropic.com", port: 46657 }, { hostname: "discord.com", port: 41753 }, { hostname: "stripe.com", port: 32364 }, { hostname: "figma.com", port: 20571 }, { hostname: "cloudflare.com", port: 38525 }] },
  { name: "tld-net", kind: "tld", port: 31536, records: [{ hostname: "battle.net", port: 64120 }, { hostname: "minecraft.net", port: 41078 }] },
  { name: "tld-so", kind: "tld", port: 54912, records: [{ hostname: "notion.so", port: 34821 }] },
  { name: "tld-tv", kind: "tld", port: 10104, records: [{ hostname: "twitch.tv", port: 51631 }] },
  { name: "tld-uk", kind: "tld", port: 40890, records: [{ hostname: "co.uk", port: 1750 }] },
]

// Build flat lookup map from the real server graph
// Mirrors recursor.py: root → tld → auth chain
const buildLookupMap = () => {
  const map = {}
  const serverByPort = {}
  DEMO_SERVERS.forEach(s => { serverByPort[s.port] = s })

  const root = DEMO_SERVERS.find(s => s.kind === 'root')

  DEMO_SERVERS.filter(s => s.kind === 'auth').forEach(auth => {
    auth.records.forEach(r => {
      const parts = r.hostname.split('.')
      // try each possible tld suffix to find a root record that matches
      // e.g. "claim-points.mcdonalds.com.au" → try "au", "com.au"
      let rootRecord = null
      let tldServer = null
      let tldRecord = null

      for (let i = parts.length - 1; i >= 1; i--) {
        const tldSuffix = parts.slice(i).join('.')
        rootRecord = root.records.find(rr => rr.hostname === tldSuffix)
        if (!rootRecord) continue
        tldServer = serverByPort[rootRecord.port]
        if (!tldServer) continue
        // find the tld record that best matches this hostname
        // match by longest suffix
        const candidates = tldServer.records
          .filter(tr => r.hostname.endsWith(tr.hostname) || r.hostname === tr.hostname)
          .sort((a, b) => b.hostname.length - a.hostname.length)
        tldRecord = candidates[0]
        if (tldRecord) break
      }

      if (!rootRecord || !tldServer || !tldRecord) return

      map[r.hostname] = {
        tldSuffix: rootRecord.hostname,
        domain: tldRecord.hostname,
        rootPort: root.port,
        tldPort: rootRecord.port,
        authPort: tldRecord.port,
        finalPort: r.port,
      }
    })
  })
  return map
}

export const DEMO_LOOKUP_MAP = buildLookupMap()

export const DEMO_CACHE = {}

export const demoResolve = async (hostname, emit) => {
  // cache hit
  if (DEMO_CACHE[hostname]) {
    await sleep(60)
    const cached = DEMO_CACHE[hostname]
    emit({ step: 'cache_hit', hostname, port: cached.port, expires: new Date(cached.expires).toLocaleTimeString() })
    return
  }

  const entry = DEMO_LOOKUP_MAP[hostname]
  if (!entry) {
    await sleep(120)
    emit({ step: 'nxdomain', stage: 'root', query: hostname.split('.').pop(), port: 1025, ms: 1.2 })
    return
  }

  // root
  await sleep(rand(80, 180))
  const rootMs = (rand(8, 25) / 10)
  emit({ step: 'root', query: entry.tldSuffix, port: entry.rootPort, result_port: entry.tldPort, ms: rootMs })

  // tld
  await sleep(rand(100, 200))
  const tldMs = (rand(7, 20) / 10)
  emit({ step: 'tld', query: entry.domain, port: entry.tldPort, result_port: entry.authPort, ms: tldMs })

  // auth
  await sleep(rand(100, 200))
  const authMs = (rand(7, 18) / 10)
  emit({ step: 'auth', query: hostname, port: entry.authPort, result_port: entry.finalPort, ms: authMs })

  await sleep(60)
  const total = Math.round((rootMs + tldMs + authMs) * 10) / 10
  emit({ step: 'resolved', hostname, port: entry.finalPort, total_ms: total })

  DEMO_CACHE[hostname] = { port: entry.finalPort, expires: Date.now() + 30000 }
  setTimeout(() => delete DEMO_CACHE[hostname], 30000)
}

const sleep = ms => new Promise(r => setTimeout(r, ms))
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min