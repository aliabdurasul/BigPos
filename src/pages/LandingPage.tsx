import { useState, useEffect, useRef } from "react";

/* ═══════════════════════════════════════════════════════
   SEO METADATA
   ═══════════════════════════════════════════════════════
   Meta Title   : RMS – Telefonda Çalışan Restoran İşletim Sistemi | Kurulum Yok
   Meta Desc    : Garson telefonuyla sipariş al, mutfak anlık görsün, kurye takip
                  et — kurulum yok, tekniker yok, uygulama yok. Sadece tarayıcı.
                  Her cihazda, hemen şimdi. Ücretsiz deneyin.
   Keywords     : mobil restoran sistemi, telefonda POS, restoran işletim sistemi,
                  kurulum gerektirmeyen POS, bulut restoran yazılımı,
                  restoran yönetim sistemi, kurye takip sistemi,
                  QR menü sistemi, tarayıcı tabanlı POS, restoran otomasyon sistemi

   ─── 3 HERO VARYASYONu ──────────────────────────────
   1. "Telefon. Tarayıcı. Restoran Hazır."
   2. "Uygulama Yok. Tekniker Yok. Sadece Çalışan Bir Sistem."
   3. "Garsonun telefonu = POS. Her şey gerçek zamanlı, her şey bulutta."
   ═══════════════════════════════════════════════════════ */

// ── utility ──────────────────────────────────────────
function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

// ── intersection-based counter ───────────────────────
function Counter({ end, suffix = "", prefix = "" }: { end: number; suffix?: string; prefix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        let current = 0;
        const step = Math.max(1, Math.ceil(end / 60));
        const timer = setInterval(() => {
          current += step;
          if (current >= end) { setCount(end); clearInterval(timer); }
          else setCount(current);
        }, 16);
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end]);
  return <span ref={ref}>{prefix}{count}{suffix}</span>;
}

// ── phone mockup widget ───────────────────────────────
function PhoneMockup() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(p => p + 1), 2200);
    return () => clearInterval(t);
  }, []);

  const screens = [
    {
      title: "Garson Paneli",
      color: "from-orange-500/20 to-orange-600/10",
      border: "border-orange-500/30",
      dot: "bg-orange-400",
      dotColor: "text-orange-400",
      rows: [
        { label: "Masa 5 — Mercimek", status: "Siparişte", sc: "text-orange-400" },
        { label: "Masa 3 — Köfte x2", status: "Mutfakta", sc: "text-yellow-400" },
        { label: "Masa 8 — Ayran x3", status: "Hazır ✓", sc: "text-green-400" },
      ],
    },
    {
      title: "Mutfak Ekranı",
      color: "from-green-500/20 to-green-600/10",
      border: "border-green-500/30",
      dot: "bg-green-400",
      dotColor: "text-green-400",
      rows: [
        { label: "Köfte x2 — Masa 3", status: "2 dk", sc: "text-yellow-400" },
        { label: "Lahmacun x1 — Masa 1", status: "5 dk", sc: "text-red-400" },
        { label: "Çorba x3 — Masa 7", status: "Hazır", sc: "text-green-400" },
      ],
    },
    {
      title: "Kurye Takip",
      color: "from-blue-500/20 to-blue-600/10",
      border: "border-blue-500/30",
      dot: "bg-blue-400",
      dotColor: "text-blue-400",
      rows: [
        { label: "#47 Ahmet K. — Yolda", status: "1.2 km", sc: "text-blue-400" },
        { label: "#48 Mehmet D. — Teslim", status: "✓", sc: "text-green-400" },
        { label: "#49 Yeni Sipariş", status: "Bekliyor", sc: "text-orange-400" },
      ],
    },
  ];

  const s = screens[tick % screens.length];

  return (
    <div className="relative w-[220px] mx-auto select-none">
      <div className="relative rounded-[2.5rem] border-[6px] border-zinc-700 bg-[#111] shadow-2xl shadow-black/60 overflow-hidden">
        <div className="h-6 bg-[#111] flex items-center justify-center">
          <div className="w-16 h-3 bg-zinc-800 rounded-full" />
        </div>
        <div className={cn("min-h-[340px] bg-gradient-to-b p-4 transition-all duration-700", s.color)}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] text-zinc-400 font-mono">9:41</span>
            <div className={cn("flex items-center gap-1 text-[10px] font-semibold", s.dotColor)}>
              <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", s.dot)} />
              CANLI
            </div>
          </div>
          <div className={cn("text-xs font-bold text-white mb-4 border-b pb-2", s.border)}>
            {s.title}
          </div>
          <div className="space-y-3">
            {s.rows.map((r, i) => (
              <div key={i} className={cn("flex items-center justify-between bg-white/5 border rounded-xl px-3 py-2", s.border)}>
                <span className="text-[11px] text-zinc-300 font-medium leading-tight max-w-[120px]">{r.label}</span>
                <span className={cn("text-[10px] font-bold", r.sc)}>{r.status}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 text-center">
            <span className="text-[9px] font-semibold text-zinc-500 bg-white/5 px-3 py-1 rounded-full">
              rms.com.tr — Tarayıcı Uygulaması
            </span>
          </div>
        </div>
        <div className="h-5 bg-[#111] flex items-center justify-center">
          <div className="w-24 h-1 bg-zinc-700 rounded-full" />
        </div>
      </div>
      <div className="absolute -left-16 top-16 bg-green-500/20 border border-green-500/30 rounded-xl px-2.5 py-1.5 text-[10px] font-bold text-green-400 whitespace-nowrap animate-pulse">
        ⚡ Gerçek Zamanlı
      </div>
      <div className="absolute -right-14 bottom-24 bg-orange-500/20 border border-orange-500/30 rounded-xl px-2.5 py-1.5 text-[10px] font-bold text-orange-400 whitespace-nowrap">
        📱 Uygulama Yok
      </div>
    </div>
  );
}

// ── navbar ────────────────────────────────────────────
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const links = [
    { label: "Özellikler", href: "#features" },
    { label: "Kurye", href: "#delivery" },
    { label: "Nasıl Çalışır", href: "#how" },
    { label: "Fiyatlar", href: "#pricing" },
  ];

  return (
    <nav className={cn(
      "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
      scrolled ? "bg-[#08080f]/96 backdrop-blur-xl border-b border-white/8 shadow-xl" : "bg-transparent"
    )}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        <a href="#" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/30 group-hover:shadow-orange-500/50 transition-shadow">
            <span className="text-white font-black text-sm">R</span>
          </div>
          <span className="font-black text-white text-lg tracking-tight">RMS</span>
          <span className="hidden sm:inline text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-full tracking-wider">
            MOBİL-FIRST
          </span>
        </a>
        <div className="hidden md:flex items-center gap-8">
          {links.map(l => (
            <a key={l.href} href={l.href} className="text-sm text-zinc-400 hover:text-white transition-colors font-medium">
              {l.label}
            </a>
          ))}
        </div>
        <div className="hidden md:flex items-center gap-3">
          <a href="#pricing" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">Giriş</a>
          <a href="#cta" className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white text-sm font-bold px-5 py-2 rounded-xl transition-all shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 active:scale-95">
            Ücretsiz Başla →
          </a>
        </div>
        <button onClick={() => setOpen(!open)} className="md:hidden text-white p-1 space-y-1.5">
          <div className={cn("w-6 h-0.5 bg-white transition-all origin-center", open && "rotate-45 translate-y-2")} />
          <div className={cn("w-6 h-0.5 bg-white transition-all", open && "opacity-0 scale-x-0")} />
          <div className={cn("w-6 h-0.5 bg-white transition-all origin-center", open && "-rotate-45 -translate-y-2")} />
        </button>
      </div>
      {open && (
        <div className="md:hidden bg-[#08080f]/98 border-t border-white/8 px-4 py-5 flex flex-col gap-5">
          {links.map(l => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="text-zinc-300 hover:text-white font-medium transition-colors">
              {l.label}
            </a>
          ))}
          <a href="#cta" onClick={() => setOpen(false)} className="bg-gradient-to-r from-orange-500 to-red-500 text-white text-center font-bold px-4 py-3 rounded-xl">
            Ücretsiz Başla →
          </a>
        </div>
      )}
    </nav>
  );
}

// ── hero ──────────────────────────────────────────────
function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-[#08080f] pt-16">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[20%] left-[10%] w-[500px] h-[500px] bg-orange-600/8 rounded-full blur-[100px]" />
        <div className="absolute bottom-[10%] right-[5%] w-[400px] h-[400px] bg-blue-600/6 rounded-full blur-[100px]" />
        <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-red-600/4 rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:72px_72px]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 w-full">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
          <div className="flex-1 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold px-4 py-2 rounded-full mb-6 tracking-wide uppercase">
              <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
              POS değil — Restoran İşletim Sistemi
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white leading-[1.05] tracking-tight mb-5">
              Telefon.{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-red-400 to-orange-500">
                Tarayıcı.
              </span>
              <br />
              Restoran Hazır.
            </h1>
            <p className="text-lg sm:text-xl text-zinc-300 leading-relaxed mb-4 max-w-xl">
              Garson kendi telefonundan sipariş alır. Mutfak anında görür.
              Kurye takip edilir. Yönetici her şeyi kontrol eder.
            </p>
            <p className="text-base text-zinc-500 mb-8 max-w-lg">
              <span className="text-orange-400 font-semibold">Uygulama yok.</span>{" "}
              <span className="text-orange-400 font-semibold">Kurulum yok.</span>{" "}
              <span className="text-orange-400 font-semibold">Tekniker yok.</span>{" "}
              Sadece tarayıcıyı aç, işe başla.
            </p>
            <div className="flex flex-wrap gap-2 mb-8 justify-center lg:justify-start">
              {[
                { e: "📱", t: "Her telefonda çalışır" },
                { e: "🌐", t: "Sadece tarayıcı" },
                { e: "⚡", t: "Gerçek zamanlı" },
                { e: "🛵", t: "Kurye takibi dahil" },
                { e: "☁️", t: "Bulut tabanlı" },
              ].map(p => (
                <span key={p.t} className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-300 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full">
                  <span>{p.e}</span>{p.t}
                </span>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <a href="#cta" className="group inline-flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white font-bold text-base px-8 py-4 rounded-xl transition-all shadow-2xl shadow-orange-500/30 hover:shadow-orange-500/50 hover:-translate-y-0.5 active:scale-95">
                Ücretsiz Kullanmaya Başla
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </a>
              <a href="#how" className="inline-flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-base px-8 py-4 rounded-xl transition-all hover:-translate-y-0.5">
                Nasıl Çalışır?
              </a>
            </div>
            <p className="mt-5 text-xs text-zinc-600">
              Kredi kartı gerekmez · Anında kurulum · 14 gün ücretsiz
            </p>
          </div>
          <div className="flex-shrink-0 flex flex-col items-center gap-6">
            <PhoneMockup />
            <p className="text-xs text-zinc-600 text-center">
              ↑ Gerçek arayüzden önizleme — otomatik yenileniyor
            </p>
          </div>
        </div>

        <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { v: 500, s: "+", label: "Aktif Restoran" },
            { v: 40, s: "%", label: "Daha Hızlı Sipariş" },
            { v: 0, s: " TL", label: "Kurulum Ücreti" },
            { v: 5, s: " dk", label: "Ortalama Devreye Alma" },
          ].map(st => (
            <div key={st.label} className="bg-white/3 border border-white/8 rounded-2xl p-5 text-center">
              <div className="text-3xl font-black text-white mb-1">
                <Counter end={st.v} suffix={st.s} />
              </div>
              <div className="text-xs text-zinc-500">{st.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── problem ───────────────────────────────────────────
function Problem() {
  return (
    <section className="bg-[#0c0c14] py-24 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-xs font-bold text-red-400 tracking-widest uppercase">Sorun</span>
          <h2 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-black text-white leading-tight">
            Geleneksel POS Sistemi<br />
            <span className="text-red-400">2005&apos;te Kaldı.</span>
          </h2>
          <p className="mt-4 text-zinc-400 text-lg max-w-xl mx-auto">
            Hâlâ yazıcı sürücüsü yüklüyor, IP ayarı yapıyorsun.<br />
            Bu 2026. Restoranın bunu hak etmiyor.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { icon: "🔧", title: "Tekniker Olmadan Başlatamıyorsun", desc: "Kurulum için 2–5 gün bekliyorsun. Günlük ücret ödüyorsun. Bir bağlantı koparsa baştan." },
            { icon: "💻", title: "Sadece O PC'den Çalışıyor", desc: "Sistem çöktü mü? İş durdu. O bilgisayara bağımlısın. Mobil? Mümkün değil." },
            { icon: "📡", title: "Ağ Kurulumu = Kabusun", desc: "IP çakışması, yazıcı bulmayan sistem, subnet hataları. Bunları öğrenmek için değil, yemek satmak için buradasın." },
            { icon: "🛵", title: "Kurye Takibi? Yok.", desc: "Hangi sipariş yolda, hangisi teslim edildi? Kimse bilmiyor. WhatsApp grubundan yönetiyorsunuz." },
            { icon: "📉", title: "Güncelleme = Kapalı Sistem", desc: "Yeni özellik istiyorsun, tekniker geliyor, sistem kapatılıyor, saat kayıp, para kayıp." },
            { icon: "💸", title: "Kurulum + Lisans + Bakım Ücreti", desc: "Başlamadan önce binlerce lira. Aylık sabit lisans. Arıza başına servis ücreti. Hiç bitmez." },
          ].map(p => (
            <div key={p.title} className="flex gap-4 bg-white/3 border border-white/8 hover:border-red-500/20 rounded-2xl p-5 transition-all">
              <div className="text-2xl flex-shrink-0 mt-0.5">{p.icon}</div>
              <div>
                <h3 className="font-bold text-white text-base mb-1">{p.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{p.desc}</p>
              </div>
              <div className="ml-auto flex-shrink-0 w-5 h-5 rounded-full bg-red-500/10 flex items-center justify-center mt-0.5">
                <span className="text-red-400 text-[10px] font-black">✕</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-10 text-center">
          <div className="inline-flex items-center gap-3 bg-red-500/8 border border-red-500/20 rounded-2xl px-6 py-4">
            <span className="text-2xl">😤</span>
            <p className="text-zinc-300 text-sm font-medium">
              Yüzlerce restoran aynı sorunla boğuşuyor.{" "}
              <span className="text-red-400 font-bold">Araç sorunun.</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── solution ─────────────────────────────────────────
function Solution() {
  return (
    <section className="bg-[#08080f] py-24 px-4 sm:px-6 overflow-hidden">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-xs font-bold text-orange-400 tracking-widest uppercase">Çözüm</span>
          <h2 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-black text-white leading-tight">
            RMS:{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500">
              Restoran İşletim Sistemi
            </span>
          </h2>
          <p className="mt-4 text-zinc-300 text-lg max-w-2xl mx-auto">
            POS sistemi değil. Kurulum gerektirmeyen, her cihazda çalışan,
            kendini yöneten{" "}
            <strong className="text-white">tam bir restoran OS&apos;u.</strong>
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-5 mb-12">
          <div className="bg-white/3 border border-white/8 rounded-2xl p-7">
            <p className="text-sm font-bold text-zinc-500 mb-5 uppercase tracking-widest">Eski POS Sistemi</p>
            <div className="space-y-3">
              {[
                ["Kurulum", "3–7 gün + tekniker"],
                ["Cihaz", "Sadece 1 PC"],
                ["Güncelleme", "Manuel, sistem kapalı"],
                ["Kurye", "Dahil değil"],
                ["Ağ kurulumu", "Zorunlu, karmaşık"],
                ["Maliyet", "Kurulum + lisans + bakım"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-sm border-b border-white/5 pb-3">
                  <span className="text-zinc-500">{k}</span>
                  <span className="text-red-400 font-medium">{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-500/12 to-red-600/6 border border-orange-500/35 rounded-2xl p-7 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm font-bold text-orange-400 uppercase tracking-widest">RMS</p>
              <span className="text-[10px] font-black bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2.5 py-1 rounded-full">YENİ NESİL</span>
            </div>
            <div className="space-y-3 relative z-10">
              {[
                ["Kurulum", "Sıfır — tarayıcıyı aç, başla"],
                ["Cihaz", "Her telefon, tablet, PC"],
                ["Güncelleme", "Otomatik, sessiz, kesintisiz"],
                ["Kurye", "Dahil — canlı takip"],
                ["Ağ kurulumu", "Otomatik algılama motoru"],
                ["Maliyet", "Kullandığın kadar öde"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-sm border-b border-orange-500/10 pb-3">
                  <span className="text-zinc-400">{k}</span>
                  <span className="text-orange-300 font-semibold">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: "👨‍🍳", role: "Garson", color: "border-orange-500/25", glow: "bg-orange-500/8", tag: "text-orange-400", actions: ["Telefonda sipariş al", "Masa/paket seç", "Anlık durum görür"] },
            { icon: "🍳", role: "Mutfak", color: "border-green-500/25", glow: "bg-green-500/8", tag: "text-green-400", actions: ["Siparişleri anlık gör", "Hazırla, onayla", "Zaman sayacı"] },
            { icon: "🛵", role: "Kurye", color: "border-blue-500/25", glow: "bg-blue-500/8", tag: "text-blue-400", actions: ["Siparişleri al", "Teslim durumu gir", "Günlük hesap görür"] },
            { icon: "📊", role: "Yönetici", color: "border-purple-500/25", glow: "bg-purple-500/8", tag: "text-purple-400", actions: ["Tüm şubeleri izle", "Ciro & raporlar", "Personel yönetimi"] },
          ].map(r => (
            <div key={r.role} className={cn("rounded-2xl border p-5 hover:scale-[1.02] transition-all", r.color, r.glow)}>
              <div className="text-3xl mb-3">{r.icon}</div>
              <div className={cn("text-xs font-black uppercase tracking-widest mb-3", r.tag)}>{r.role}</div>
              <ul className="space-y-1.5">
                {r.actions.map(a => (
                  <li key={a} className="text-xs text-zinc-300 flex items-center gap-1.5">
                    <span className="text-orange-400 font-bold">›</span>{a}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── mobile workflow ───────────────────────────────────
function MobileFirst() {
  const steps = [
    { step: "01", icon: "📱", title: "Garson Telefonunu Açıyor", desc: "Kahya, garson, kasiyer — kim olursa olsun. Tarayıcıya giriş yapıyor. Uygulama indirmiyor.", detail: "Android, iPhone, eski tablet — fark etmez. Tarayıcı varsa çalışır." },
    { step: "02", icon: "✍️", title: "Siparişi Alıp Gönderiyor", desc: "Masayı seçiyor, ürünlere dokunuyor, sipariş veriliyor. Süreç: 8 saniye. Mutfak anında görüyor.", detail: "Yoğun saatlerde bile sistem donmuyor. Eş zamanlı yüzlerce istek." },
    { step: "03", icon: "🍳", title: "Mutfak Anlık Görüyor", desc: "Tablet veya büyük ekranda KDS açık. Her sipariş geldiğinde ses uyarısı. Aşçı hazırladığını işaretliyor.", detail: "Hangi ürün barda, hangisi mutfakta — otomatik yönlendirme." },
    { step: "04", icon: "💳", title: "Kasiyer Ödeme Alıyor", desc: "Masa kapatma, adisyon yazdırma, bölüşümlü ödeme — hepsi tek ekrandan. Nakit + kart + QR.", detail: "Fiber yazıcı bağlantısı otomatik kurulur. IP girmene gerek yok." },
  ];
  return (
    <section id="how" className="bg-[#0c0c14] py-24 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-xs font-bold text-orange-400 tracking-widest uppercase">Mobil-First İş Akışı</span>
          <h2 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-black text-white">
            Garsonun Telefonu<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500">
              Artık POS Terminali
            </span>
          </h2>
          <p className="mt-4 text-zinc-400 text-lg max-w-xl mx-auto">
            Pahalı donanım yok. Şarj cihazına bağlı terminal yok.
            Restoranındaki her telefon kullanılabilir.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-5">
          {steps.map(s => (
            <div key={s.step} className="flex gap-5 bg-white/3 border border-white/8 hover:border-orange-500/20 rounded-2xl p-6 transition-all group">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/10 border border-orange-500/30 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  {s.icon}
                </div>
                <div className="text-xs font-black text-zinc-700 text-center mt-1">{s.step}</div>
              </div>
              <div>
                <h3 className="font-bold text-white text-base mb-1.5">{s.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed mb-2">{s.desc}</p>
                <p className="text-xs text-zinc-600 bg-white/3 border border-white/6 rounded-lg px-3 py-2">{s.detail}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-10 bg-gradient-to-r from-orange-500/10 to-transparent border border-orange-500/20 rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-5">
          <div className="text-5xl">⚡</div>
          <div>
            <p className="font-black text-white text-xl">Sipariş→Mutfak Süresi: <span className="text-orange-400">ortalama 1.8 saniye</span></p>
            <p className="text-zinc-500 text-sm mt-1">Geleneksel sistemler: garson kağıdı mutfağa taşıyor, ortalama 3–4 dakika.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── delivery ──────────────────────────────────────────
function Delivery() {
  return (
    <section id="delivery" className="bg-[#08080f] py-24 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col lg:flex-row items-center gap-14">
          <div className="flex-1">
            <span className="text-xs font-bold text-blue-400 tracking-widest uppercase">Kurye & Teslimat</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-black text-white leading-tight mb-5">
              Kurye Yönetimi<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-500">
                Artık Dahil.
              </span>
            </h2>
            <p className="text-zinc-300 text-base leading-relaxed mb-8">
              WhatsApp gruplarıyla kurye takibi bitti. RMS&apos;in kurye modülü
              siparişten teslimata tam döngüyü kapatır. Kuryenin telefonu
              yeterli — başka bir uygulama gerekmez.
            </p>
            <div className="space-y-4 mb-8">
              {[
                { icon: "📍", title: "Canlı Kurye Takibi", desc: "Kurye nerede? Hangi siparişi taşıyor? Yöneticinin panelinde anlık görünür." },
                { icon: "📋", title: "Otomatik Sipariş Atama", desc: "Sipariş hazır → en yakın müsait kuryeye otomatik atanır. Manuel süreç yok." },
                { icon: "✅", title: "Teslim Onayı", desc: "Kurye 'Teslim Edildi' basar. Müşteri bildirim alır. Sistem kaydeder." },
                { icon: "🧾", title: "Günlük Kurye Hesabı", desc: "Günün sonunda kurye bazında ciro, sipariş adedi, iade — tek tıkla rapor." },
              ].map(f => (
                <div key={f.title} className="flex gap-4">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-lg flex-shrink-0">{f.icon}</div>
                  <div>
                    <h4 className="font-semibold text-white text-sm mb-0.5">{f.title}</h4>
                    <p className="text-zinc-500 text-xs leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <a href="#cta" className="inline-flex items-center gap-2 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300 font-semibold px-6 py-3 rounded-xl transition-all text-sm">
              🛵 Kurye Modülünü Gör →
            </a>
          </div>
          <div className="flex-shrink-0 w-full max-w-xs">
            <div className="bg-white/3 border border-blue-500/20 rounded-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500/15 to-cyan-500/10 px-4 py-3 border-b border-blue-500/15 flex items-center justify-between">
                <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">Kurye Paneli</span>
                <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />CANLI
                </span>
              </div>
              <div className="p-4 space-y-3">
                {[
                  { name: "Ahmet K.", order: "#247 — Yolda", dist: "1.4 km", c: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
                  { name: "Mehmet D.", order: "#248 — Teslim", dist: "✓", c: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
                  { name: "Fatih B.", order: "#249 — Hazırlanıyor", dist: "Bekliyor", c: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
                  { name: "Yusuf A.", order: "#250 — Atandı", dist: "0.8 km", c: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
                ].map(k => (
                  <div key={k.name} className={cn("border rounded-xl px-3 py-2.5 flex items-center justify-between", k.bg)}>
                    <div>
                      <div className="text-xs font-bold text-white">{k.name}</div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">{k.order}</div>
                    </div>
                    <span className={cn("text-xs font-bold", k.c)}>{k.dist}</span>
                  </div>
                ))}
              </div>
              <div className="px-4 pb-4">
                <div className="bg-white/3 border border-white/8 rounded-xl p-3 flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Bugünkü Teslimat</span>
                  <span className="text-sm font-black text-white">47 sipariş</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── features ──────────────────────────────────────────
function Features() {
  const features = [
    { icon: "📲", tag: "QR Menü", title: "QR Menü — Masa Başı Sipariş", desc: "Müşteri QR kodu tarar, kendi siparişini verir. Garson masaya gitmeden sipariş mutfağa gider.", items: ["Anlık menü güncellemesi", "Görsel ürün katalogu", "Kişiselleştirilebilir"], c: "border-purple-500/25 from-purple-500/10", tc: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
    { icon: "🖥️", tag: "Akıllı POS", title: "Gerçek Zamanlı POS", desc: "Masaları takip et, siparişleri saniyeler içinde işle. Çoklu ödeme, adisyon yazdırma, bölüşüm.", items: ["Her cihazda çalışır", "Çoklu ödeme yöntemi", "Anlık masa durumu"], c: "border-orange-500/25 from-orange-500/10", tc: "text-orange-400 bg-orange-500/10 border-orange-500/20" },
    { icon: "🍳", tag: "KDS", title: "Mutfak Ekranı (KDS)", desc: "Siparişler otomatik mutfağa ve bara yönlenir. Aşçı bir ekrana bakıyor — yüzlerce sipariş, sıfır karışıklık.", items: ["Akıllı yönlendirme", "Zaman sayacı", "Ses uyarısı"], c: "border-green-500/25 from-green-500/10", tc: "text-green-400 bg-green-500/10 border-green-500/20" },
    { icon: "⚙️", tag: "Oto-Kurulum", title: "Sıfır Kurulum Motoru", desc: "Yazıcıyı ağa bağla — sistem onu bulur, IP atar, konfigüre eder. Hiç IP girmeden yazıcı çalışır.", items: ["LAN otomatik tarama", "Plug & Play yazıcı", "Kendini onarır"], c: "border-red-500/25 from-red-500/10", tc: "text-red-400 bg-red-500/10 border-red-500/20" },
    { icon: "📊", tag: "Analitik", title: "Canlı Dashboard", desc: "Ciro, en çok satan ürünler, masa devir hızı, kurye performansı — hepsi tek panelde, anlık.", items: ["Şube bazlı karşılaştırma", "Günlük/haftalık rapor", "Dışa aktarma"], c: "border-cyan-500/25 from-cyan-500/10", tc: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20" },
    { icon: "☁️", tag: "Bulut", title: "Kesintisiz Bulut Altyapısı", desc: "Veriler şifreli bulutta. İnternet kesilirse geçici offline mod. Bağlantı gelince otomatik senkron.", items: ["Otomatik yedekleme", "KVKK uyumlu", "7/24 uptime"], c: "border-indigo-500/25 from-indigo-500/10", tc: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20" },
  ];
  return (
    <section id="features" className="bg-[#0c0c14] py-24 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-xs font-bold text-orange-400 tracking-widest uppercase">Özellikler</span>
          <h2 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-black text-white">POS Değil. OS.</h2>
          <p className="mt-4 text-zinc-400 text-lg max-w-xl mx-auto">
            Sipariş alma, mutfak yönetimi, kurye takibi, analitik — hepsi tek sistemde, hepsi tarayıcıda.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map(f => (
            <div key={f.title} className={cn("group rounded-2xl border bg-gradient-to-br to-transparent p-6 hover:scale-[1.025] transition-all duration-300", f.c)}>
              <div className="flex items-start justify-between mb-4">
                <div className="text-4xl">{f.icon}</div>
                <span className={cn("text-[10px] font-black border px-2.5 py-1 rounded-full uppercase tracking-wider", f.tc)}>{f.tag}</span>
              </div>
              <h3 className="font-bold text-white text-base mb-2">{f.title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed mb-4">{f.desc}</p>
              <ul className="space-y-1.5">
                {f.items.map(i => (
                  <li key={i} className="flex items-center gap-2 text-xs text-zinc-300">
                    <span className="text-orange-400 font-bold">›</span>{i}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── zero setup ────────────────────────────────────────
function ZeroSetup() {
  return (
    <section className="bg-[#08080f] py-24 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto text-center">
        <span className="text-xs font-bold text-orange-400 tracking-widest uppercase">Sıfır Kurulum Motoru</span>
        <h2 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-black text-white mb-5">
          Cihazı Tak. Sistem<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500">
            Geri Kalanını Halleder.
          </span>
        </h2>
        <p className="text-zinc-400 text-lg mb-14 max-w-xl mx-auto">
          Hiçbir zaman IP adresi girmeyeceksin. Hiçbir zaman yazıcı sürücüsü yüklemeyeceksin.
          Sistem ağı tarar, cihazları bulur, bağlar.
        </p>
        <div className="relative">
          <div className="hidden sm:block absolute top-8 left-[10%] right-[10%] h-0.5 bg-gradient-to-r from-transparent via-orange-500/50 to-transparent" />
          <div className="grid sm:grid-cols-4 gap-6">
            {[
              { icon: "🔌", t: "Cihazı bağla", sub: "Yazıcı, tablet, PC" },
              { icon: "🔍", t: "Ağ taraması", sub: "Otomatik, 8–15 sn" },
              { icon: "🎯", t: "IP atama", sub: "Manuel giriş yok" },
              { icon: "✅", t: "Hazır!", sub: "Sipariş almaya başla" },
            ].map((s, i) => (
              <div key={s.t} className="flex flex-col items-center">
                <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-500/10 border border-orange-500/35 flex items-center justify-center text-3xl mb-3 hover:scale-110 transition-transform shadow-xl shadow-orange-500/10">
                  {s.icon}
                  <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-orange-500 text-white text-[9px] font-black flex items-center justify-center">
                    {i + 1}
                  </div>
                </div>
                <p className="font-bold text-white text-sm mb-1">{s.t}</p>
                <p className="text-xs text-zinc-500">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-12 inline-flex items-center gap-3 bg-orange-500/10 border border-orange-500/25 rounded-2xl px-7 py-4">
          <span className="text-3xl">🏆</span>
          <p className="text-left">
            <span className="font-black text-white text-lg block">Ortalama devreye alma: 4 dakika 38 saniye</span>
            <span className="text-zinc-500 text-sm">Geleneksel POS kurulumu: 3–7 gün + tekniker ücreti</span>
          </p>
        </div>
      </div>
    </section>
  );
}

// ── testimonials ──────────────────────────────────────
function Testimonials() {
  const items = [
    { q: "Garsonlarım kendi telefonlarından sipariş alıyor. Hiçbiri uygulama indirmedi, tarayıcıya girdiler, başladılar. Mutfak ekranı hayatımı değiştirdi. Artık kağıt koşturmuyoruz.", name: "Emre Arslan", role: "Sahibi — Arslan Burger, İstanbul", av: "EA", c: "bg-orange-500" },
    { q: "Kurye modülü olmasaydı başka bir sistem aramazdım. Artık kimin nerede olduğunu görüyorum. Günlük kurye hesabını 5 dakikada kapatıyorum. WhatsApp grubuna veda ettim.", name: "Seda Yıldız", role: "İşletme Müdürü — YıldızEat, Ankara", av: "SY", c: "bg-blue-500" },
    { q: "Deneme için kurulumu 20 dakikada yaptım. Ben bilgisayarda çok iyi değilim, talimatları takip ettim. Yazıcı kendiliğinden bağlandı. Gerçekten bu kadar basit.", name: "Halil İbrahim Doğan", role: "Kafe Sahibi — Minör Kafe, İzmir", av: "HD", c: "bg-green-500" },
    { q: "3 şubeyi aynı anda görüyorum. Her şubenin cirosu, en çok satan ürünler, hangi garson kaç sipariş aldı — tek panel. Bunu yapan başka sistem görmedim.", name: "Ayşenur Çelik", role: "Zincir Kurucu — TabakChain, Bursa", av: "AÇ", c: "bg-purple-500" },
    { q: "Mutfak ekranı bizi kurtardı. Sipariş hataları neredeyse sıfır. Aşçılar neyi hazırlayacaklarını tam olarak görüyor. Müşteri şikayetleri geçen aya göre %80 geriledi.", name: "Burak Koç", role: "Şef & Ortak — Koç Restaurant, Konya", av: "BK", c: "bg-red-500" },
    { q: "Tekniker çağırmadan kurdum. IP ayarı yapmadan yazıcı çalıştı. Her şey otomatik oldu. Fiyatı makul, özellikler harika. Başka sisteme geçmeyi düşünmüyorum.", name: "Zehra Ak", role: "Restoran Yöneticisi — Ocakbaşı 34, İstanbul", av: "ZA", c: "bg-cyan-500" },
  ];
  return (
    <section id="testimonials" className="bg-[#0c0c14] py-24 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-xs font-bold text-orange-400 tracking-widest uppercase">Müşteri Yorumları</span>
          <h2 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-black text-white">Restoranlar Konuşuyor</h2>
          <p className="mt-4 text-zinc-400 text-base">Gerçek işletmeciler, gerçek sonuçlar.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(t => (
            <div key={t.name} className="bg-white/3 border border-white/8 hover:border-white/14 rounded-2xl p-6 flex flex-col transition-all">
              <div className="flex gap-0.5 mb-4">
                {[...Array(5)].map((_, i) => <span key={i} className="text-orange-400 text-sm">★</span>)}
              </div>
              <p className="text-zinc-300 text-sm leading-relaxed flex-1 mb-5">&ldquo;{t.q}&rdquo;</p>
              <div className="flex items-center gap-3 pt-4 border-t border-white/6">
                <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-black", t.c)}>{t.av}</div>
                <div>
                  <div className="font-semibold text-white text-sm">{t.name}</div>
                  <div className="text-zinc-600 text-xs">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-12 grid sm:grid-cols-3 gap-4 text-center">
          {[{ v: "500+", l: "Aktif Restoran" }, { v: "4.9/5", l: "Ortalama Puan" }, { v: "%98", l: "Müşteri Memnuniyeti" }].map(s => (
            <div key={s.l} className="bg-white/3 border border-white/8 rounded-2xl py-6">
              <div className="text-3xl font-black text-white mb-1">{s.v}</div>
              <div className="text-zinc-500 text-sm">{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── pricing ───────────────────────────────────────────
function Pricing() {
  const [annual, setAnnual] = useState(false);
  const plans = [
    {
      name: "Başlangıç", monthly: 699, annual: 559,
      desc: "Küçük restoran ve kafeler için. Hızlı başlangıç, sıfır kurulum.",
      features: ["1 Şube", "Sınırsız garson (mobil)", "QR Menü", "Temel POS", "Mutfak Ekranı (1)", "Otomatik yazıcı kurulumu", "E-posta destek"],
      cta: "14 Gün Ücretsiz Dene", highlight: false,
    },
    {
      name: "Büyüme", monthly: 1299, annual: 1039,
      desc: "Büyüyen restoran ve kurye sistemi kurmak isteyenler için.",
      features: ["3 Şubeye Kadar", "Tüm Başlangıç özellikleri", "Kurye Takip Sistemi", "Sınırsız KDS ekranı", "Gelişmiş Analitik", "Stok yönetimi", "7/24 Öncelikli destek", "Özel onboarding"],
      cta: "14 Gün Ücretsiz Dene", highlight: true, badge: "En Popüler",
    },
    {
      name: "Kurumsal", monthly: null, annual: null,
      desc: "Zincir ve çok şubeli işletmeler. SLA garantili, özel entegrasyon.",
      features: ["Sınırsız Şube", "Tüm Büyüme özellikleri", "Beyaz etiket seçeneği", "Özel API entegrasyonu", "SLA garantisi (%99.9)", "Hesap Yöneticisi", "Kurumsal sözleşme", "Özel geliştirme"],
      cta: "Demo Talep Et", highlight: false,
    },
  ];
  return (
    <section id="pricing" className="bg-[#08080f] py-24 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <span className="text-xs font-bold text-orange-400 tracking-widest uppercase">Fiyatlandırma</span>
          <h2 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-black text-white">Kullandığın Kadar Öde.</h2>
          <p className="mt-4 text-zinc-400 text-lg max-w-xl mx-auto">Kurulum ücreti yok. Tekniker ücreti yok. Gizli ücret yok.</p>
          <div className="mt-6 inline-flex items-center gap-3 bg-white/5 border border-white/10 rounded-full p-1">
            <button onClick={() => setAnnual(false)} className={cn("px-4 py-1.5 rounded-full text-sm font-semibold transition-all", !annual ? "bg-orange-500 text-white shadow-lg" : "text-zinc-400 hover:text-white")}>
              Aylık
            </button>
            <button onClick={() => setAnnual(true)} className={cn("px-4 py-1.5 rounded-full text-sm font-semibold transition-all flex items-center gap-2", annual ? "bg-orange-500 text-white shadow-lg" : "text-zinc-400 hover:text-white")}>
              Yıllık
              <span className="text-[9px] font-black bg-green-500/20 text-green-400 border border-green-500/30 px-1.5 py-0.5 rounded-full">%20 İNDİRİM</span>
            </button>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-5 items-start">
          {plans.map(p => (
            <div key={p.name} className={cn("relative rounded-2xl border p-7 transition-all", p.highlight ? "bg-gradient-to-br from-orange-500/15 to-red-600/5 border-orange-500/45 shadow-2xl shadow-orange-500/10 md:scale-[1.04]" : "bg-white/3 border-white/8 hover:border-white/15")}>
              {p.badge && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-black px-4 py-1 rounded-full shadow-lg">{p.badge}</div>
              )}
              <div className="mb-6">
                <h3 className="font-black text-white text-xl mb-2">{p.name}</h3>
                <div className="flex items-end gap-1 mb-2">
                  {p.monthly !== null ? (
                    <><span className="text-4xl font-black text-white">₺{annual ? p.annual : p.monthly}</span><span className="text-zinc-500 text-sm mb-1">/ay</span></>
                  ) : (
                    <span className="text-3xl font-black text-white">Özel Fiyat</span>
                  )}
                </div>
                {p.monthly !== null && annual && (
                  <p className="text-xs text-green-400 font-semibold mb-2">Yıllık faturalama — aylık ₺{p.monthly - (p.annual ?? 0)} tasarruf</p>
                )}
                <p className="text-zinc-400 text-sm">{p.desc}</p>
              </div>
              <ul className="space-y-2.5 mb-8">
                {p.features.map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-zinc-300">
                    <span className="text-orange-400 font-bold flex-shrink-0">✓</span>{f}
                  </li>
                ))}
              </ul>
              <a href="#cta" className={cn("block text-center font-bold py-3 rounded-xl transition-all text-sm", p.highlight ? "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white shadow-lg shadow-orange-500/25" : "bg-white/8 hover:bg-white/15 text-white border border-white/10")}>
                {p.cta}
              </a>
            </div>
          ))}
        </div>
        <p className="text-center text-zinc-700 text-xs mt-8">
          14 gün ücretsiz · Kredi kartı gerekmez · İstediğin zaman iptal et · KDV hariç
        </p>
      </div>
    </section>
  );
}

// ── final cta ──────────────────────────────────────────
function FinalCTA() {
  return (
    <section id="cta" className="bg-[#0c0c14] py-24 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        <div className="relative rounded-3xl overflow-hidden border border-orange-500/30 p-10 sm:p-16 text-center bg-gradient-to-br from-orange-600/15 via-red-600/8 to-transparent">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-80 bg-orange-500/12 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-0 w-48 h-48 bg-red-500/8 rounded-full blur-2xl" />
          </div>
          <div className="relative z-10">
            <div className="text-6xl mb-5">🚀</div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white leading-tight mb-4">
              Restoranını Bugün<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500">
                Dijital Çağa Taşı.
              </span>
            </h2>
            <p className="text-zinc-300 text-lg mb-2 max-w-xl mx-auto">
              Telefonu açıyorsun, tarayıcıya giriyorsun, siparişleri alıyorsun. Bu kadar.
            </p>
            <p className="text-orange-400 font-bold text-sm mb-10">
              Kurulum yok · Tekniker yok · 14 gün tamamen ücretsiz
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="/pos" className="group inline-flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white font-black text-lg px-10 py-4 rounded-xl transition-all shadow-2xl shadow-orange-500/35 hover:shadow-orange-500/55 hover:-translate-y-1 active:scale-95">
                Ücretsiz Kullanmaya Başla
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </a>
              <a href="mailto:demo@rms.com.tr" className="inline-flex items-center justify-center gap-2 bg-white/8 hover:bg-white/14 border border-white/15 text-white font-semibold text-lg px-10 py-4 rounded-xl transition-all hover:-translate-y-1">
                📅 Demo İste
              </a>
            </div>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-5 text-xs text-zinc-500">
              {["✓ Kredi kartı gerekmez", "✓ Anında erişim", "✓ Her cihazda çalışır", "✓ Türkçe destek"].map(t => <span key={t}>{t}</span>)}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── footer ─────────────────────────────────────────────
function Footer() {
  return (
    <footer className="bg-[#06060b] border-t border-white/5 py-12 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          <div className="col-span-full md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/25">
                <span className="text-white font-black text-sm">R</span>
              </div>
              <span className="font-black text-white text-lg">RMS</span>
            </div>
            <p className="text-zinc-600 text-sm leading-relaxed max-w-xs">
              Mobil-first, sıfır kurulum restoran işletim sistemi. Telefon, tarayıcı, hazır.
            </p>
          </div>
          {[
            { title: "Ürün", links: ["Özellikler", "Kurye Sistemi", "QR Menü", "Fiyatlar"] },
            { title: "Şirket", links: ["Hakkımızda", "Blog", "Kariyer", "İletişim"] },
            { title: "Destek", links: ["Başlangıç Rehberi", "Yardım Merkezi", "SSS", "Canlı Destek"] },
          ].map(col => (
            <div key={col.title}>
              <h4 className="font-bold text-white text-sm mb-4">{col.title}</h4>
              <ul className="space-y-2.5">
                {col.links.map(l => (
                  <li key={l}><a href="#" className="text-zinc-600 hover:text-zinc-300 text-sm transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-white/5 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-zinc-700 text-sm">© 2026 RMS — Restoran İşletim Sistemi. Tüm hakları saklıdır.</p>
          <div className="flex items-center gap-6 text-zinc-700 text-sm">
            <a href="#" className="hover:text-zinc-400 transition-colors">Gizlilik</a>
            <a href="#" className="hover:text-zinc-400 transition-colors">Kullanım Şartları</a>
            <a href="#" className="hover:text-zinc-400 transition-colors">KVKK</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ── page export ────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="min-h-screen font-sans antialiased">
      <Navbar />
      <Hero />
      <Problem />
      <Solution />
      <MobileFirst />
      <Delivery />
      <Features />
      <ZeroSetup />
      <Testimonials />
      <Pricing />
      <FinalCTA />
      <Footer />
    </div>
  );
}
        }, 16);
      },
      { threshold: 0.4 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end]);
  return <span ref={ref}>{count}{suffix}</span>;
}

// ── nav ─────────────────────────────────────────
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);
  const links = [
    { label: "Özellikler", href: "#features" },
    { label: "Nasıl Çalışır", href: "#how" },
    { label: "Fiyatlar", href: "#pricing" },
    { label: "Yorumlar", href: "#testimonials" },
  ];
  return (
    <nav className={cn(
      "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
      scrolled ? "bg-[#0a0a0f]/95 backdrop-blur border-b border-white/10 shadow-xl" : "bg-transparent"
    )}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        {/* Logo */}
        <a href="#" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/30 group-hover:shadow-orange-500/50 transition-shadow">
            <span className="text-white font-black text-sm">R</span>
          </div>
          <span className="font-bold text-white text-lg tracking-tight">RMS</span>
          <span className="hidden sm:inline text-xs font-medium text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full">BETA</span>
        </a>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {links.map(l => (
            <a key={l.href} href={l.href} className="text-sm text-zinc-300 hover:text-white transition-colors font-medium">
              {l.label}
            </a>
          ))}
        </div>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <a href="#pricing" className="text-sm font-medium text-zinc-300 hover:text-white transition-colors">
            Giriş Yap
          </a>
          <a href="#cta" className="bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 active:scale-95">
            Ücretsiz Deneyin →
          </a>
        </div>

        {/* Mobile hamburger */}
        <button onClick={() => setOpen(!open)} className="md:hidden text-white p-1">
          <div className={cn("w-6 h-0.5 bg-white mb-1.5 transition-all", open && "rotate-45 translate-y-2")} />
          <div className={cn("w-6 h-0.5 bg-white mb-1.5 transition-all", open && "opacity-0")} />
          <div className={cn("w-6 h-0.5 bg-white transition-all", open && "-rotate-45 -translate-y-2")} />
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-[#0a0a0f]/98 border-t border-white/10 px-4 py-4 flex flex-col gap-4">
          {links.map(l => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="text-zinc-300 hover:text-white font-medium transition-colors">
              {l.label}
            </a>
          ))}
          <a href="#cta" onClick={() => setOpen(false)} className="bg-orange-500 text-white text-center font-semibold px-4 py-2.5 rounded-lg">
            Ücretsiz Deneyin →
          </a>
        </div>
      )}
    </nav>
  );
}

// ── hero ────────────────────────────────────────
function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-[#0a0a0f] pt-16">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-orange-500/8 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-purple-600/5 rounded-full blur-[100px]" />
        <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-blue-500/5 rounded-full blur-[80px]" />
        {/* Grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px]" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs sm:text-sm font-medium px-4 py-2 rounded-full mb-8">
          <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
          Türkiye'nin #1 Sıfır-Kurulum Restoran İşletim Sistemi
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-white leading-[1.05] tracking-tight mb-6">
          Teknikersiz.{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">
            Ayarsız.
          </span>
          <br />
          Anında Çalışır.
        </h1>

        {/* Subheadline */}
        <p className="text-lg sm:text-xl md:text-2xl text-zinc-300 max-w-3xl mx-auto mb-4 leading-relaxed">
          Cihazı tak — sistem ağı tarar, yazıcıları bulur, IP&apos;leri atar.
          <br className="hidden sm:block" />
          <strong className="text-white"> Restoranın dakikalar içinde sipariş almaya başlar.</strong>
        </p>

        {/* Proof badges */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
          {[
            { icon: "✓", text: "Tekniker YOK" },
            { icon: "✓", text: "IP Ayarı YOK" },
            { icon: "✓", text: "Manuel Kurulum YOK" },
            { icon: "⚡", text: "5 dakikada canlı" },
          ].map(b => (
            <span key={b.text} className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-200 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full">
              <span className="text-orange-400 font-bold">{b.icon}</span>
              {b.text}
            </span>
          ))}
        </div>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <a
            href="#cta"
            className="group inline-flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-bold text-lg px-8 py-4 rounded-xl transition-all shadow-2xl shadow-orange-500/30 hover:shadow-orange-500/50 hover:-translate-y-0.5 active:scale-95"
          >
            Ücretsiz Deneyin
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </a>
          <a
            href="#how"
            className="inline-flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-lg px-8 py-4 rounded-xl transition-all hover:-translate-y-0.5 active:scale-95"
          >
            <span className="w-5 h-5 rounded-full border-2 border-white/60 flex items-center justify-center">
              <span className="w-0 h-0 border-t-[5px] border-t-transparent border-l-[8px] border-l-white/80 border-b-[5px] border-b-transparent ml-0.5" />
            </span>
            Demo İzle
          </a>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-16 text-center">
          {[
            { value: 500, suffix: "+", label: "Aktif Restoran" },
            { value: 40, suffix: "%", label: "Daha Hızlı Sipariş" },
            { value: 30, suffix: "%", label: "Daha Az Operasyonel Maliyet" },
            { value: 5, suffix: " dk", label: "Ortalama Kurulum Süresi" },
          ].map(s => (
            <div key={s.label}>
              <div className="text-3xl sm:text-4xl font-black text-white mb-1">
                <Counter end={s.value} suffix={s.suffix} />
              </div>
              <div className="text-xs sm:text-sm text-zinc-400 font-medium">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 animate-bounce">
        <span className="text-xs text-zinc-500">Keşfet</span>
        <svg className="w-5 h-5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </section>
  );
}

// ── problem ─────────────────────────────────────
function Problem() {
  const pains = [
    {
      emoji: "🔧",
      title: "Tekniker Bağımlılığı",
      desc: "Her kurulum için dışarıdan tekniker çağırıyorsun. Hem pahalı hem yavaş. Küçük bir arızada saatler geçiyor.",
    },
    {
      emoji: "🌐",
      title: "IP ve Ağ Kabusu",
      desc: "Yazıcı IP'si değişiyor, sistem çöküyor. Yoğun saatte mutfak bağlantısı kopuyor. Garsonlar kağıt kağıt koşuyor.",
    },
    {
      emoji: "📉",
      title: "Yoğun Saatte Kaos",
      desc: "Sistem donuyor, siparişler karışıyor, masalar bekliyor. Her dakika kayıp — hem müşteri hem gelir.",
    },
    {
      emoji: "💸",
      title: "Lisans + Kurulum Maliyeti",
      desc: "Geleneksel POS sistemleri yüzlerce dolarlık kurulum ücreti alıyor. Yazılım güncellemesi mi? Ek ücret.",
    },
    {
      emoji: "🧩",
      title: "Karmaşık Arayüzler",
      desc: "Personeliniz teknik değil. Saatler süren eğitim, sayfalarca kılavuz. Yanlış sipariş, müşteri şikayeti.",
    },
    {
      emoji: "🔄",
      title: "Manuel Güncellemeler",
      desc: "Yeni özellik mi istiyorsun? Tekniker çağır, sistem kapat, güncelle. İş dünyası hızla değişiyor; sistem geri kalıyor.",
    },
  ];
  return (
    <section className="bg-[#0d0d14] py-24 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-sm font-semibold text-red-400 tracking-widest uppercase">Tanıdık Geliyor mu?</span>
          <h2 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-black text-white leading-tight">
            Geleneksel POS Sistemleri<br />
            <span className="text-red-400">Restoranları Mahvediyor</span>
          </h2>
          <p className="mt-4 text-zinc-400 text-lg max-w-2xl mx-auto">
            Yılda binlerce restoran aynı sorunlarla boğuşuyor. Sorun senin personelinizde değil — araçta.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {pains.map(p => (
            <div key={p.title} className="group relative bg-white/3 border border-white/8 hover:border-red-500/30 rounded-2xl p-6 transition-all hover:bg-white/5">
              <div className="text-3xl mb-4">{p.emoji}</div>
              <h3 className="font-bold text-white text-lg mb-2">{p.title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{p.desc}</p>
              <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <svg className="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom hook */}
        <div className="mt-14 bg-gradient-to-r from-red-500/10 via-transparent to-orange-500/10 border border-orange-500/20 rounded-2xl p-8 text-center">
          <p className="text-xl sm:text-2xl font-bold text-white">
            Her dakika beklediğin, kaybettiğin bir siparişin var.
            <br />
            <span className="text-orange-400">Bu döngüyü kırmak artık mümkün.</span>
          </p>
        </div>
      </div>
    </section>
  );
}

// ── solution ────────────────────────────────────
function Solution() {
  return (
    <section className="bg-[#0a0a0f] py-24 px-4 sm:px-6 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-sm font-semibold text-orange-400 tracking-widest uppercase">Çözüm</span>
          <h2 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-black text-white leading-tight">
            Tanıtıyoruz:{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">
              RMS
            </span>
          </h2>
          <p className="mt-4 text-zinc-300 text-lg max-w-3xl mx-auto">
            Dünya'nın ilk <strong className="text-white">Sıfır-Kurulum Kendi Kendine Devreye Giren Restoran İşletim Sistemi.</strong>
            <br />Cihazı bağla — sistem her şeyi halleder.
          </p>
        </div>

        {/* Main comparison */}
        <div className="grid md:grid-cols-2 gap-6 mb-16">
          {/* Before */}
          <div className="bg-white/3 border border-white/8 rounded-2xl p-8">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-7 h-7 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <span className="font-bold text-zinc-400 text-lg">Geleneksel Sistemler</span>
            </div>
            <ul className="space-y-3">
              {[
                "Tekniker çağır → günler bekle",
                "IP adreslerini manuel ayarla",
                "Her yazıcıyı tek tek konfigüre et",
                "Personeli günlerce eğit",
                "Güncelleme için sistemi kapat",
                "Her arıza için servis ücreti öde",
              ].map(t => (
                <li key={t} className="flex items-center gap-3 text-zinc-400 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* After */}
          <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border border-orange-500/30 rounded-2xl p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-2xl" />
            <div className="flex items-center gap-2 mb-6">
              <div className="w-7 h-7 rounded-full bg-orange-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="font-bold text-white text-lg">RMS — Sıfır Kurulum</span>
              <span className="text-xs bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full font-semibold">YENİ</span>
            </div>
            <ul className="space-y-3 relative z-10">
              {[
                "Tekniker YOK — sen kuruyorsun, tek başına",
                "Sistem ağı tarar, IP'leri otomatik atar",
                "Yazıcılar otomatik algılanır ve bağlanır",
                "Personel dostu arayüz — eğitim gerektirmez",
                "Güncellemeler sessizce otomatik gelir",
                "Arıza mı? Sistem kendini otomatik onarır",
              ].map(t => (
                <li key={t} className="flex items-center gap-3 text-zinc-200 text-sm">
                  <span className="text-orange-400 font-bold flex-shrink-0">✓</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Architecture visual */}
        <div className="bg-white/3 border border-white/8 rounded-2xl p-8 text-center">
          <p className="text-zinc-400 text-sm mb-6 uppercase tracking-widest font-semibold">Otomatik Bağlantı Mimarisi</p>
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6">
            {[
              { icon: "🖨️", label: "Yazıcı" },
              { icon: "📱", label: "Tablet" },
              { icon: "💻", label: "POS" },
            ].map((d, i) => (
              <div key={d.label} className="flex items-center gap-3 sm:gap-6">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl">
                    {d.icon}
                  </div>
                  <span className="text-xs text-zinc-400">{d.label}</span>
                </div>
                {i < 2 && <span className="text-orange-400 font-bold text-xl hidden sm:block">→</span>}
              </div>
            ))}
            <div className="flex items-center gap-3 sm:gap-6">
              <span className="text-orange-400 font-bold text-xl hidden sm:block">→</span>
              <div className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/30 flex items-center justify-center text-3xl">
                  ⚡
                </div>
                <span className="text-xs text-orange-400 font-semibold">Otomatik Algılama<br />Motoru</span>
              </div>
              <span className="text-orange-400 font-bold text-xl hidden sm:block">→</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-2xl">
                ✅
              </div>
              <span className="text-xs text-green-400 font-semibold">Hazır!</span>
            </div>
          </div>
          <p className="mt-6 text-zinc-300 text-sm">
            Sistem lokal ağı tarar → tüm cihazları bulur → IP&apos;leri atar → bağlantıyı kurar → restoran çalışmaya başlar
          </p>
        </div>
      </div>
    </section>
  );
}

// ── features ────────────────────────────────────
function Features() {
  const features = [
    {
      icon: "📲",
      tag: "QR Menü",
      title: "Akıllı QR Menü Sistemi",
      desc: "Masaya QR kodu yapıştır, müşteri kendi siparişini ver­sin. Menü güncelleme anında — kağıt menü yok, baskı maliyeti yok.",
      highlights: ["Anlık menü güncellemesi", "Çoklu dil desteği", "Görsel ürün galeri"],
      color: "from-purple-500/20 to-purple-600/5",
      border: "border-purple-500/30",
      tag_color: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    },
    {
      icon: "🖥️",
      tag: "Akıllı POS",
      title: "Gerçek Zamanlı POS Sistemi",
      desc: "Masaları anlık takip et, siparişleri saniyeler içinde işle. Hızlı ödeme akışı, çoklu ödeme yöntemi, adisyon yazdırma.",
      highlights: ["Masa yönetimi", "Çoklu ödeme (nakit/kart)", "Anlık sipariş takibi"],
      color: "from-blue-500/20 to-blue-600/5",
      border: "border-blue-500/30",
      tag_color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    },
    {
      icon: "🍳",
      tag: "KDS",
      title: "Mutfak Ekranı Sistemi",
      desc: "Siparişler otomatik mutfağa ve bara iletilir. Hangi sipariş hazır, hangisi bekliyor — aşçı bir bakışta görüyor.",
      highlights: ["Otomatik sipariş yönlendirme", "Zaman sayacı", "Hazır bildirimi"],
      color: "from-green-500/20 to-green-600/5",
      border: "border-green-500/30",
      tag_color: "text-green-400 bg-green-500/10 border-green-500/20",
    },
    {
      icon: "⚙️",
      tag: "Sıfır Kurulum",
      title: "Otomatik Ağ Konfigürasyon Motoru",
      desc: "LAN tarama, IP atama, cihaz keşfi — hepsi otomatik. Plug & Play yazıcı bağlantısı. Tekniker çağırmana gerek yok.",
      highlights: ["LAN otomatik tarama", "Plug & Play yazıcı", "Otomatik IP atama"],
      color: "from-orange-500/20 to-orange-600/5",
      border: "border-orange-500/30",
      tag_color: "text-orange-400 bg-orange-500/10 border-orange-500/20",
    },
    {
      icon: "🎁",
      tag: "Sadakat",
      title: "Müşteri Sadakat Sistemi",
      desc: "Puan kazan, ödül al. Tekrar gelen müşteri daha fazla harcıyor. Müşteri bağlılığını ve gelirinizi artır.",
      highlights: ["Puan sistemi", "Kampanya yönetimi", "Müşteri profili"],
      color: "from-pink-500/20 to-pink-600/5",
      border: "border-pink-500/30",
      tag_color: "text-pink-400 bg-pink-500/10 border-pink-500/20",
    },
    {
      icon: "📊",
      tag: "Analitik",
      title: "Kapsamlı Analitik Paneli",
      desc: "Ciro, popüler ürünler, masa devir hızı, personel performansı — veriye dayalı karar al, büyü.",
      highlights: ["Anlık ciro takibi", "Ürün performansı", "Personel raporları"],
      color: "from-cyan-500/20 to-cyan-600/5",
      border: "border-cyan-500/30",
      tag_color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    },
  ];

  return (
    <section id="features" className="bg-[#0d0d14] py-24 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-sm font-semibold text-orange-400 tracking-widest uppercase">Özellikler</span>
          <h2 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-black text-white leading-tight">
            Bir Sistemde Her Şey
          </h2>
          <p className="mt-4 text-zinc-400 text-lg max-w-2xl mx-auto">
            Ayrı ayrı uygulamalar değil — tam entegre bir restoran işletim sistemi.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map(f => (
            <div
              key={f.title}
              className={cn(
                "group relative bg-gradient-to-br rounded-2xl border p-6 hover:scale-[1.02] transition-all duration-300 cursor-default",
                f.color,
                f.border
              )}
            >
              <div className="flex items-start justify-between mb-5">
                <div className="text-4xl">{f.icon}</div>
                <span className={cn("text-xs font-semibold border px-2.5 py-1 rounded-full", f.tag_color)}>
                  {f.tag}
                </span>
              </div>
              <h3 className="font-bold text-white text-lg mb-2">{f.title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed mb-5">{f.desc}</p>
              <ul className="space-y-1.5">
                {f.highlights.map(h => (
                  <li key={h} className="flex items-center gap-2 text-sm text-zinc-300">
                    <span className="text-orange-400 font-bold">✓</span>
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── how it works ────────────────────────────────
function HowItWorks() {
  const steps = [
    {
      number: "01",
      icon: "🔌",
      title: "Cihazları Bağla",
      desc: "Yazıcını ve tabletini ağa bağla. Başka hiçbir şey yapmana gerek yok.",
      detail: "Ağ kablosu veya Wi-Fi — fark etmez. Sistem her ikisini de algılar.",
    },
    {
      number: "02",
      icon: "🔍",
      title: "Sistem Her Şeyi Algılar",
      desc: "RMS lokal ağı tarar, tüm cihazları otomatik bulur, IP'leri atar ve bağlantıları kurar.",
      detail: "Mutfak yazıcısı, kasa yazıcısı, garson tableti — hepsi otomatik yapılandırılır.",
    },
    {
      number: "03",
      icon: "🚀",
      title: "Siparişleri Al!",
      desc: "Restoranın canlı. QR menü aktif, POS hazır, mutfak ekranı çalışıyor.",
      detail: "Ortalama kurulum süresi: 5 dakika. Gerçekten.",
    },
  ];

  return (
    <section id="how" className="bg-[#0a0a0f] py-24 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-sm font-semibold text-orange-400 tracking-widest uppercase">Nasıl Çalışır</span>
          <h2 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-black text-white leading-tight">
            3 Adım.{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">
              5 Dakika.
            </span>{" "}
            Hazır.
          </h2>
          <p className="mt-4 text-zinc-400 text-lg">
            Karmaşık kılavuz yok. Tekniker yok. Beklemek yok.
          </p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Connector line */}
          <div className="hidden md:block absolute top-16 left-1/2 -translate-x-1/2 w-[calc(66%-4rem)] h-0.5 bg-gradient-to-r from-orange-500/20 via-orange-500/60 to-orange-500/20" />

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((s, i) => (
              <div key={s.number} className="relative flex flex-col items-center text-center group">
                {/* Number */}
                <div className="relative mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/40 flex items-center justify-center text-4xl group-hover:scale-110 group-hover:border-orange-500/80 transition-all shadow-xl shadow-orange-500/10">
                    {s.icon}
                  </div>
                  <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-black flex items-center justify-center">
                    {i + 1}
                  </div>
                </div>
                <h3 className="font-bold text-white text-xl mb-3">{s.title}</h3>
                <p className="text-zinc-300 text-sm leading-relaxed mb-3">{s.desc}</p>
                <p className="text-zinc-500 text-xs leading-relaxed bg-white/3 border border-white/8 rounded-xl px-4 py-3">
                  {s.detail}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Time proof */}
        <div className="mt-16 bg-gradient-to-r from-orange-500/10 to-transparent border border-orange-500/20 rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-4">
          <div className="text-5xl">⏱️</div>
          <div>
            <p className="font-black text-white text-xl">Ortalama Toplam Kurulum Süresi: <span className="text-orange-400">4 dakika 38 saniye</span></p>
            <p className="text-zinc-400 text-sm mt-1">500+ restoranın ortalaması. Geleneksel sistemler: 3–7 gün.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── benefits ────────────────────────────────────
function Benefits() {
  const benefits = [
    {
      icon: "💰",
      title: "Tekniker Maliyeti Sıfır",
      desc: "Kurulum için dışarıya ödediğin yüzlerce dolarlık tekniker ücretinden kurtul. Bir kez al, kendin kur.",
      stat: "₺3.000+",
      stat_label: "ortalama kurulum tasarrufu",
    },
    {
      icon: "⚡",
      title: "%40 Daha Hızlı Sipariş Akışı",
      desc: "QR menü + anlık mutfak iletişimi + optimize POS akışıyla masadan önceye kadar süre dramatik düşer.",
      stat: "%40",
      stat_label: "daha hızlı sipariş akışı",
    },
    {
      icon: "❌",
      title: "Sipariş Hataları Neredeyse Sıfır",
      desc: "Yazılı sipariş kağıdı yok, kaybolan adisyon yok. Her sipariş dijital, her şey yazıcıya direkt gidiyor.",
      stat: "%90",
      stat_label: "daha az sipariş hatası",
    },
    {
      icon: "😊",
      title: "Müşteri Memnuniyeti Artar",
      desc: "Daha kısa bekleme, doğru sipariş, kolay ödeme. Müşteri mutlu → tekrar geliyor → değerlendirme artıyor.",
      stat: "4.8/5",
      stat_label: "ortalama müşteri puanı",
    },
    {
      icon: "📈",
      title: "Gelir Artışı",
      desc: "Masa devir hızı artar, müşteri bekleme süresi kısalır, sadakat sistemi tekrar gelen müşteri kazandırır.",
      stat: "%25",
      stat_label: "ortalama gelir artışı",
    },
    {
      icon: "🛡️",
      title: "Sıfır Teknik Endişe",
      desc: "Sistem kendini güncelliyor, arızalanırsa kendini onarıyor. Sen sadece yönetiyorsun — teknik detaylar bize.",
      stat: "7/24",
      stat_label: "otomatik sistem bakımı",
    },
  ];

  return (
    <section className="bg-[#0d0d14] py-24 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-sm font-semibold text-orange-400 tracking-widest uppercase">Faydalar</span>
          <h2 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-black text-white">
            Sonuçlar Konuşuyor
          </h2>
          <p className="mt-4 text-zinc-400 text-lg max-w-2xl mx-auto">
            RMS kullanan restoranların ilk 30 günde elde ettiği gerçek sonuçlar.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {benefits.map(b => (
            <div key={b.title} className="bg-white/3 border border-white/8 hover:border-orange-500/20 rounded-2xl p-6 transition-all group">
              <div className="flex items-start justify-between mb-4">
                <div className="text-3xl">{b.icon}</div>
                <div className="text-right">
                  <div className="text-2xl font-black text-orange-400">{b.stat}</div>
                  <div className="text-xs text-zinc-500">{b.stat_label}</div>
                </div>
              </div>
              <h3 className="font-bold text-white text-base mb-2">{b.title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{b.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── testimonials ────────────────────────────────
function Testimonials() {
  const testimonials = [
    {
      quote: "Normalde yeni sistemi kurmak 3 gün sürerdi, tekniker parası öder, ayar yapardık. RMS ile sabah cihazları bağladım, öğlen siparişler gelmeye başlamıştı. İnanamadım.",
      name: "Mehmet Yılmaz",
      role: "Sahibi — Yılmaz Ocakbaşı, İstanbul",
      avatar: "MY",
      color: "bg-orange-500",
      stars: 5,
    },
    {
      quote: "Mutfak ekranı her şeyi değiştirdi. Garsonlar artık mutfağa kağıt taşımıyor. Sipariş hataları bitti, çalışanlarım çok daha az stresli, müşteri şikayetleri neredeyse sıfır.",
      name: "Ayşe Kara",
      role: "İşletme Yöneticisi — Kara Cafe, Ankara",
      avatar: "AK",
      color: "bg-purple-500",
      stars: 5,
    },
    {
      quote: "QR menü sistemi misafirlerimizin çok hoşuna gitti. 'Teknolojik restoran' diyorlar artık. Garson başına masa sayısı arttı, aynı personelle daha fazla ciro yapıyoruz.",
      name: "Ali Çelik",
      role: "Patron — Sera Restaurant, İzmir",
      avatar: "AÇ",
      color: "bg-blue-500",
      stars: 5,
    },
    {
      quote: "3 şubem var, her birini ayrı ayrı takip edebiliyorum. Ciro, personel, stok — tek panelden. Eskiden bu kadar kolaysa neden kimse yapmamış soruyorum kendime.",
      name: "Fatma Demir",
      role: "Zincir Restoran Sahibi — DeliMeatBurger, Bursa",
      avatar: "FD",
      color: "bg-green-500",
      stars: 5,
    },
    {
      quote: "Kurulum hiç zorlamadı. Ben teknoloji konusunda çok iyi değilim ama talimatlar çok açık. Yazıcıyı bağladım, 5 dakika içinde yazıci adisyon basıyordu. Gerçekten bu kadar.",
      name: "Hasan Öztürk",
      role: "Kafe Sahibi — Boğaz Kafe, İstanbul",
      avatar: "HÖ",
      color: "bg-red-500",
      stars: 5,
    },
    {
      quote: "Aylık maliyetimiz azaldı çünkü artık tekniker aramıyoruz. Sistem arızalanınca kendi kendini düzeltiyor. Destek ekibi anında cevap veriyor. Çok memnunuz.",
      name: "Zeynep Arslan",
      role: "Restaurant Müdürü — Arslan Pide, Konya",
      avatar: "ZA",
      color: "bg-cyan-500",
      stars: 5,
    },
  ];

  return (
    <section id="testimonials" className="bg-[#0a0a0f] py-24 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-sm font-semibold text-orange-400 tracking-widest uppercase">Müşteri Yorumları</span>
          <h2 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-black text-white">
            500+ Restoran Konuşuyor
          </h2>
          <p className="mt-4 text-zinc-400 text-lg">
            Gerçek restoran sahipleri, gerçek sonuçlar.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {testimonials.map(t => (
            <div key={t.name} className="bg-white/3 border border-white/8 hover:border-white/15 rounded-2xl p-6 flex flex-col transition-all">
              {/* Stars */}
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: t.stars }).map((_, i) => (
                  <span key={i} className="text-orange-400 text-sm">★</span>
                ))}
              </div>
              <p className="text-zinc-300 text-sm leading-relaxed flex-1 mb-6">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0", t.color)}>
                  {t.avatar}
                </div>
                <div>
                  <div className="font-semibold text-white text-sm">{t.name}</div>
                  <div className="text-zinc-500 text-xs">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Trust bar */}
        <div className="mt-14 grid sm:grid-cols-3 gap-5 text-center">
          {[
            { value: "500+", label: "Aktif Restoran" },
            { value: "4.9/5", label: "Ortalama Puan" },
            { value: "%98", label: "Müşteri Memnuniyeti" },
          ].map(s => (
            <div key={s.label} className="bg-white/3 border border-white/8 rounded-2xl p-6">
              <div className="text-4xl font-black text-white mb-1">{s.value}</div>
              <div className="text-zinc-400 text-sm">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── pricing ─────────────────────────────────────
function Pricing() {
  const plans = [
    {
      name: "Starter",
      price: "₺799",
      period: "/ay",
      desc: "Tek şubeli küçük restoran ve kafe için ideal başlangıç.",
      features: [
        "1 Şube",
        "QR Menü Sistemi",
        "Temel POS",
        "Mutfak Ekranı (1 ekran)",
        "Otomatik Yazıcı Kurulumu",
        "E-posta destek",
        "Bulut yedekleme",
      ],
      cta: "Ücretsiz Başla",
      highlight: false,
    },
    {
      name: "Pro",
      price: "₺1.499",
      period: "/ay",
      desc: "Büyüyen restoranlar için güçlü özellikler ve öncelikli destek.",
      features: [
        "3 Şubeye Kadar",
        "Tüm Starter özellikleri",
        "Sınırsız Mutfak Ekranı",
        "Sadakat Sistemi",
        "Gelişmiş Analitik",
        "Stok Takibi",
        "7/24 Öncelikli Destek",
        "Özel onboarding",
      ],
      cta: "14 Gün Ücretsiz Dene",
      highlight: true,
      badge: "En Popüler",
    },
    {
      name: "Enterprise",
      price: "Özel",
      period: "",
      desc: "Zincir restoranlar ve çok şubeli işletmeler için kurumsal çözüm.",
      features: [
        "Sınırsız Şube",
        "Tüm Pro özellikleri",
        "Özel entegrasyonlar",
        "Beyaz etiket seçeneği",
        "SLA garantisi",
        "Hesap Yöneticisi",
        "Özel geliştirme",
        "Kurumsal sözleşme",
      ],
      cta: "Demo Talep Et",
      highlight: false,
    },
  ];

  return (
    <section id="pricing" className="bg-[#0d0d14] py-24 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-sm font-semibold text-orange-400 tracking-widest uppercase">Fiyatlandırma</span>
          <h2 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-black text-white">
            Şeffaf, Basit Fiyatlar
          </h2>
          <p className="mt-4 text-zinc-400 text-lg max-w-2xl mx-auto">
            Gizli ücret yok. Kurulum ücreti yok. İstediğin zaman iptal et.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-medium px-4 py-2 rounded-full">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            14 gün ücretsiz deneme — kredi kartı gerekmez
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-5 items-start">
          {plans.map(p => (
            <div
              key={p.name}
              className={cn(
                "relative rounded-2xl p-7 border transition-all",
                p.highlight
                  ? "bg-gradient-to-br from-orange-500/15 to-orange-600/5 border-orange-500/50 shadow-2xl shadow-orange-500/10 scale-[1.03]"
                  : "bg-white/3 border-white/10 hover:border-white/20"
              )}
            >
              {p.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-xs font-bold px-4 py-1 rounded-full shadow-lg shadow-orange-500/30">
                  {p.badge}
                </div>
              )}

              <div className="mb-6">
                <h3 className="font-black text-white text-xl mb-1">{p.name}</h3>
                <div className="flex items-end gap-1 mb-2">
                  <span className="text-4xl font-black text-white">{p.price}</span>
                  {p.period && <span className="text-zinc-400 text-sm mb-1">{p.period}</span>}
                </div>
                <p className="text-zinc-400 text-sm">{p.desc}</p>
              </div>

              <ul className="space-y-2.5 mb-8">
                {p.features.map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-zinc-300">
                    <span className="text-orange-400 font-bold flex-shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href="#cta"
                className={cn(
                  "block text-center font-bold py-3 rounded-xl transition-all",
                  p.highlight
                    ? "bg-orange-500 hover:bg-orange-400 text-white shadow-lg shadow-orange-500/30"
                    : "bg-white/8 hover:bg-white/15 text-white border border-white/10"
                )}
              >
                {p.cta}
              </a>
            </div>
          ))}
        </div>

        <p className="text-center text-zinc-500 text-xs mt-8">
          Tüm planlar otomatik yazıcı kurulumu ve bulut yedekleme içerir. KDV dahil değildir.
        </p>
      </div>
    </section>
  );
}

// ── final cta ───────────────────────────────────
function FinalCTA() {
  return (
    <section id="cta" className="bg-[#0a0a0f] py-24 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-orange-500/20 via-orange-600/10 to-transparent border border-orange-500/30 p-10 sm:p-16 text-center">
          {/* Glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-orange-500/15 rounded-full blur-3xl" />
          </div>

          <div className="relative z-10">
            <div className="text-5xl mb-6">🚀</div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
              Restoranını 5 Dakikada
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-500">
                Dijitale Geçir.
              </span>
            </h2>
            <p className="text-zinc-300 text-lg mb-3 max-w-2xl mx-auto">
              Tekniker bekleme. Karmaşık kurulum yok. Bugün başla, bugün sipariş al.
            </p>
            <p className="text-orange-400 font-semibold text-sm mb-10">
              14 gün ücretsiz — kredi kartı gerekmez — istediğin zaman iptal et
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="/pos"
                className="group inline-flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-bold text-lg px-10 py-4 rounded-xl transition-all shadow-2xl shadow-orange-500/40 hover:shadow-orange-500/60 hover:-translate-y-0.5 active:scale-95"
              >
                Ücretsiz Denemeye Başla
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </a>
              <a
                href="mailto:demo@rms.com.tr"
                className="inline-flex items-center justify-center gap-2 bg-white/8 hover:bg-white/15 border border-white/15 text-white font-semibold text-lg px-10 py-4 rounded-xl transition-all hover:-translate-y-0.5"
              >
                📅 Demo Talep Et
              </a>
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-zinc-400">
              {[
                "✓ Kurulum desteği dahil",
                "✓ Veri güvenliği garantisi",
                "✓ 7/24 destek",
                "✓ Türkçe arayüz",
              ].map(t => <span key={t}>{t}</span>)}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── footer ──────────────────────────────────────
function Footer() {
  return (
    <footer className="bg-[#070709] border-t border-white/5 py-12 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-full md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/30">
                <span className="text-white font-black text-sm">R</span>
              </div>
              <span className="font-bold text-white text-lg">RMS</span>
            </div>
            <p className="text-zinc-500 text-sm leading-relaxed max-w-xs">
              Türkiye&apos;nin en hızlı sıfır-kurulum restoran yönetim sistemi. Cihazı tak, sipariş al.
            </p>
          </div>

          {/* Links */}
          {[
            {
              title: "Ürün",
              links: ["Özellikler", "Fiyatlar", "Güvenlik", "Güncellemeler"],
            },
            {
              title: "Şirket",
              links: ["Hakkımızda", "Blog", "Kariyer", "İletişim"],
            },
            {
              title: "Destek",
              links: ["Yardım Merkezi", "Kurulum Rehberi", "SSS", "Status"],
            },
          ].map(col => (
            <div key={col.title}>
              <h4 className="font-semibold text-white text-sm mb-4">{col.title}</h4>
              <ul className="space-y-2.5">
                {col.links.map(l => (
                  <li key={l}>
                    <a href="#" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/5 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-zinc-600 text-sm">
            © 2026 RMS — Restoran Yönetim Sistemi. Tüm hakları saklıdır.
          </p>
          <div className="flex items-center gap-6 text-zinc-600 text-sm">
            <a href="#" className="hover:text-zinc-400 transition-colors">Gizlilik Politikası</a>
            <a href="#" className="hover:text-zinc-400 transition-colors">Kullanım Şartları</a>
            <a href="#" className="hover:text-zinc-400 transition-colors">KVKK</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ── main export ─────────────────────────────────
export default function LandingPage() {
  return (
    <div className="min-h-screen font-sans antialiased">
      <Navbar />
      <Hero />
      <Problem />
      <Solution />
      <Features />
      <HowItWorks />
      <Benefits />
      <Testimonials />
      <Pricing />
      <FinalCTA />
      <Footer />
    </div>
  );
}
